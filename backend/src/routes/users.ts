/**
 * User Routes
 * Handle user management and administration
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { database } from '../services/database';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users (Admin only)
  fastify.get('/', {
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
      const users = await database.all(`
        SELECT id, name, email, role, created_at, last_login_at, is_active
        FROM users
        ORDER BY created_at DESC
      `);

      return {
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at,
          isActive: user.is_active === 1
        }))
      };
    } catch (error) {
      logger.error('Get users error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get users'
      });
    }
  });

  // Get user by ID
  fastify.get('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // Users can only access their own data, unless they are Admin
      if (request.user.role !== 'Admin' && request.user.userId !== id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      const user = await database.get(`
        SELECT id, name, email, role, created_at, last_login_at, is_active
        FROM users
        WHERE id = ?
      `, [id]);

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
          email: user.email,
          role: user.role,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at,
          isActive: user.is_active === 1
        }
      };
    } catch (error) {
      logger.error('Get user error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user'
      });
    }
  });

  // Create new user (Admin only)
  fastify.post('/', {
    preHandler: async (request: any, reply: FastifyReply) => {
      if (request.user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required'
        });
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'role', 'password'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['Admin', 'Annotator', 'Viewer'] },
          password: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { name, email, role, password } = request.body;
      
      // Check if email already exists
      const existingUser = await database.get(`
        SELECT id FROM users WHERE email = ?
      `, [email]);

      if (existingUser) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already exists'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
      
      // Generate user ID
      const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create user
      await database.run(`
        INSERT INTO users (id, name, email, role, password_hash)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, name, email, role, passwordHash]);

      logger.info('User created', {
        userId,
        email,
        role,
        createdBy: request.user.userId,
        reqId: request.id
      });

      return {
        success: true,
        user: {
          id: userId,
          name,
          email,
          role
        }
      };
    } catch (error) {
      logger.error('Create user error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create user'
      });
    }
  });

  // Update user (Admin or self)
  fastify.put('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { name, email, role, password } = request.body;
      
      // Check permissions
      const isAdmin = request.user.role === 'Admin';
      const isSelf = request.user.userId === id;
      
      if (!isAdmin && !isSelf) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied'
        });
      }

      // Non-admin users cannot change their role
      if (!isAdmin && role && role !== request.user.role) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot change your own role'
        });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }

      if (email) {
        updates.push('email = ?');
        values.push(email);
      }

      if (role && isAdmin) {
        updates.push('role = ?');
        values.push(role);
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
        updates.push('password_hash = ?');
        values.push(passwordHash);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No valid fields to update'
        });
      }

      values.push(id);
      
      await database.run(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
      `, values);

      logger.info('User updated', {
        userId: id,
        updatedBy: request.user.userId,
        fields: updates,
        reqId: request.id
      });

      return {
        success: true,
        message: 'User updated successfully'
      };
    } catch (error) {
      logger.error('Update user error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user'
      });
    }
  });

  // Deactivate user (Admin only)
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
      const { id } = request.params;
      
      // Don't allow deleting yourself
      if (request.user.userId === id) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot deactivate your own account'
        });
      }

      await database.run(`
        UPDATE users SET is_active = 0 WHERE id = ?
      `, [id]);

      logger.info('User deactivated', {
        userId: id,
        deactivatedBy: request.user.userId,
        reqId: request.id
      });

      return {
        success: true,
        message: 'User deactivated successfully'
      };
    } catch (error) {
      logger.error('Deactivate user error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to deactivate user'
      });
    }
  });
}