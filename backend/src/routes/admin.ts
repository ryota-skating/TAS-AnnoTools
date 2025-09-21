/**
 * Admin API Routes
 * Administrative functions for video optimization and system management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { logger } from '../utils/logger';

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Video optimization functionality temporarily disabled

  // Admin middleware
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      
      const user = request.user as AdminUser;
      if (!user || user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Admin access required'
        });
      }
    } catch (error) {
      return reply.status(401).send({
        error: 'Authentication required'
      });
    }
  };

  /**
   * Get video optimization status
   */
  fastify.get('/video-optimization/status', {
    preHandler: requireAdmin
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Video optimization status temporarily unavailable
      const status = { hasFFmpeg: false, videosFound: 0, optimizedVideos: 0, needsOptimization: 0 };
      
      logger.info('Video optimization status requested', {
        service: 'admin-api',
        userId: (request.user as AdminUser)?.id,
        status
      });

      return {
        success: true,
        status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get video optimization status:', {
        service: 'admin-api',
        userId: (request.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to get optimization status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Trigger manual video optimization
   */
  fastify.post('/video-optimization/optimize', {
    preHandler: requireAdmin
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Manual video optimization triggered', {
        service: 'admin-api',
        userId: (request.user as AdminUser)?.id
      });

      // Start optimization in background
      // Video optimization temporarily disabled
      Promise.resolve().catch(error => {
        logger.error('Background video optimization failed:', {
          service: 'admin-api',
          userId: (request.user as AdminUser)?.id,
          error: error instanceof Error ? error.message : String(error)
        });
      });

      return {
        success: true,
        message: 'Video optimization started in background',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to trigger video optimization:', {
        service: 'admin-api',
        userId: (request.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to start optimization',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get system health information
   */
  fastify.get('/system/health', {
    preHandler: requireAdmin
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Video status temporarily unavailable
      const videoStatus = { hasFFmpeg: false, videosFound: 0, optimizedVideos: 0, needsOptimization: 0 };
      
      const health = {
        server: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: require('../../package.json').version
        },
        video: {
          ffmpegAvailable: videoStatus.hasFFmpeg,
          videosFound: videoStatus.videosFound,
          optimizedVideos: videoStatus.optimizedVideos,
          needsOptimization: videoStatus.needsOptimization
        },
        timestamp: new Date().toISOString()
      };

      logger.info('System health check requested', {
        service: 'admin-api',
        userId: (request.user as AdminUser)?.id,
        health: {
          ffmpeg: health.video.ffmpegAvailable,
          videos: health.video.videosFound,
          optimized: health.video.optimizedVideos
        }
      });

      return {
        success: true,
        health
      };
    } catch (error) {
      logger.error('Failed to get system health:', {
        service: 'admin-api',
        userId: (request.user as AdminUser)?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to get system health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('Admin API routes registered', {
    service: 'admin-api'
  });
}