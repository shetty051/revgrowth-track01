import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { opportunitiesRouter } from './routes/opportunities';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/opportunities', opportunitiesRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RevGrowth Backend Analytics' });
});

app.listen(PORT, () => {
  console.log(`RevGrowth Analytics Backend listening on http://localhost:${PORT}`);
});