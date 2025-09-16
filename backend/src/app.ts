import dotenv from 'dotenv';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { StatusCodes } from 'http-status-codes';
import { PrismaClient } from '@prisma/client';
import logger from './utils/logger';
import { errorHandler, notFound } from './middleware/error.middleware';
import { rateLimiter, authLimiter, apiLimiter } from './middleware/rate-limit.middleware';
import { serveFile } from './utils/fileUpload';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

// Debug log important environment variables
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***REDACTED***' : 'Not set');

// Import routes
import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';
import storeRoutes from './routes/store.routes';
import testRoutes from './routes/test.routes';
import otpRoutes from './routes/otp.routes';
import shopifyRoutes from './routes/shopify.routes';
import dataSyncRoutes from './routes/data-sync.routes';

// Initialize Prisma Client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security headers
    this.app.use(helmet());

    // Enable CORS (flexible for dev)
    // Support both FRONTEND_URL and FRONTEND_BASE_URL (comma-separated list allowed)
    const rawOrigins = [process.env.FRONTEND_URL, process.env.FRONTEND_BASE_URL]
      .filter(Boolean)
      .join(',');
    const configuredOrigins = rawOrigins
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const devOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];
    const allowList = configuredOrigins.length > 0 ? configuredOrigins : devOrigins;

    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow non-browser or same-origin requests (like Postman) where origin may be undefined
          if (!origin) return callback(null, true);
          if (allowList.includes(origin)) return callback(null, true);
          // In dev, be permissive for any localhost:* origin
          if ((process.env.NODE_ENV || 'development') === 'development' && /^(http:\/\/)?(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
            return callback(null, true);
          }
          // Allow Vercel preview and production domains
          try {
            const url = new URL(origin);
            const host = url.host;
            if (host.endsWith('.vercel.app')) {
              return callback(null, true);
            }
          } catch (_) {
            // ignore parse errors
          }
          // In production, fail gracefully with 403 instead of throwing 500
          return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: StatusCodes.NO_CONTENT,
      })
    );

    // Handle CORS preflight early to avoid auth middleware blocking OPTIONS
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'OPTIONS') {
        return res.sendStatus(StatusCodes.NO_CONTENT);
      }
      next();
    });

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Parse cookies
    this.app.use(cookieParser());

    // Serve static files
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

    // Logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`${req.method} ${req.originalUrl}`);
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint (no rate limiting)
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.status(StatusCodes.OK).json({
        status: 'ok',
        message: 'Service is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });
    });

    // File serving route
    this.app.get('/api/files/*', (req: Request, res: Response) => {
      serveFile(req, res);
    });

    // API routes with rate limiting
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/tenants', tenantRoutes);
    this.app.use('/api/stores', storeRoutes);
    this.app.use('/api/otp', otpRoutes);
    this.app.use('/api/shopify', shopifyRoutes);
    this.app.use('/api/sync', dataSyncRoutes);

    // Test routes only in development
    if ((process.env.NODE_ENV || 'development') === 'development') {
      this.app.use('/api/test', testRoutes);
    }

    // 404 handler for API routes
    this.app.all('/api/*', (req: Request, res: Response) => {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'API endpoint not found',
      });
    });

    // Serve frontend in production
    if (process.env.NODE_ENV === 'production') {
      const frontendPath = path.join(__dirname, '../../frontend/.next');
      this.app.use(express.static(frontendPath));
      
      // Handle SPA routing
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    }

    // 404 handler for all other routes
    this.app.use(notFound);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async connectToDatabase(): Promise<void> {
    try {
      await prisma.$connect();
      logger.info('Successfully connected to the database');
      
      // Apply database migrations
      await this.runMigrations();
    } catch (error) {
      logger.error('Error connecting to the database:', error);
      process.exit(1);
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      // In a production environment, you would run migrations here
      // For development, we'll use Prisma's migrate dev command
      if (process.env.NODE_ENV === 'development') {
        const { execSync } = require('child_process');
        execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
      }
    } catch (error) {
      logger.error('Error running migrations:', error);
      throw error;
    }
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      logger.info(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`API Documentation: http://localhost:${port}/api-docs`);
    });
  }
}

// Create and start the server
const app = new App();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  // In production, you might want to restart the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  // In production, you might want to restart the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Connect to the database and start the server
app.connectToDatabase()
  .then(() => {
    app.start(PORT);
  })
  .catch((error) => {
    logger.error('Failed to start the server:', error);
    process.exit(1);
  });

export default app;
