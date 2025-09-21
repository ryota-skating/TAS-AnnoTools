/**
 * Annotation API Routes
 * Frame-by-frame video annotation data management for multiple users
 */

import { FastifyInstance } from 'fastify';
import { AnnotationService } from '../services/annotationService';
import { logger } from '../utils/logger';

interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface InitializeAnnotationRequest {
  Params: {
    videoFilename: string;
  };
}

interface LoadAnnotationRequest {
  Params: {
    videoFilename: string;
  };
}

interface UpdateFrameRequest {
  Params: {
    videoFilename: string;
  };
  Body: {
    frameIndex: number;
    label: string;
  };
}

interface BatchUpdateRequest {
  Params: {
    videoFilename: string;
  };
  Body: {
    labels: string[];
  };
}

interface AnnotationStatsRequest {
  Params: {
    videoFilename: string;
  };
}

export async function annotationRoutes(fastify: FastifyInstance) {
  const annotationService = AnnotationService.getInstance();

  /**
   * Initialize annotation file for a video
   * POST /api/annotations/:videoFilename/initialize
   */
  fastify.post<InitializeAnnotationRequest>('/:videoFilename/initialize', async (request, reply) => {
    try {
      const { videoFilename } = request.params;
      const user = request.user as AuthenticatedUser;

      logger.info(`Initializing annotation for video: ${videoFilename}`, {
        service: 'annotation-api',
        username: user.username,
        videoFilename
      });

      const annotationData = await annotationService.initializeAnnotationFile(user.username, videoFilename);

      return {
        success: true,
        data: annotationData,
        message: `Annotation file initialized for ${videoFilename}`
      };
    } catch (error) {
      logger.error(`Failed to initialize annotation: ${request.params.videoFilename}`, {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        videoFilename: request.params.videoFilename,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to initialize annotation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Load annotation data for a video
   * GET /api/annotations/:videoFilename
   */
  fastify.get<LoadAnnotationRequest>('/:videoFilename', async (request, reply) => {
    try {
      const { videoFilename } = request.params;
      const user = request.user as AuthenticatedUser;

      logger.info(`Loading annotation for video: ${videoFilename}`, {
        service: 'annotation-api',
        username: user.username,
        videoFilename
      });

      const annotationData = await annotationService.loadAnnotationData(user.username, videoFilename);

      return {
        success: true,
        data: annotationData
      };
    } catch (error) {
      logger.error(`Failed to load annotation: ${request.params.videoFilename}`, {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        videoFilename: request.params.videoFilename,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to load annotation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Update annotation for a specific frame
   * PUT /api/annotations/:videoFilename/frame
   */
  fastify.put<UpdateFrameRequest>('/:videoFilename/frame', async (request, reply) => {
    try {
      const { videoFilename } = request.params;
      const { frameIndex, label } = request.body;
      const user = request.user as AuthenticatedUser;

      logger.info(`Updating frame annotation: ${videoFilename} frame ${frameIndex}`, {
        service: 'annotation-api',
        username: user.username,
        videoFilename,
        frameIndex,
        label
      });

      const annotationData = await annotationService.updateFrameAnnotation(
        user.username,
        videoFilename,
        frameIndex,
        label
      );

      return {
        success: true,
        data: annotationData,
        message: `Frame ${frameIndex} updated to "${label}"`
      };
    } catch (error) {
      logger.error(`Failed to update frame annotation: ${request.params.videoFilename}`, {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        videoFilename: request.params.videoFilename,
        frameIndex: request.body?.frameIndex,
        label: request.body?.label,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to update frame annotation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Batch update all annotations for a video
   * PUT /api/annotations/:videoFilename/batch
   */
  fastify.put<BatchUpdateRequest>('/:videoFilename/batch', async (request, reply) => {
    try {
      const { videoFilename } = request.params;
      const { labels } = request.body;
      const user = request.user as AuthenticatedUser;

      logger.info(`Batch updating annotations: ${videoFilename}`, {
        service: 'annotation-api',
        username: user.username,
        videoFilename,
        labelCount: labels.length
      });

      // Load current annotation data to get metadata
      const currentData = await annotationService.loadAnnotationData(user.username, videoFilename);
      
      // Update with new labels
      const updatedData = {
        ...currentData,
        labels,
        lastModified: new Date()
      };

      await annotationService.saveAnnotationData(updatedData);

      return {
        success: true,
        data: updatedData,
        message: `Batch updated ${labels.length} frame annotations`
      };
    } catch (error) {
      logger.error(`Failed to batch update annotations: ${request.params.videoFilename}`, {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        videoFilename: request.params.videoFilename,
        labelCount: request.body?.labels?.length,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to batch update annotations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get annotation statistics for a video
   * GET /api/annotations/:videoFilename/stats
   */
  fastify.get<AnnotationStatsRequest>('/:videoFilename/stats', async (request, reply) => {
    try {
      const { videoFilename } = request.params;
      const user = request.user as AuthenticatedUser;

      logger.info(`Getting annotation stats: ${videoFilename}`, {
        service: 'annotation-api',
        username: user.username,
        videoFilename
      });

      const stats = await annotationService.getAnnotationStats(user.username, videoFilename);

      return {
        success: true,
        data: {
          videoFilename,
          username: user.username,
          stats
        }
      };
    } catch (error) {
      logger.error(`Failed to get annotation stats: ${request.params.videoFilename}`, {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        videoFilename: request.params.videoFilename,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to get annotation statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * List all annotation files for current user
   * GET /api/annotations
   */
  fastify.get('/', async (request, reply) => {
    try {
      const user = request.user as AuthenticatedUser;

      logger.info('Listing user annotations', {
        service: 'annotation-api',
        username: user.username
      });

      const annotations = await annotationService.listUserAnnotations(user.username);

      return {
        success: true,
        data: {
          username: user.username,
          annotations
        }
      };
    } catch (error) {
      logger.error('Failed to list user annotations', {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to list annotations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Delete annotation file for a video
   * DELETE /api/annotations/:videoFilename
   */
  fastify.delete<LoadAnnotationRequest>('/:videoFilename', async (request, reply) => {
    try {
      const { videoFilename } = request.params;
      const user = request.user as AuthenticatedUser;

      logger.info(`Deleting annotation: ${videoFilename}`, {
        service: 'annotation-api',
        username: user.username,
        videoFilename
      });

      await annotationService.deleteAnnotation(user.username, videoFilename);

      return {
        success: true,
        message: `Annotation deleted for ${videoFilename}`
      };
    } catch (error) {
      logger.error(`Failed to delete annotation: ${request.params.videoFilename}`, {
        service: 'annotation-api',
        username: (request.user as AuthenticatedUser)?.username,
        videoFilename: request.params.videoFilename,
        error: error instanceof Error ? error.message : String(error)
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to delete annotation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('Annotation API routes registered', {
    service: 'annotation-api'
  });
}