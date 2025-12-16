/**
 * FS-AnnoTools3 Backend Server
 * TAS annotation tool API server with frame-precise video annotation support
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { config } from './config/config';
import { logger } from './utils/logger';
import { setupDatabase } from './services/database';
import { registerRoutes } from './routes';
import { setupAuthMiddleware } from './middleware/auth';
import { VideoCacheService } from './services/videoCacheService';

import path from 'path';

const fastify = Fastify({
  logger: false, // Using winston instead
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
});

async function start() {
  try {
    // Register plugins
    await fastify.register(cors, {
      origin: async (origin, cb) => {
        try {
          // originがundefinedの場合(Postmanなど)
          if (!origin) return true;

          const hostname = new URL(origin).hostname;

          // localhostを許可
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return true;
          }

          // Cloudflareトンネル (*.trycloudflare.com) を許可
          if (/\.trycloudflare\.com$/.test(hostname)) {
            return true;
          }

          // それ以外は拒否
          logger.warn(`CORS blocked: ${origin}`);
          return false;
        } catch (err) {
          logger.warn(`Invalid origin: ${origin}`);
          return false;
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    await fastify.register(jwt, {
      secret: config.jwt.secret,
      sign: {
        expiresIn: config.jwt.expiresIn,
      },
    });

    await fastify.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
    });

    await fastify.register(multipart);
    await fastify.register(websocket);

    // Static files for video serving - serve both original and optimized videos
    await fastify.register(staticFiles, {
      root: path.join(__dirname, '../videos'),
      prefix: '/videos/',
      decorateReply: false,
    });

    // Database setup
    await setupDatabase();
    logger.info('Database initialized successfully');

    // Preload video metadata cache for optimal performance with multiple clients
    const cacheService = VideoCacheService.getInstance();
    await cacheService.initialize();
    await cacheService.preloadAllVideoMetadata();
    logger.info('Video metadata cache preloaded successfully');

    // Setup authentication middleware
    await setupAuthMiddleware(fastify);

    // Register API routes
    await registerRoutes(fastify);

    // Health check
    fastify.get('/health', async () => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: require('../package.json').version,
      };
    });

    // Error handler
    fastify.setErrorHandler(async (error, request, reply) => {
      logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
        reqId: request.id,
      });

      return reply.status(error.statusCode || 500).send({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        reqId: request.id,
      });
    });

    // Start server
    const address = await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`🚀 FS-AnnoTools3 Backend Server started at ${address}`, {
      port: config.server.port,
      host: config.server.host,
      env: process.env.NODE_ENV,
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        await fastify.close();
        logger.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason,
    promise,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

start();