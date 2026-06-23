import { Router } from 'express';
import { websiteController } from '../controllers/website.controller';
import { validateRequest } from '../../middleware/validation.middleware';
import { websiteUrlSchema, updateWebsiteSchema } from '../validators/website.validator';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', websiteController.getByBusinessId);
router.get('/pages', websiteController.getPages);
router.post('/url', validateRequest(websiteUrlSchema), websiteController.setUrl);
router.put('/', validateRequest(updateWebsiteSchema), websiteController.update);
router.delete('/', websiteController.delete);
router.post('/crawl', websiteController.crawl);
router.post('/recrawl', websiteController.recrawl);

export default router;
