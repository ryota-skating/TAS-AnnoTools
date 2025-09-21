/**
 * Annotation Service
 * Manages frame-by-frame annotation data for multiple users
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { VideoAnalyzer } from './videoAnalyzer';
import { VideoCacheService } from './videoCacheService';

interface AnnotationData {
  videoFilename: string;
  username: string;
  frameCount: number;
  labels: string[];
  lastModified: Date;
}

export class AnnotationService {
  private static instance: AnnotationService;
  private annotationsDir: string;
  private videoAnalyzer: VideoAnalyzer;

  constructor() {
    this.annotationsDir = path.join(process.cwd(), 'annotations');
    this.videoAnalyzer = VideoAnalyzer.getInstance();
  }

  public static getInstance(): AnnotationService {
    if (!AnnotationService.instance) {
      AnnotationService.instance = new AnnotationService();
    }
    return AnnotationService.instance;
  }

  /**
   * Get annotation file path for a user and video
   */
  private getAnnotationFilePath(username: string, videoFilename: string): string {
    // Remove extension from video filename and add .txt
    const baseFilename = path.parse(videoFilename).name;
    return path.join(this.annotationsDir, username, `${baseFilename}.txt`);
  }

  /**
   * Get video file path in optimized directory
   */
  private getVideoFilePath(videoFilename: string): string {
    // Remove duplicate .mp4 extensions if present (e.g., sample.mp4.mp4 -> sample.mp4)
    let cleanFilename = videoFilename;
    while (cleanFilename.endsWith('.mp4.mp4')) {
      cleanFilename = cleanFilename.replace(/\.mp4\.mp4$/, '.mp4');
    }
    return path.join(process.cwd(), 'videos/optimized', cleanFilename);
  }

  /**
   * Ensure user annotation directory exists
   */
  private async ensureUserDirectory(username: string): Promise<void> {
    const userDir = path.join(this.annotationsDir, username);
    try {
      await fs.access(userDir);
    } catch {
      await fs.mkdir(userDir, { recursive: true });
      logger.info(`Created annotation directory for user: ${username}`);
    }
  }

  /**
   * Initialize annotation file with all frames set to "NONE"
   */
  public async initializeAnnotationFile(username: string, videoFilename: string): Promise<AnnotationData> {
    try {
      const videoPath = this.getVideoFilePath(videoFilename);
      const frameCount = await this.videoAnalyzer.getFrameCount(videoPath);
      
      // Ensure user directory exists
      await this.ensureUserDirectory(username);
      
      // Create annotation file with all frames set to "NONE"
      const labels = Array(frameCount).fill('NONE');
      const annotationData: AnnotationData = {
        videoFilename,
        username,
        frameCount,
        labels,
        lastModified: new Date()
      };

      await this.saveAnnotationData(annotationData);
      
      logger.info(`Initialized annotation file: ${username}/${videoFilename} (${frameCount} frames)`, {
        service: 'annotation',
        username,
        videoFilename,
        frameCount
      });

      return annotationData;
    } catch (error) {
      logger.error(`Failed to initialize annotation file: ${username}/${videoFilename}`, { 
        error: error instanceof Error ? error.message : String(error),
        username,
        videoFilename
      });
      throw error;
    }
  }

  /**
   * Load annotation data for a user and video
   */
  public async loadAnnotationData(username: string, videoFilename: string): Promise<AnnotationData> {
    const annotationFilePath = this.getAnnotationFilePath(username, videoFilename);

    try {
      // Check if annotation file exists
      await fs.access(annotationFilePath);
      
      // Read and parse annotation file
      const content = await fs.readFile(annotationFilePath, 'utf-8');
      const labels = content.trim().split('\n').filter(line => line.length > 0);
      
      // Get file stats for last modified time
      const stats = await fs.stat(annotationFilePath);

      const annotationData: AnnotationData = {
        videoFilename,
        username,
        frameCount: labels.length,
        labels,
        lastModified: stats.mtime
      };

      logger.info(`Loaded annotation data: ${username}/${videoFilename} (${labels.length} frames)`, {
        service: 'annotation',
        username,
        videoFilename,
        frameCount: labels.length
      });

      return annotationData;
    } catch (error) {
      // If file doesn't exist, initialize it
      if ((error as any).code === 'ENOENT') {
        logger.info(`Annotation file not found, initializing: ${username}/${videoFilename}`);
        return await this.initializeAnnotationFile(username, videoFilename);
      }
      
      logger.error(`Failed to load annotation data: ${username}/${videoFilename}`, { 
        error: error instanceof Error ? error.message : String(error),
        username,
        videoFilename
      });
      throw error;
    }
  }

  /**
   * Save annotation data to file
   */
  public async saveAnnotationData(annotationData: AnnotationData): Promise<void> {
    const annotationFilePath = this.getAnnotationFilePath(annotationData.username, annotationData.videoFilename);

    try {
      // Ensure user directory exists
      await this.ensureUserDirectory(annotationData.username);
      
      // Write labels to file (one per line)
      const content = annotationData.labels.join('\n') + '\n';
      await fs.writeFile(annotationFilePath, content, 'utf-8');
      
      // Log file write operation for debugging
      console.log('File write operation:', {
        filePath: annotationFilePath,
        labelCount: annotationData.labels.length,
        contentLength: content.length,
        username: annotationData.username,
        videoFilename: annotationData.videoFilename
      });
      
      // Update annotation cache with latest update time
      const cacheService = VideoCacheService.getInstance();
      await cacheService.updateAnnotationTime(annotationData.videoFilename, annotationData.username);
      
      logger.info(`Saved annotation data: ${annotationData.username}/${annotationData.videoFilename} (${annotationData.labels.length} frames)`, {
        service: 'annotation',
        username: annotationData.username,
        videoFilename: annotationData.videoFilename,
        frameCount: annotationData.labels.length
      });
    } catch (error) {
      logger.error(`Failed to save annotation data: ${annotationData.username}/${annotationData.videoFilename}`, { 
        error: error instanceof Error ? error.message : String(error),
        username: annotationData.username,
        videoFilename: annotationData.videoFilename
      });
      throw error;
    }
  }

  /**
   * Update annotation for a specific frame
   */
  public async updateFrameAnnotation(username: string, videoFilename: string, frameIndex: number, label: string): Promise<AnnotationData> {
    const annotationData = await this.loadAnnotationData(username, videoFilename);

    // Validate frame index
    if (frameIndex < 0 || frameIndex >= annotationData.frameCount) {
      throw new Error(`Frame index out of range: ${frameIndex} (max: ${annotationData.frameCount - 1})`);
    }

    // Update the label
    annotationData.labels[frameIndex] = label;
    annotationData.lastModified = new Date();

    // Save the updated data
    await this.saveAnnotationData(annotationData);

    logger.info(`Updated frame annotation: ${username}/${videoFilename} frame ${frameIndex} -> ${label}`, {
      service: 'annotation',
      username,
      videoFilename,
      frameIndex,
      label
    });

    return annotationData;
  }

  /**
   * Get annotation statistics for a user and video
   */
  public async getAnnotationStats(username: string, videoFilename: string): Promise<{ [label: string]: number }> {
    const annotationData = await this.loadAnnotationData(username, videoFilename);
    
    const stats: { [label: string]: number } = {};
    
    for (const label of annotationData.labels) {
      stats[label] = (stats[label] || 0) + 1;
    }

    return stats;
  }

  /**
   * List all annotation files for a user
   */
  public async listUserAnnotations(username: string): Promise<string[]> {
    const userDir = path.join(this.annotationsDir, username);
    
    try {
      const files = await fs.readdir(userDir);
      return files.filter(file => file.endsWith('.txt')).map(file => file.replace('.txt', '.mp4'));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete annotation file for a user and video
   */
  public async deleteAnnotation(username: string, videoFilename: string): Promise<void> {
    const annotationFilePath = this.getAnnotationFilePath(username, videoFilename);

    try {
      await fs.unlink(annotationFilePath);
      logger.info(`Deleted annotation file: ${username}/${videoFilename}`, {
        service: 'annotation',
        username,
        videoFilename
      });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        logger.error(`Failed to delete annotation file: ${username}/${videoFilename}`, { 
          error: error instanceof Error ? error.message : String(error),
          username,
          videoFilename
        });
        throw error;
      }
    }
  }
}