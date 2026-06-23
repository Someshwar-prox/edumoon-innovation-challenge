import path from 'path';
import fs from 'fs';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { documentRepository, extensionToDocumentType } from '../repositories/document.repository';
import { businessRepository } from '../../business/repositories/business.repository';
import logger from '../../utils/logger';
import { config } from '../../config';
import { Document, DocumentType } from '@prisma/client';
import { DocumentUploadedEvent } from '../events/document.event';
import { documentListener } from '../listeners/document.listener';
import {
  uploadObject as supabaseUpload,
  deleteObject as supabaseDelete,
} from '../../storage/supabase-storage';

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const;

// We use memory storage (not disk) so we can stream the buffer straight to
// Supabase. Local disk uploads are gone — files would die on every restart.
const storage = multer.memoryStorage();

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if ((ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ---------------------------------------------------------------------------
// Document service
// ---------------------------------------------------------------------------
export class DocumentService {
  async uploadDocument(
    businessId: string,
    file: Express.Multer.File,
    description?: string,
  ): Promise<Document> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }

    const type = extensionToDocumentType(path.extname(file.originalname));

    // 1) Persist the row first so we have an id to use as the object key.
    //    `url` is the storage path, NOT a public URL — clients use signed URLs.
    const placeholderPath = `pending/${businessId}/${Date.now()}${path.extname(file.originalname)}`;
    const document = await documentRepository.createDocument({
      businessId,
      filename: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type,
      url: placeholderPath,
      description,
    });

    // 2) Stream the buffer to Supabase. We use document.id in the key so
    //    re-uploads never collide.
    const ext = path.extname(file.originalname).toLowerCase();
    const objectPath = `${businessId}/${document.id}${ext}`;
    try {
      await supabaseUpload(objectPath, file.buffer, file.mimetype);
    } catch (err) {
      // Roll back the row so we don't have a dangling Document with no file.
      await documentRepository.deleteDocument(document.id).catch(() => undefined);
      throw err;
    }

    // 3) Update the row with the real storage path.
    //    url is what /api/documents/:id/download uses to issue a signed URL.
    //    We can't store the signed URL itself (it expires), so we store the
    //    object path and resolve it on demand.
    const finalDoc = await documentRepository.updateDocumentUrl(document.id, objectPath);

    const event = new DocumentUploadedEvent(
      finalDoc.id,
      businessId,
      file.originalname,
      file.size,
      type,
    );
    await documentListener.onDocumentUploaded(event);

    // 4) Forward to ai-service for chunking/embedding. We don't await this
    //    before returning — uploads should be fast. Errors are logged but
    //    surface as a 'pending' document; the listener can also retry.
    void this.proxyToAiService(finalDoc.id, businessId, file, objectPath).catch((err) => {
      logger.error('Failed to communicate with AI Service for document processing', err);
    });

    return finalDoc;
  }

  private async proxyToAiService(
    documentId: string,
    businessId: string,
    file: Express.Multer.File,
    objectPath: string,
  ): Promise<void> {
    const aiServiceUrl = config.externalDocumentServiceUrl;

    const formData = new FormData();
    formData.append('business_id', businessId);
    // ai-service expects a multipart 'files' field; we still pass the buffer
    // directly (memory storage gives us file.buffer).
    formData.append('files', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      knownLength: file.size,
    });
    // Tell ai-service where the durable copy lives so it can re-fetch later.
    formData.append(
      'metadata',
      JSON.stringify({
        gateway_document_id: documentId,
        storage: {
          provider: 'supabase',
          bucket: config.supabaseBucket,
          path: objectPath,
        },
      }),
    );

    const headers: Record<string, string> = { ...formData.getHeaders() };
    if (config.externalApiKey) {
      headers['X-Api-Key'] = config.externalApiKey;
    }

    const response = await axios.post<{
      indexed?: number;
      chunks_indexed?: number;
      skipped?: unknown[];
    }>(`${aiServiceUrl}/v1/process-documents`, formData, {
      headers,
      timeout: 60_000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });

    const chunkCount = Number(
      response.data?.chunks_indexed ?? response.data?.indexed ?? 0,
    );
    await this.markAsProcessed(documentId, undefined, Number.isFinite(chunkCount) ? chunkCount : 0);
  }

  async getDocumentById(id: string): Promise<Document> {
    const document = await documentRepository.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }
    return document;
  }

  async getDocumentsByBusinessId(businessId: string): Promise<Document[]> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return documentRepository.findByBusinessId(businessId);
  }

  async updateDocument(
    id: string,
    data: { description?: string; isProcessed?: boolean },
  ): Promise<Document> {
    const existing = await documentRepository.findById(id);
    if (!existing) {
      throw new Error('Document not found');
    }
    return documentRepository.updateDocument(id, {
      description: data.description ?? null,
      isProcessed: data.isProcessed,
    });
  }

  async deleteDocument(id: string): Promise<Document> {
    const existing = await documentRepository.findById(id);
    if (!existing) {
      throw new Error('Document not found');
    }
    // Best-effort delete from Supabase Storage. Failure is logged but does
    // not block the row soft-delete.
    if (existing.url && !existing.url.startsWith('pending/')) {
      await supabaseDelete(existing.url).catch(() => undefined);
    }
    return documentRepository.deleteDocument(id);
  }

  async markAsProcessed(
    id: string,
    extractedText?: string,
    chunkCount?: number,
  ): Promise<Document> {
    const existing = await documentRepository.findById(id);
    if (!existing) {
      throw new Error('Document not found');
    }
    return documentRepository.markAsProcessed(id, extractedText, chunkCount);
  }

  async getDocumentCount(businessId: string): Promise<number> {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new Error('Business not found');
    }
    return documentRepository.countByBusinessId(businessId);
  }
}

export const documentService = new DocumentService();

export type { Document, DocumentType };
