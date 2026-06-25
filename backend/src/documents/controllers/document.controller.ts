import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import {
  uploadDocumentSchema,
  updateDocumentSchema,
  markAsProcessedSchema,
} from '../validators/document.validator';
import { documentService, upload } from '../services/document.service';
import { businessRepository } from '../../business/repositories/business.repository';
import logger from '../../utils/logger';

export class DocumentController {
  // POST /api/documents/upload
  async upload(req: Request, res: Response, next: NextFunction) {
    upload.single('file')(req, res, async (multerErr: unknown) => {
      if (multerErr) {
        const message =
          multerErr instanceof multer.MulterError
            ? `File upload error: ${multerErr.message}`
            : (multerErr as Error).message;
        return res.status(400).json({ error: message });
      }

      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const businessId = req.body.businessId as string;
        const business = businessId 
          ? await businessRepository.findById(businessId)
          : await businessRepository.findByUserId(userId);

        if (!business || business.userId !== userId) {
          return res.status(404).json({ error: 'Business not found or forbidden' });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const metadata = uploadDocumentSchema.parse(req.body);
        const document = await documentService.uploadDocument(
          business.id,
          req.file,
          metadata.description,
        );

        return res.status(201).json({
          message: 'Document uploaded successfully',
          document,
        });
      } catch (error) {
        logger.error('Document upload failed', error);
        return next(error);
      }
    });
  }

  // GET /api/documents/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocumentById(id);
      const business = await businessRepository.findById(document.businessId);
      
      if (!business || business.userId !== req.user?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({ document });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/documents — list documents for the auth'd business
  async getByUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const businessId = req.query.businessId as string;
      const business = businessId 
        ? await businessRepository.findById(businessId)
        : await businessRepository.findByUserId(userId);

      if (!business || business.userId !== userId) {
        return res.status(404).json({ error: 'Business not found or forbidden' });
      }
      
      const documents = await documentService.getDocumentsByBusinessId(business.id);
      return res.status(200).json({ documents });
    } catch (error) {
      return next(error);
    }
  }

  // PUT /api/documents/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocumentById(id);
      const business = await businessRepository.findById(document.businessId);
      if (!business || business.userId !== req.user?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const data = updateDocumentSchema.parse(req.body);
      const updated = await documentService.updateDocument(id, data);
      return res.status(200).json({ document: updated });
    } catch (error) {
      return next(error);
    }
  }

  // DELETE /api/documents/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocumentById(id);
      const business = await businessRepository.findById(document.businessId);
      if (!business || business.userId !== req.user?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await documentService.deleteDocument(id);
      return res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/documents/:id/process
  async markAsProcessed(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = markAsProcessedSchema.parse(req.body);
      const document = await documentService.markAsProcessed(
        id,
        body.extractedText,
        body.chunkCount,
      );
      return res.status(200).json({
        message: 'Document marked as processed successfully',
        document,
      });
    } catch (error) {
      return next(error);
    }
  }

  // GET /api/documents/count
  async getCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const business = await businessRepository.findByUserId(userId);
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }
      const count = await documentService.getDocumentCount(business.id);
      return res.status(200).json({ count });
    } catch (error) {
      return next(error);
    }
  }
}

export const documentController = new DocumentController();
