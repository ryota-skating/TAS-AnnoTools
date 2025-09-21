/**
 * Authentication Middleware
 * JWT token verification and user context setup
 */

import { FastifyInstance } from 'fastify';
import { securityLogger } from '../utils/logger';

// Extend Fastify's request and instance interfaces
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireRole: (role: string) => (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

export async function setupAuthMiddleware(fastify: FastifyInstance) {
  // Register JWT authentication decorator
  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      securityLogger.logUnauthorizedAccess(request.url, request.ip, request.id);
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      });
    }
  });

  // Role-based access control decorator
  fastify.decorate('requireRole', (requiredRole: string) => {
    return async function (request: any, reply: any) {
      if (!request.user || request.user.role !== requiredRole) {
        securityLogger.logUnauthorizedAccess(request.url, request.ip, request.id);
        reply.status(403).send({
          error: 'Forbidden',
          message: `${requiredRole} role required`
        });
      }
    };
  });

  // Admin-only decorator
  fastify.decorate('requireAdmin', async function (request: any, reply: any) {
    if (!request.user || request.user.role !== 'Admin') {
      securityLogger.logUnauthorizedAccess(request.url, request.ip, request.id);
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin role required'
      });
    }
  });
}