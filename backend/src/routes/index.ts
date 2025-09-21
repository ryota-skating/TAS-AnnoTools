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

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // API prefix
  await fastify.register(async function (fastify) {
    // Authentication routes (no auth required)
    await fastify.register(authRoutes, { prefix: '/auth' });

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

    });
  }, { prefix: '/api' });
}