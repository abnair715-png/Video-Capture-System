import { Router } from 'express';
import { generatePresignedUrlController } from '../controllers/presignedUrlController';

const router = Router();

router.post('/generate-presigned-url', generatePresignedUrlController);

export default router;
