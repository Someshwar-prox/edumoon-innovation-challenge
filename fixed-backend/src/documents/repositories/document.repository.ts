import { prisma } from '../../lib/prisma';
import { Document } from '@prisma/client';
import { DocumentType } from '@prisma/client';

const SUPPORTED_EXTENSIONS: Record<string, DocumentType> = {
  '.pdf': DocumentType.PDF,
  '.docx': DocumentType.DOCX,
  '.txt': DocumentType.TXT,
};

export function extensionToDocumentType(ext: string): DocumentType {
  const normalized = ext.toLowerCase();
  const type = SUPPORTED_EXTENSIONS[normalized];
  if (!type) {
    throw new Error(`Unsupported file type: ${ext}`);
  }
  return type;
}

// Document repository
export class DocumentRepository {
  // Find document by ID
  async findById(id: string): Promise<Document | null> {
    return prisma.document.findUnique({ where: { id } });
  }

  // Find documents by business ID (excludes soft-deleted)
  async findByBusinessId(businessId: string): Promise<Document[]> {
    return prisma.document.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Create document record
  async createDocument(data: {
    businessId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    type: DocumentType;
    url: string;
    description?: string | null;
  }): Promise<Document> {
    // NOTE: the Prisma Document model has no `description` column today
    // (only Business and Website do). We accept `description` from callers
    // for forward compatibility, but it is intentionally dropped here.
    return prisma.document.create({
      data: {
        businessId: data.businessId,
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        type: data.type,
        url: data.url,
      },
    });
  }

  // Update document
  async updateDocument(
    id: string,
    data: Partial<{
      description: string | null;
      isProcessed: boolean;
      extractedText: string | null;
      chunkCount: number;
    }>,
  ): Promise<Document> {
    return prisma.document.update({ where: { id }, data });
  }

  // Update the storage path (`url`) — used after we know the Supabase key.
  async updateDocumentUrl(id: string, url: string): Promise<Document> {
    return prisma.document.update({ where: { id }, data: { url } });
  }

  // Soft delete document
  async deleteDocument(id: string): Promise<Document> {
    return prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Mark document as processed
  async markAsProcessed(
    id: string,
    extractedText?: string,
    chunkCount?: number,
  ): Promise<Document> {
    return prisma.document.update({
      where: { id },
      data: {
        isProcessed: true,
        extractedText: extractedText ?? null,
        chunkCount: chunkCount ?? 0,
      },
    });
  }

  // Get document count for business (excludes soft-deleted)
  async countByBusinessId(businessId: string): Promise<number> {
    return prisma.document.count({ where: { businessId, deletedAt: null } });
  }
}

export const documentRepository = new DocumentRepository();
