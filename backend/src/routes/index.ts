/**
 * API Routes Registration
 * Central route registration for the TAS annotation tool backend
 */

import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { videoRoutes } from './videos';
import { annotationRoutes } from './annotations';
import { labelRoutes } from './labels';
import { userRoutes } from './users';
import { performanceRoutes } from './performance';
import { adminRoutes } from './admin';
import { videoAssignmentRoutes } from './videoAssignments';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // API prefix
  await fastify.register(async function (fastify) {
    // Authentication routes (no auth required)
    await fastify.register(authRoutes, { prefix: '/auth' });

    // Video streaming route (no auth required - HTML5 video can't send auth headers)
    // Security: Video URLs are only accessible after login to get the video list
    await fastify.register(async function (fastify) {
      // Import streaming-specific routes
      const { videoStreamRoutes } = await import('./videos');
      await fastify.register(videoStreamRoutes, { prefix: '/videos' });
    });

    // Protected routes (require authentication)
    await fastify.register(async function (fastify) {
      // JWT authentication hook
      fastify.addHook('preHandler', async (request, reply) => {
        try {
          await request.jwtVerify();
        } catch (err) {
          reply.status(401).send({
            error: 'Unauthorized',
            message: 'Valid authentication token required'
          });
        }
      });

      // Register protected routes
      await fastify.register(videoRoutes, { prefix: '/videos' });
      await fastify.register(annotationRoutes, { prefix: '/annotations' });
      await fastify.register(labelRoutes, { prefix: '/labels' });
      await fastify.register(userRoutes, { prefix: '/users' });
      await fastify.register(performanceRoutes, { prefix: '/performance' });
      await fastify.register(adminRoutes, { prefix: '/admin' });
      await fastify.register(videoAssignmentRoutes, { prefix: '/video-assignments' });

    });
  }, { prefix: '/api' });
}