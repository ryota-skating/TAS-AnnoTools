/**
 * Video Optimizer Service
 * Auto-optimizes videos on server startup for frame-precise playback
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export class VideoOptimizerService {
  private readonly scriptsDir: string;
  private readonly videosDir: string;
  private readonly originalDir: string;
  private readonly optimizedDir: string;

  constructor() {
    this.scriptsDir = path.resolve(__dirname, '../../../scripts');
    this.videosDir = path.resolve(__dirname, '../videos');
    this.originalDir = path.join(this.videosDir, 'original');
    this.optimizedDir = path.join(this.videosDir, 'optimized');
  }

  /**
   * Check if video optimization is needed
   */
  private async needsOptimization(): Promise<boolean> {
    try {
      // Check if there are any original videos
      if (!fs.existsSync(this.originalDir)) {
        return false;
      }

      const originalFiles = fs.readdirSync(this.originalDir)
        .filter(file => /\.(mp4|mov|avi|mkv)$/i.test(file));

      if (originalFiles.length === 0) {
        return false;
      }

      // Check if optimized versions exist
      for (const file of originalFiles) {
        const baseName = path.parse(file).name;
        const optimizedFile = path.join(this.optimizedDir, `${baseName}-optimized.mp4`);
        
        if (!fs.existsSync(optimizedFile)) {
          logger.info(`Missing optimized version for: ${file}`, {
            service: 'video-optimizer',
            file,
            optimizedPath: optimizedFile
          });
          return true;
        }

        // Check if original is newer than optimized
        const originalStats = fs.statSync(path.join(this.originalDir, file));
        const optimizedStats = fs.statSync(optimizedFile);
        
        if (originalStats.mtime > optimizedStats.mtime) {
          logger.info(`Original video is newer than optimized: ${file}`, {
            service: 'video-optimizer',
            file,
            originalModified: originalStats.mtime,
            optimizedModified: optimizedStats.mtime
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking optimization needs:', {
        service: 'video-optimizer',
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Check if FFmpeg is available
   */
  private async checkFFmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      
      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });
      
      ffmpeg.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Run the optimization script
   */
  private async runOptimizationScript(): Promise<void> {
    const scriptPath = path.join(this.scriptsDir, 'optimize-videos.js');
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Optimization script not found: ${scriptPath}`);
    }

    return new Promise((resolve, reject) => {
      logger.info('Starting video optimization...', {
        service: 'video-optimizer',
        scriptPath
      });

      const optimizer = spawn('node', [scriptPath], {
        cwd: this.scriptsDir,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      optimizer.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log progress in real-time
        output.split('\n').filter((line: string) => line.trim()).forEach((line: string) => {
          logger.info(`[Optimizer] ${line}`, {
            service: 'video-optimizer'
          });
        });
      });

      optimizer.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Log errors but don't fail immediately (FFmpeg uses stderr for progress)
        if (!output.includes('time=') && !output.includes('frame=')) {
          logger.warn(`[Optimizer] ${output}`, {
            service: 'video-optimizer'
          });
        }
      });

      optimizer.on('close', (code) => {
        if (code === 0) {
          logger.info('Video optimization completed successfully', {
            service: 'video-optimizer',
            exitCode: code
          });
          resolve();
        } else {
          const error = new Error(`Video optimization failed with exit code ${code}`);
          logger.error('Video optimization failed', {
            service: 'video-optimizer',
            exitCode: code,
            stdout: stdout.slice(-500), // Last 500 chars
            stderr: stderr.slice(-500)
          });
          reject(error);
        }
      });

      optimizer.on('error', (error) => {
        logger.error('Failed to start video optimizer:', {
          service: 'video-optimizer',
          error: error.message
        });
        reject(error);
      });
    });
  }

  /**
   * Initialize video optimization on server startup
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing video optimizer service...', {
        service: 'video-optimizer'
      });

      // Check if FFmpeg is available
      const hasFFmpeg = await this.checkFFmpeg();
      if (!hasFFmpeg) {
        logger.warn('FFmpeg not found. Video optimization will be skipped.', {
          service: 'video-optimizer',
          message: 'Install FFmpeg to enable automatic video optimization'
        });
        return;
      }

      logger.info('FFmpeg found, checking for videos to optimize...', {
        service: 'video-optimizer'
      });

      // Check if optimization is needed
      const needsOpt = await this.needsOptimization();
      if (!needsOpt) {
        logger.info('No video optimization needed', {
          service: 'video-optimizer'
        });
        return;
      }

      logger.info('Video optimization required, starting process...', {
        service: 'video-optimizer'
      });

      // Run optimization in background
      await this.runOptimizationScript();

      logger.info('Video optimizer service initialized successfully', {
        service: 'video-optimizer'
      });

    } catch (error) {
      logger.error('Failed to initialize video optimizer service:', {
        service: 'video-optimizer',
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Don't throw - video optimization failure shouldn't prevent server startup
      logger.warn('Server will continue without video optimization', {
        service: 'video-optimizer'
      });
    }
  }

  /**
   * Get optimization status
   */
  public async getOptimizationStatus(): Promise<{
    hasFFmpeg: boolean;
    videosFound: number;
    optimizedVideos: number;
    needsOptimization: boolean;
  }> {
    try {
      const hasFFmpeg = await this.checkFFmpeg();
      const needsOpt = await this.needsOptimization();
      
      const originalFiles = fs.existsSync(this.originalDir) 
        ? fs.readdirSync(this.originalDir).filter(f => /\.(mp4|mov|avi|mkv)$/i.test(f))
        : [];
      
      const optimizedFiles = fs.existsSync(this.optimizedDir)
        ? fs.readdirSync(this.optimizedDir).filter(f => f.endsWith('-optimized.mp4'))
        : [];

      return {
        hasFFmpeg,
        videosFound: originalFiles.length,
        optimizedVideos: optimizedFiles.length,
        needsOptimization: needsOpt
      };
    } catch (error) {
      logger.error('Error getting optimization status:', {
        service: 'video-optimizer',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        hasFFmpeg: false,
        videosFound: 0,
        optimizedVideos: 0,
        needsOptimization: false
      };
    }
  }

  /**
   * Manually trigger optimization
   */
  public async triggerOptimization(): Promise<void> {
    logger.info('Manual video optimization triggered', {
      service: 'video-optimizer'
    });

    const hasFFmpeg = await this.checkFFmpeg();
    if (!hasFFmpeg) {
      throw new Error('FFmpeg not found. Please install FFmpeg to use video optimization.');
    }

    await this.runOptimizationScript();
  }
}