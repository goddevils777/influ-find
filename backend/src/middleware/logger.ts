import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
  
  // Логируем тело запроса для POST запросов (без чувствительных данных)
  if (method === 'POST' && req.body) {
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = '[HIDDEN]';
    console.log(`[${timestamp}] Request body:`, safeBody);
  }
  
  next();
};

export const errorLogger = (error: any, req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR ${req.method} ${req.url}:`, error.message);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp
  });
};