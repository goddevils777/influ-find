import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '../services/userService';
import { log } from '../utils/helpers';

const router = Router();
const userService = new UserService();

// Middleware для проверки токена
export const authenticateToken = (req: any, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Токен не предоставлен' });
  }

  const user = userService.verifyToken(token);
  if (!user) {
    return res.status(403).json({ success: false, message: 'Недействительный токен' });
  }

  req.user = user;
  next();
};

// Регистрация
router.post('/register', [
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен быть минимум 6 символов'),
  body('name').notEmpty().withMessage('Имя обязательно')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    const { email, password, name } = req.body;
    const result = await userService.register(email, password, name);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        token: result.token
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    log(`Registration error: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Вход
router.post('/login', [
  body('email').isEmail().withMessage('Некорректный email'),
  body('password').notEmpty().withMessage('Пароль обязателен')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Ошибки валидации',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const result = await userService.login(email, password);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        token: result.token,
        user: result.user
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    log(`Login error: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Проверка токена / получение текущего пользователя
router.get('/me', authenticateToken, (req: any, res: Response) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Выход (на клиенте просто удаляем токен)
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Выход выполнен'
  });
});

export default router;