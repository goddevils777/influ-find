import { Router } from 'express';
import { cacheService } from '../services/cacheService';

const router = Router();

// Очистка кэша
router.delete('/cache/clear', (req, res) => {
  cacheService.clear();
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
});

// Статистика кэша
router.get('/cache/stats', (req, res) => {
  const stats = cacheService.getStats();
  res.json({
    success: true,
    data: stats
  });
});

export default router;