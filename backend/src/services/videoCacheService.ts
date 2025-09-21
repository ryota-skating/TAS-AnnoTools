/**
 * Video Cache Service
 * Manages cached video metadata to avoid expensive FFmpeg analysis on every request
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

interface CachedVideoMetadata {
  id: string;
  title: string;
  filename: string;
  path: string;
  fps: number;
  durationFrames: number;
  width: number;
  height: number;
  size: number;
  hash: string | null;
  createdAt: string;
  lastOptimized: string;
}

interface VideoCache {
  version: string;
  lastUpdated: string;
  videos: Record<string, CachedVideoMetadata>;
}

interface AnnotationCache {
  version: string;
  lastUpdated: string;
  annotations: Record<string, string>; // videoId -> lastAnnotationUpdate ISO string
}

interface UserAnnotationCache {
  [username: string]: AnnotationCache;
}

export class VideoCacheService {
  private static instance: VideoCacheService;
  private videoCachePath: string;
  private annotationsDir: string;
  private videoCache: VideoCache | null = null;
  private userAnnotationCaches: UserAnnotationCache = {};

  private constructor() {
    this.videoCachePath = path.join(__dirname, '../../cache/video-metadata.json');
    this.annotationsDir = path.join(__dirname, '../../annotations');
  }

  public static getInstance(): VideoCacheService {
    if (!VideoCacheService.instance) {
      VideoCacheService.instance = new VideoCacheService();
    }
    return VideoCacheService.instance;
  }

  /**
   * Initialize cache directory
   */
  public async initialize(): Promise<void> {
    const cacheDir = path.dirname(this.videoCachePath);
    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create cache directory', { error });
    }
  }

  /**
   * Load video metadata cache from disk
   */
  public async loadVideoCache(): Promise<VideoCache> {
    if (this.videoCache) {
      return this.videoCache!;
    }

    try {
      const content = await fs.readFile(this.videoCachePath, 'utf-8');
      this.videoCache = JSON.parse(content);
      logger.info('Video metadata cache loaded', { videoCount: Object.keys(this.videoCache!.videos).length });
    } catch (error) {
      logger.info('No existing video cache found, creating new one');
      this.videoCache = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        videos: {}
      };
    }

    return this.videoCache!;
  }

  /**
   * Load annotation cache for a specific user
   */
  public async loadUserAnnotationCache(username: string): Promise<AnnotationCache> {
    if (this.userAnnotationCaches[username]) {
      return this.userAnnotationCaches[username];
    }

    const userCachePath = path.join(this.annotationsDir, username, '.annotation-cache.json');

    try {
      const content = await fs.readFile(userCachePath, 'utf-8');
      this.userAnnotationCaches[username] = JSON.parse(content);
      logger.info('User annotation cache loaded', { 
        username, 
        annotationCount: Object.keys(this.userAnnotationCaches[username].annotations).length 
      });
    } catch (error) {
      logger.info('No existing annotation cache found for user, creating new one', { username });
      this.userAnnotationCaches[username] = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        annotations: {}
      };
    }

    return this.userAnnotationCaches[username];
  }

  /**
   * Save video metadata cache to disk
   */
  public async saveVideoCache(): Promise<void> {
    if (!this.videoCache) {
      return;
    }

    try {
      this.videoCache.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.videoCachePath, JSON.stringify(this.videoCache, null, 2));
      logger.info('Video metadata cache saved');
    } catch (error) {
      logger.error('Failed to save video cache', { error });
    }
  }

  /**
   * Save annotation cache for a specific user
   */
  public async saveUserAnnotationCache(username: string): Promise<void> {
    const cache = this.userAnnotationCaches[username];
    if (!cache) {
      return;
    }

    const userCachePath = path.join(this.annotationsDir, username, '.annotation-cache.json');

    try {
      // Ensure user directory exists
      const userDir = path.dirname(userCachePath);
      await fs.mkdir(userDir, { recursive: true });

      cache.lastUpdated = new Date().toISOString();
      await fs.writeFile(userCachePath, JSON.stringify(cache, null, 2));
      logger.info('User annotation cache saved', { username });
    } catch (error) {
      logger.error('Failed to save user annotation cache', { error, username });
    }
  }

  /**
   * Update video metadata in cache
   */
  public async updateVideoMetadata(videoId: string, metadata: Omit<CachedVideoMetadata, 'id'>): Promise<void> {
    const cache = await this.loadVideoCache();
    cache.videos[videoId] = {
      id: videoId,
      ...metadata
    };
    await this.saveVideoCache();
  }

  /**
   * Get video metadata from cache
   */
  public async getVideoMetadata(videoId: string): Promise<CachedVideoMetadata | null> {
    const cache = await this.loadVideoCache();
    return cache.videos[videoId] || null;
  }

  /**
   * Get all cached video metadata
   */
  public async getAllVideoMetadata(): Promise<CachedVideoMetadata[]> {
    const cache = await this.loadVideoCache();
    return Object.values(cache.videos);
  }

  /**
   * Update annotation last update time for a specific user
   */
  public async updateAnnotationTime(videoId: string, username: string): Promise<void> {
    const cache = await this.loadUserAnnotationCache(username);
    cache.annotations[videoId] = new Date().toISOString();
    await this.saveUserAnnotationCache(username);
  }

  /**
   * Get annotation last update time for a specific user
   */
  public async getAnnotationTime(videoId: string, username: string): Promise<string | null> {
    const cache = await this.loadUserAnnotationCache(username);
    return cache.annotations[videoId] || null;
  }

  /**
   * Get the latest annotation update time across all users for a video
   */
  public async getLatestAnnotationTime(videoId: string): Promise<string | null> {
    try {
      const userDirs = await fs.readdir(this.annotationsDir);
      let latestTime: string | null = null;

      for (const userDir of userDirs) {
        const userPath = path.join(this.annotationsDir, userDir);
        const stat = await fs.stat(userPath);
        
        if (stat.isDirectory()) {
          try {
            const userTime = await this.getAnnotationTime(videoId, userDir);
            if (userTime && (!latestTime || userTime > latestTime)) {
              latestTime = userTime;
            }
          } catch (error) {
            // User cache doesn't exist or error loading, continue
          }
        }
      }

      return latestTime;
    } catch (error) {
      logger.error('Failed to get latest annotation time', { error, videoId });
      return null;
    }
  }

  /**
   * Remove video from cache
   */
  public async removeVideoMetadata(videoId: string): Promise<void> {
    const videoCache = await this.loadVideoCache();
    delete videoCache.videos[videoId];
    await this.saveVideoCache();

    // Remove from all user annotation caches
    try {
      const userDirs = await fs.readdir(this.annotationsDir);
      for (const userDir of userDirs) {
        const userPath = path.join(this.annotationsDir, userDir);
        const stat = await fs.stat(userPath);
        
        if (stat.isDirectory()) {
          try {
            const cache = await this.loadUserAnnotationCache(userDir);
            delete cache.annotations[videoId];
            await this.saveUserAnnotationCache(userDir);
          } catch (error) {
            // User cache doesn't exist, continue
          }
        }
      }
    } catch (error) {
      logger.error('Failed to remove video from user caches', { error, videoId });
    }
  }

  /**
   * Clear all caches
   */
  public async clearCaches(): Promise<void> {
    this.videoCache = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      videos: {}
    };
    
    this.userAnnotationCaches = {};

    await this.saveVideoCache();

    // Clear all user annotation caches
    try {
      const userDirs = await fs.readdir(this.annotationsDir);
      for (const userDir of userDirs) {
        const userPath = path.join(this.annotationsDir, userDir);
        const stat = await fs.stat(userPath);
        
        if (stat.isDirectory()) {
          this.userAnnotationCaches[userDir] = {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            annotations: {}
          };
          await this.saveUserAnnotationCache(userDir);
        }
      }
    } catch (error) {
      logger.error('Failed to clear user annotation caches', { error });
    }
  }
}