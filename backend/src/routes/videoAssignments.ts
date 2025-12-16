/**
 * Video Assignment Routes (Admin only)
 * Manage user-video assignments
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';
import { videoAssignmentService } from '../services/videoAssignmentService';
import { Database } from '../services/database';

export async function videoAssignmentRoutes(fastify: FastifyInstance) {
  // All routes require Admin role
  fastify.addHook('onRequest', async (request: any, reply: FastifyReply) => {
    if (!request.user || request.user.role !== 'Admin') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }
  });

  /**
   * Get all assignments
   * GET /api/video-assignments
   */
  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
      const assignments = await videoAssignmentService.getAllAssignments();

      logger.info('Retrieved all assignments', {
        count: assignments.length,
        adminId: request.user.userId,
        reqId: request.id
      });

      return {
        assignments
      };
    } catch (error) {
      logger.error('Failed to get all assignments', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve assignments'
      });
    }
  });

  /**
   * Get assignments for a specific user
   * GET /api/video-assignments/user/:userId
   */
  fastify.get('/user/:userId', async (request: any, reply: FastifyReply) => {
    try {
      const { userId } = request.params;
      const assignments = await videoAssignmentService.getUserAssignments(userId);

      logger.info('Retrieved user assignments', {
        userId,
        count: assignments.length,
        adminId: request.user.userId,
        reqId: request.id
      });

      return {
        assignments
      };
    } catch (error) {
      logger.error('Failed to get user assignments', {
        error,
        userId: request.params.userId,
        reqId: request.id
      });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve user assignments'
      });
    }
  });

  /**
   * Preview assigned videos for a user
   * GET /api/video-assignments/preview/:userId
   */
  fastify.get('/preview/:userId', async (request: any, reply: FastifyReply) => {
    try {
      const { userId } = request.params;

      // Get all available videos from optimized directory
      const fs = require('fs');
      const path = require('path');
      const videosDir = path.join(__dirname, '../../videos/optimized');

      if (!fs.existsSync(videosDir)) {
        return {
          videos: [],
          message: 'Videos directory not found'
        };
      }

      const allVideoFiles = fs.readdirSync(videosDir)
        .filter((file: string) => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.webm', '.mov'].includes(ext);
        });

      const assignedVideos = await videoAssignmentService.getAssignedVideos(
        userId,
        allVideoFiles
      );

      logger.info('Generated assignment preview', {
        userId,
        totalVideos: allVideoFiles.length,
        assignedVideos: assignedVideos.length,
        adminId: request.user.userId,
        reqId: request.id
      });

      return {
        userId,
        totalAvailableVideos: allVideoFiles.length,
        assignedVideos,
        assignedCount: assignedVideos.length
      };
    } catch (error) {
      logger.error('Failed to generate assignment preview', {
        error,
        userId: request.params.userId,
        reqId: request.id
      });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate preview'
      });
    }
  });

  /**
   * Create new assignment(s)
   * POST /api/video-assignments
   * Body: CreateAssignmentRequest or CreateAssignmentRequest[]
   */
  fastify.post('/', async (request: any, reply: FastifyReply) => {
    try {
      const body = request.body;
      const adminId = request.user.userId;

      // Support both single assignment and array of assignments
      const assignments = Array.isArray(body) ? body : [body];

      const created = [];
      for (const assignmentData of assignments) {
        const assignment = await videoAssignmentService.createAssignment({
          ...assignmentData,
          createdBy: adminId
        });
        created.push(assignment);
      }

      logger.info('Assignments created', {
        count: created.length,
        adminId,
        reqId: request.id
      });

      return {
        assignments: created,
        count: created.length
      };
    } catch (error) {
      logger.error('Failed to create assignments', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create assignments'
      });
    }
  });

  /**
   * Update an assignment
   * PUT /api/video-assignments/:id
   */
  fastify.put('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const updates = request.body;

      await videoAssignmentService.updateAssignment(id, updates);

      logger.info('Assignment updated', {
        id,
        adminId: request.user.userId,
        reqId: request.id
      });

      return {
        success: true,
        message: 'Assignment updated successfully'
      };
    } catch (error) {
      logger.error('Failed to update assignment', {
        error,
        id: request.params.id,
        reqId: request.id
      });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update assignment'
      });
    }
  });

  /**
   * Delete an assignment
   * DELETE /api/video-assignments/:id
   */
  fastify.delete('/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      await videoAssignmentService.deleteAssignment(id);

      logger.info('Assignment deleted', {
        id,
        adminId: request.user.userId,
        reqId: request.id
      });

      return {
        success: true,
        message: 'Assignment deleted successfully'
      };
    } catch (error) {
      logger.error('Failed to delete assignment', {
        error,
        id: request.params.id,
        reqId: request.id
      });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete assignment'
      });
    }
  });

  /**
   * Delete all assignments for a user
   * DELETE /api/video-assignments/user/:userId
   */
  fastify.delete('/user/:userId', async (request: any, reply: FastifyReply) => {
    try {
      const { userId } = request.params;

      await videoAssignmentService.deleteUserAssignments(userId);

      logger.info('All user assignments deleted', {
        userId,
        adminId: request.user.userId,
        reqId: request.id
      });

      return {
        success: true,
        message: 'All assignments deleted for user'
      };
    } catch (error) {
      logger.error('Failed to delete user assignments', {
        error,
        userId: request.params.userId,
        reqId: request.id
      });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete user assignments'
      });
    }
  });

  /**
   * Bulk setup endpoint
   * POST /api/video-assignments/bulk-setup
   * Body: Array of { usernames: string[], patterns: {...}[] }
   */
  fastify.post('/bulk-setup', async (request: any, reply: FastifyReply) => {
    try {
      const bulkSetup = request.body; // Array of BulkAssignmentSetup
      const adminId = request.user.userId;

      const database = Database.getInstance();

      const createdAssignments = [];

      for (const setup of bulkSetup) {
        const { usernames, patterns } = setup;

        for (const username of usernames) {
          // Lookup user ID by username
          const user = await database.get(
            'SELECT id FROM users WHERE username = ?',
            [username]
          );

          if (!user) {
            logger.warn('User not found for bulk assignment', { username });
            continue;
          }

          // Create assignments for each pattern
          for (const pattern of patterns) {
            const assignment = await videoAssignmentService.createAssignment({
              userId: user.id,
              assignmentType: 'pattern',
              competition: pattern.competition,
              gender: pattern.gender,
              numberStart: pattern.start,
              numberEnd: pattern.end,
              createdBy: adminId,
              notes: `Bulk setup for ${username}: ${pattern.competition} ${pattern.gender} #${pattern.start}-${pattern.end}`
            });

            createdAssignments.push(assignment);
          }
        }
      }

      logger.info('Bulk assignments created', {
        count: createdAssignments.length,
        groups: bulkSetup.length,
        adminId,
        reqId: request.id
      });

      return {
        success: true,
        assignments: createdAssignments,
        count: createdAssignments.length
      };
    } catch (error) {
      logger.error('Failed to create bulk assignments', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create bulk assignments'
      });
    }
  });
}
