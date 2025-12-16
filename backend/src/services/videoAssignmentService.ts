/**
 * Video Assignment Service
 * Manages user-video assignments with pattern matching
 */

import { Database } from './database';
import { logger } from '../utils/logger';
import type { VideoAssignment, ParsedVideo, AssignmentPattern } from '../../../shared/types/videoAssignment';

export class VideoAssignmentService {
  private get database() {
    return Database.getInstance();
  }
  /**
   * Parse video filename into components
   * Format: {Competition}_{Gender}_SP#{Number}_{Name}.mp4
   * Example: Olympic_Men_SP#01_MONTOYA_Felipe.mp4
   */
  parseVideoFilename(filename: string): ParsedVideo | null {
    const regex = /^(Olympic|World)_(Men|Women)_SP#(\d+)_(.+)\.mp4$/;
    const match = filename.match(regex);

    if (!match) {
      return null;
    }

    return {
      competition: match[1] as 'Olympic' | 'World',
      gender: match[2] as 'Men' | 'Women',
      number: parseInt(match[3], 10),
      name: match[4],
      filename: filename
    };
  }

  /**
   * Check if a video matches an assignment pattern
   */
  matchesPattern(video: ParsedVideo, assignment: AssignmentPattern): boolean {
    // Check competition filter
    if (assignment.competition && video.competition !== assignment.competition) {
      return false;
    }

    // Check gender filter
    if (assignment.gender && video.gender !== assignment.gender) {
      return false;
    }

    // Check number range
    if (assignment.numberStart !== undefined && video.number < assignment.numberStart) {
      return false;
    }

    if (assignment.numberEnd !== undefined && video.number > assignment.numberEnd) {
      return false;
    }

    return true;
  }

