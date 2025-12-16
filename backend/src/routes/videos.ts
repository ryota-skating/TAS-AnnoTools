/**
 * Video Routes
 * Handle video metadata, upload, and management
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger';
import { VideoCacheService } from '../services/videoCacheService';
import { videoAssignmentService } from '../services/videoAssignmentService';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stream video file with HTTP Range Request support (RFC 7233)
 * Enables efficient video seeking and partial content delivery
 */
async function streamVideoFile(
  request: FastifyRequest,
  reply: FastifyReply,
  videoPath: string
): Promise<void> {
  try {
    const stats = fs.statSync(videoPath);
    const fileSize = stats.size;
    const range = request.headers.range;

    if (range) {
      // Parse Range header (e.g., "bytes=0-1023")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Validate range
      if (start >= fileSize || end >= fileSize) {
        return reply.status(416).send({
          error: 'Range Not Satisfiable',
          message: `Requested range not satisfiable: ${range}`,
        });
      }

      // Create read stream for the requested range
      const stream = fs.createReadStream(videoPath, { start, end });

      // Set 206 Partial Content headers
      reply.status(206).headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': getVideoMimeType(videoPath),
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
      });

      logger.info('Streaming video with range', {
        file: path.basename(videoPath),
        range: `${start}-${end}/${fileSize}`,
        chunkSize,
        reqId: request.id,
      });

      return reply.send(stream);
    } else {
      // No range header - stream entire file
      const stream = fs.createReadStream(videoPath);

      reply.status(200).headers({
        'Content-Length': fileSize,
        'Content-Type': getVideoMimeType(videoPath),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
      });

      logger.info('Streaming entire video file', {
        file: path.basename(videoPath),
        size: fileSize,
        reqId: request.id,
      });

      return reply.send(stream);
    }
  } catch (error) {
    logger.error('Video streaming error', { error, path: videoPath });
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to stream video',
    });
  }
}

/**
 * Get MIME type based on video file extension
 */
function getVideoMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

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

      // Filter videos based on user assignments (unless Admin)
      let filteredVideos = availableVideos;
      const userRole = request.user?.role;
      const userId = request.user?.userId;

      if (userRole !== 'Admin' && userId) {
        try {
          const assignedFilenames = await videoAssignmentService.getAssignedVideos(
            userId,
            availableVideos.map(v => v.filename)
          );

          filteredVideos = availableVideos.filter(video =>
            assignedFilenames.includes(video.filename)
          );

          logger.info('Videos filtered by assignment', {
            userId,
            userRole,
            totalVideos: availableVideos.length,
            assignedVideos: filteredVideos.length,
            reqId: request.id
          });
        } catch (error) {
          logger.error('Failed to filter videos by assignment', { error, userId, reqId: request.id });
          // On error, return empty list for safety
          filteredVideos = [];
        }
      }

      return {
        videos: filteredVideos
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

      // Check access for non-Admin users
      const userRole = request.user?.role;
      const userId = request.user?.userId;

      if (userRole !== 'Admin' && userId) {
        try {
          const hasAccess = await videoAssignmentService.hasVideoAccess(userId, id);

          if (!hasAccess) {
            logger.warn('Unauthorized video access attempt', {
              userId,
              userRole,
              videoId: id,
              reqId: request.id
            });

            return reply.status(403).send({
              error: 'Forbidden',
              message: 'You do not have access to this video'
            });
          }
        } catch (error) {
          logger.error('Failed to check video access', { error, userId, videoId: id, reqId: request.id });
          return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Failed to verify video access'
          });
        }
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

/**
 * Video streaming routes (no authentication required)
 * Separate from main videoRoutes to bypass JWT authentication
 * HTML5 video elements cannot send Authorization headers
 */
export async function videoStreamRoutes(fastify: FastifyInstance) {
  /**
   * Stream video file with HTTP Range Request support
   * Path: GET /videos/stream/optimized/:filename
   * Supports partial content (206) for efficient seeking
   */
  fastify.get<{
    Params: { filename: string };
  }>('/stream/optimized/:filename', async (request, reply) => {
    const { filename } = request.params;
    const videosDir = path.join(__dirname, '../../videos');
    const videoPath = path.join(videosDir, 'optimized', filename);

    logger.info('Video stream request', {
      filename,
      ip: request.ip,
    });

    // Validate file existence
    if (!fs.existsSync(videoPath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Video file not found',
      });
    }

    // Validate file extension
    const ext = path.extname(filename).toLowerCase();
    if (!['.mp4', '.webm', '.mov'].includes(ext)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Unsupported video format',
      });
    }

    // Stream the video with range support
    return streamVideoFile(request, reply, videoPath);
  });
}