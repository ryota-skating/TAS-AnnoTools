/**
 * Video Routes
 * Handle video metadata, upload, and management
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { VideoCacheService } from '../services/videoCacheService';
import * as fs from 'fs';
import * as path from 'path';

export async function videoRoutes(fastify: FastifyInstance) {
  /**
   * Get all available videos from optimized directory
   */
  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
      const videosDir = path.join(__dirname, '../../videos');
      const optimizedDir = path.join(videosDir, 'optimized');
      
      // Check if optimized directory exists
      if (!fs.existsSync(optimizedDir)) {
        logger.warn('Optimized videos directory not found', { 
          path: optimizedDir,
          service: 'video-api',
          reqId: request.id 
        });
        
        return {
          videos: [],
          message: 'No videos available in the server\'s video directory. Please contact your administrator to add video files to the server.'
        };
      }

      // Use cached video metadata for faster response
      const cacheService = VideoCacheService.getInstance();
      await cacheService.initialize();
      

      
      // Check which videos actually exist in the optimized directory
      const videoFiles = fs.readdirSync(optimizedDir)
        .filter((file: string) => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.webm', '.mov'].includes(ext);
        });

      const availableVideos = await Promise.all(
        videoFiles.map(async (filename: string) => {
          const filePath = path.join(optimizedDir, filename);
          const stats = fs.statSync(filePath);
          const baseName = path.parse(filename).name;
          
          // Try to get from cache first
          let cachedMetadata = await cacheService.getVideoMetadata(filename);
          
          if (cachedMetadata && cachedMetadata.lastOptimized >= stats.mtime.toISOString()) {
            // Use cached data if it's up to date
            const lastAnnotationUpdate = await cacheService.getLatestAnnotationTime(baseName.replace(/-optimized$/, ''));
            return {
              ...cachedMetadata,
              lastAnnotationUpdate
            };
          }
          
          // Fallback to basic metadata if cache is missing or outdated
          logger.warn('Using fallback metadata for video', { filename });
          const lastAnnotationUpdate = await cacheService.getLatestAnnotationTime(baseName.replace(/-optimized$/, ''));
          
          return {
            id: filename,
            title: baseName.replace(/-optimized$/, '').replace(/-optimized$/, '').replace(/-/g, ' '),
            filename: filename,
            path: `/videos/optimized/${filename}`,
            size: stats.size,
            fps: 30, // Default fallback
            durationFrames: 0, // Default fallback
            hash: null,
            createdAt: stats.mtime.toISOString(),
            lastAnnotationUpdate
          };
        })
      );

      logger.info('Video files found', { 
        count: availableVideos.length,
        files: videoFiles,
        service: 'video-api',
        reqId: request.id 
      });

      return {
        videos: availableVideos
      };
    } catch (error) {
      logger.error('Get videos error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get videos'
      });
    }
  });

  // Get video by ID (filename)
  fastify.get('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const videosDir = path.join(__dirname, '../../videos');
      const optimizedDir = path.join(videosDir, 'optimized');
      const videoPath = path.join(optimizedDir, id);
      
      if (!fs.existsSync(videoPath)) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Video not found'
        });
      }

      const stats = fs.statSync(videoPath);
      const baseName = path.parse(id).name;

      // Use cached video metadata
      const cacheService = VideoCacheService.getInstance();
      await cacheService.initialize();
      
      let cachedMetadata = await cacheService.getVideoMetadata(id);
      
      if (cachedMetadata && cachedMetadata.lastOptimized >= stats.mtime.toISOString()) {
        // Use cached data if it's up to date
        const lastAnnotationUpdate = await cacheService.getLatestAnnotationTime(baseName.replace(/-optimized$/, ''));
        return {
          video: {
            ...cachedMetadata,
            lastAnnotationUpdate
          }
        };
      }

      // Fallback to basic metadata if cache is missing or outdated
      logger.warn('Using fallback metadata for video', { id });
      const lastAnnotationUpdate = await cacheService.getLatestAnnotationTime(baseName.replace(/-optimized$/, ''));

      return {
        video: {
          id: id,
          title: baseName.replace(/-optimized$/, '').replace(/-optimized$/, '').replace(/-/g, ' '),
          filename: id,
          path: `/videos/optimized/${id}`,
          size: stats.size,
          fps: 30, // Default fallback
          durationFrames: 0, // Default fallback
          hash: null,
          createdAt: stats.mtime.toISOString(),
          lastAnnotationUpdate
        }
      };
    } catch (error) {
      logger.error('Get video error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get video'
      });
    }
  });

  // Upload/register new video (Admin only)
  fastify.post('/', {
    preHandler: async (request: any, reply: FastifyReply) => {
      if (request.user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required'
        });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      // TODO: Implement video upload logic
      // This is a placeholder for video registration/upload functionality
      
      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'Video upload functionality will be implemented in phase 2'
      });
    } catch (error) {
      logger.error('Upload video error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to upload video'
      });
    }
  });

  // Update video metadata (Admin only)
  fastify.put('/:id', {
    preHandler: async (request: any, reply: FastifyReply) => {
      if (request.user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required'
        });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      // TODO: Implement video metadata update
      
      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'Video update functionality will be implemented in phase 2'
      });
    } catch (error) {
      logger.error('Update video error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update video'
      });
    }
  });

  // Delete video (Admin only)
  fastify.delete('/:id', {
    preHandler: async (request: any, reply: FastifyReply) => {
      if (request.user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required'
        });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      // TODO: Implement video deletion
      
      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'Video deletion functionality will be implemented in phase 2'
      });
    } catch (error) {
      logger.error('Delete video error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete video'
      });
    }
  });
}