/**
 * Authentication Routes
 * Handle user login, logout, and token management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { database } from '../services/database';
import { config } from '../config/config';
import { logger, securityLogger } from '../utils/logger';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginAttempt {
  username: string;
  ip_address: string;
  attempt_time: string;
  success: boolean;
}

export async function authRoutes(fastify: FastifyInstance) {
  // Rate limiting for login attempts
  const loginRateLimit = new Map<string, { attempts: number; blockedUntil?: number }>();

  // Helper function to check rate limiting
  async function checkRateLimit(username: string, ip: string): Promise<boolean> {
    const key = `${username}:${ip}`;
    const now = Date.now();
    const record = loginRateLimit.get(key);

    if (record?.blockedUntil && record.blockedUntil > now) {
      return false; // Still blocked
    }

    // Check recent attempts in database
    const recentAttempts = await database.all<LoginAttempt>(`
      SELECT * FROM login_attempts 
      WHERE username = ? AND attempt_time > datetime('now', '-10 minutes')
      AND success = 0
      ORDER BY attempt_time DESC
    `, [username]);

    if (recentAttempts.length >= config.auth.loginAttempts.max) {
      // Block for 10 minutes
      const blockedUntil = now + config.auth.loginAttempts.blockDurationMs;
      loginRateLimit.set(key, { attempts: recentAttempts.length, blockedUntil });
      
      securityLogger.logLoginBlock(ip, undefined);
      return false;
    }

    return true;
  }

  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1 },
          password: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    const { username, password } = request.body;
    const ip = request.ip;

    try {
      // Check rate limiting
      const canAttempt = await checkRateLimit(username, ip);
      if (!canAttempt) {
        securityLogger.logLoginBlock(ip, request.id);
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Too many login attempts. Please try again later.'
        });
      }

      // Find user
      const user = await database.get(`
        SELECT id, name, username, email, role, password_hash, is_active
        FROM users 
        WHERE username = ? AND is_active = 1
      `, [username]);

      let loginSuccess = false;

      if (user && user.password_hash) {
        // Verify password
        loginSuccess = await bcrypt.compare(password, user.password_hash);
      }

      // Log attempt
      await database.run(`
        INSERT INTO login_attempts (username, ip_address, success, user_agent)
        VALUES (?, ?, ?, ?)
      `, [username, ip, loginSuccess ? 1 : 0, request.headers['user-agent'] || '']);

      securityLogger.logLoginAttempt(user?.id || 'unknown', ip, loginSuccess, request.id);

      if (!loginSuccess) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid username or password'
        });
      }

      // Update last login
      await database.run(`
        UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [user.id]);

      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        reqId: request.id
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role
        }
      };

    } catch (error) {
      logger.error('Login error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An error occurred during login'
      });
    }
  });

  // Get current user info
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const user = await database.get(`
        SELECT id, name, username, email, role, created_at, last_login_at
        FROM users 
        WHERE id = ? AND is_active = 1
      `, [request.user.userId]);

      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at
        }
      };

    } catch (error) {
      logger.error('Get user info error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user information'
      });
    }
  });

  // Refresh token
  fastify.post('/refresh', {
    preHandler: [fastify.authenticate]
  }, async (request: any, reply: FastifyReply) => {
    try {
      // Generate new token with same payload
      const token = fastify.jwt.sign({
        userId: request.user.userId,
        username: request.user.username,
        email: request.user.email,
        role: request.user.role
      });

      return {
        success: true,
        token
      };

    } catch (error) {
      logger.error('Token refresh error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to refresh token'
      });
    }
  });

  // Logout (client-side only, JWT is stateless)
  fastify.post('/logout', {
    preHandler: [fastify.authenticate]
  }, async (request: any, reply: FastifyReply) => {
    logger.info('User logged out', {
      userId: request.user.userId,
      reqId: request.id
    });

    return {
      success: true,
      message: 'Logged out successfully'
    };
  });

  // Cleanup rate limit records periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of loginRateLimit.entries()) {
      if (record.blockedUntil && record.blockedUntil <= now) {
        loginRateLimit.delete(key);
      }
    }
  }, 60000); // Every minute
}