import cors from 'cors';
import express from 'express';
import presignedUrlRoutes from './routes/presignedUrlRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(presignedUrlRoutes);

app.use((_req, res) => {
  res.status(404).json({
    message: 'Route not found.',
  });
});

export default app;