  /**
   * Get all assignments for a user
   */
  async getUserAssignments(userId: string): Promise<VideoAssignment[]> {
    try {
      const rows = await this.database.all<any>(
        `SELECT * FROM video_assignments WHERE user_id = ?`,
        [userId]
      );

      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        assignmentType: row.assignment_type,
        competition: row.competition,
        gender: row.gender,
        numberStart: row.number_start,
        numberEnd: row.number_end,
        videoFilename: row.video_filename,
        createdAt: row.created_at,
        createdBy: row.created_by,
        notes: row.notes
      }));
    } catch (error) {
      logger.error('Failed to get user assignments', { userId, error });
      throw error;
    }
  }

  /**
   * Get all video filenames assigned to a user
   */
  async getAssignedVideos(userId: string, allVideos: string[]): Promise<string[]> {
    try {
      const assignments = await this.getUserAssignments(userId);

      if (assignments.length === 0) {
        return [];
      }

      const assignedVideos: Set<string> = new Set();

      for (const assignment of assignments) {
        if (assignment.assignmentType === 'explicit') {
          // Explicit assignment: direct filename
          if (assignment.videoFilename && allVideos.includes(assignment.videoFilename)) {
            assignedVideos.add(assignment.videoFilename);
          }
        } else {
          // Pattern assignment: match against all videos
          const pattern: AssignmentPattern = {
            competition: assignment.competition,
            gender: assignment.gender,
            numberStart: assignment.numberStart,
            numberEnd: assignment.numberEnd
          };

          for (const videoFilename of allVideos) {
            const parsed = this.parseVideoFilename(videoFilename);
            if (parsed && this.matchesPattern(parsed, pattern)) {
              assignedVideos.add(videoFilename);
            }
          }
        }
      }

      return Array.from(assignedVideos);
    } catch (error) {
      logger.error('Failed to get assigned videos', { userId, error });
      throw error;
    }
  }

  /**
   * Check if a user has access to a specific video
   */
  async hasVideoAccess(userId: string, videoFilename: string): Promise<boolean> {
    try {
      const assignments = await this.getUserAssignments(userId);

      if (assignments.length === 0) {
        return false;
      }

      for (const assignment of assignments) {
        if (assignment.assignmentType === 'explicit') {
          // Explicit assignment: exact match
          if (assignment.videoFilename === videoFilename) {
            return true;
          }
        } else {
          // Pattern assignment: match pattern
          const parsed = this.parseVideoFilename(videoFilename);
          if (!parsed) {
            continue;
          }

          const pattern: AssignmentPattern = {
            competition: assignment.competition,
            gender: assignment.gender,
            numberStart: assignment.numberStart,
            numberEnd: assignment.numberEnd
          };

          if (this.matchesPattern(parsed, pattern)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check video access', { userId, videoFilename, error });
      throw error;
    }
  }

  /**
   * Create a new video assignment
   */
  async createAssignment(assignment: Omit<VideoAssignment, 'id' | 'createdAt'>): Promise<VideoAssignment> {
    try {
      const id = `assign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createdAt = new Date().toISOString();

      await this.database.run(
        `INSERT INTO video_assignments (
          id, user_id, assignment_type, competition, gender,
          number_start, number_end, video_filename, created_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          assignment.userId,
          assignment.assignmentType,
          assignment.competition || null,
          assignment.gender || null,
          assignment.numberStart || null,
          assignment.numberEnd || null,
          assignment.videoFilename || null,
          assignment.createdBy,
          assignment.notes || null
        ]
      );

      logger.info('Video assignment created', { id, userId: assignment.userId });

      return {
        ...assignment,
        id,
        createdAt
      };
    } catch (error) {
      logger.error('Failed to create assignment', { assignment, error });
      throw error;
    }
  }

  /**
   * Update an existing video assignment
   */
  async updateAssignment(id: string, updates: Partial<Omit<VideoAssignment, 'id' | 'userId' | 'createdAt' | 'createdBy'>>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.assignmentType !== undefined) {
        fields.push('assignment_type = ?');
        values.push(updates.assignmentType);
      }
      if (updates.competition !== undefined) {
        fields.push('competition = ?');
        values.push(updates.competition);
      }
      if (updates.gender !== undefined) {
        fields.push('gender = ?');
        values.push(updates.gender);
      }
      if (updates.numberStart !== undefined) {
        fields.push('number_start = ?');
        values.push(updates.numberStart);
      }
      if (updates.numberEnd !== undefined) {
        fields.push('number_end = ?');
        values.push(updates.numberEnd);
      }
      if (updates.videoFilename !== undefined) {
        fields.push('video_filename = ?');
        values.push(updates.videoFilename);
      }
      if (updates.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updates.notes);
      }

      if (fields.length === 0) {
        return;
      }

      values.push(id);

      await this.database.run(
        `UPDATE video_assignments SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      logger.info('Video assignment updated', { id });
    } catch (error) {
      logger.error('Failed to update assignment', { id, updates, error });
      throw error;
    }
  }

  /**
   * Delete a video assignment
   */
  async deleteAssignment(id: string): Promise<void> {
    try {
      await this.database.run('DELETE FROM video_assignments WHERE id = ?', [id]);
      logger.info('Video assignment deleted', { id });
    } catch (error) {
      logger.error('Failed to delete assignment', { id, error });
      throw error;
    }
  }

  /**
   * Get all assignments (Admin only)
   */
  async getAllAssignments(): Promise<VideoAssignment[]> {
    try {
      const rows = await this.database.all<any>(`SELECT * FROM video_assignments ORDER BY created_at DESC`);

      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        assignmentType: row.assignment_type,
        competition: row.competition,
        gender: row.gender,
        numberStart: row.number_start,
        numberEnd: row.number_end,
        videoFilename: row.video_filename,
        createdAt: row.created_at,
        createdBy: row.created_by,
        notes: row.notes
      }));
    } catch (error) {
      logger.error('Failed to get all assignments', { error });
      throw error;
    }
  }

  /**
   * Delete all assignments for a user
   */
  async deleteUserAssignments(userId: string): Promise<void> {
    try {
      await this.database.run('DELETE FROM video_assignments WHERE user_id = ?', [userId]);
      logger.info('All assignments deleted for user', { userId });
    } catch (error) {
      logger.error('Failed to delete user assignments', { userId, error });
      throw error;
    }
  }
}

// Export singleton instance
export const videoAssignmentService = new VideoAssignmentService();
