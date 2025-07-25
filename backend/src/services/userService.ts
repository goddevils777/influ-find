import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { User, UserSession } from '../models/User';
import { log } from '../utils/helpers';

export class UserService {
  private usersFile = path.join(__dirname, '../../data/users.json');
  private jwtSecret = 'your-secret-key-change-in-production';

  constructor() {
    this.ensureUsersFile();
  }

  private ensureUsersFile(): void {
    const dataDir = path.dirname(this.usersFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, JSON.stringify([]));
    }
  }

  private getUsers(): User[] {
    try {
      const data = fs.readFileSync(this.usersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      log(`Error reading users file: ${error}`, 'error');
      return [];
    }
  }

  private saveUsers(users: User[]): void {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
    } catch (error) {
      log(`Error saving users: ${error}`, 'error');
      throw error;
    }
  }

  async register(email: string, password: string, name: string): Promise<{ success: boolean, message: string, token?: string }> {
    try {
      const users = this.getUsers();
      
      // Проверяем существует ли пользователь
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        return { success: false, message: 'Пользователь с таким email уже существует' };
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);

      // Создаем нового пользователя
      const newUser: User = {
        id: this.generateUserId(),
        email,
        password: hashedPassword,
        name,
        createdAt: new Date(),
        instagramConnected: false,
        proxyConnected: false
      };

      users.push(newUser);
      this.saveUsers(users);

      // Создаем токен
      const token = this.generateToken(newUser);

      log(`✅ Пользователь зарегистрирован: ${email}`);
      return { success: true, message: 'Регистрация успешна', token };

    } catch (error) {
      log(`Error registering user: ${error}`, 'error');
      return { success: false, message: 'Ошибка регистрации' };
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean, message: string, token?: string, user?: UserSession }> {
    try {
      const users = this.getUsers();
      const user = users.find(u => u.email === email);

      if (!user) {
        return { success: false, message: 'Пользователь не найден' };
      }

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, message: 'Неверный пароль' };
      }

      // Создаем токен и сессию
      const token = this.generateToken(user);
      const userSession: UserSession = {
        userId: user.id,
        email: user.email,
        name: user.name,
        instagramConnected: user.instagramConnected,
        proxyConnected: user.proxyConnected
      };

      log(`✅ Пользователь вошел: ${email}`);
      return { success: true, message: 'Вход выполнен', token, user: userSession };

    } catch (error) {
      log(`Error logging in user: ${error}`, 'error');
      return { success: false, message: 'Ошибка входа' };
    }
  }

  verifyToken(token: string): UserSession | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  private generateToken(user: User): string {
    const userSession: UserSession = {
      userId: user.id,
      email: user.email,
      name: user.name,
      instagramConnected: user.instagramConnected,
      proxyConnected: user.proxyConnected
    };
    return jwt.sign(userSession, this.jwtSecret, { expiresIn: '30d' });
  }

  private generateUserId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }


  // Добавь эти методы в класс UserService (перед закрывающей скобкой):

  // Получить пользователя по ID
  async getUserById(userId: string): Promise<User | null> {
    try {
      const users = this.getUsers();
      const user = users.find(u => u.id === userId);
      return user || null;
    } catch (error) {
      log(`Error getting user by ID: ${error}`, 'error');
      return null;
    }
  }

  // Обновить статус Instagram подключения
  async updateInstagramStatus(userId: string, connected: boolean, username?: string): Promise<boolean> {
    try {
      const users = this.getUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        log(`User ${userId} not found for Instagram status update`, 'error');
        return false;
      }

      users[userIndex].instagramConnected = connected;
      if (username) {
        users[userIndex].instagramUsername = username;
      } else if (!connected) {
        delete users[userIndex].instagramUsername;
      }

      this.saveUsers(users);
      log(`✅ Instagram статус обновлен для пользователя ${userId}: ${connected ? 'подключен' : 'отключен'}`);
      return true;

    } catch (error) {
      log(`Error updating Instagram status: ${error}`, 'error');
      return false;
    }
  }

  // Обновить статус прокси подключения
  async updateProxyStatus(userId: string, connected: boolean, proxyConfig?: any): Promise<boolean> {
    try {
      const users = this.getUsers();
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        log(`User ${userId} not found for proxy status update`, 'error');
        return false;
      }

      users[userIndex].proxyConnected = connected;
      if (proxyConfig && connected) {
        users[userIndex].proxyConfig = proxyConfig;
      } else if (!connected) {
        delete users[userIndex].proxyConfig;
      }

      this.saveUsers(users);
      log(`✅ Прокси статус обновлен для пользователя ${userId}: ${connected ? 'подключен' : 'отключен'}`);
      return true;

    } catch (error) {
      log(`Error updating proxy status: ${error}`, 'error');
      return false;
    }
  }

  // Создать персональную папку для пользователя
  private ensureUserDirectory(userId: string): string {
    const userDir = path.join(__dirname, `../../data/users/${userId}`);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return userDir;
  }

  // Получить путь к файлу cookies Instagram для пользователя
  getInstagramCookiesPath(userId: string): string {
    const userDir = this.ensureUserDirectory(userId);
    return path.join(userDir, 'instagram_cookies.json');
  }
}