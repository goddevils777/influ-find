import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { requestLogger, errorLogger } from './middleware/logger';
import locationRoutes from './routes/locationRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);


import searchRoutes from './routes/searchRoutes';
import adminRoutes from './routes/adminRoutes';

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/locations', locationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware (должен быть последним)
app.use(errorLogger);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});