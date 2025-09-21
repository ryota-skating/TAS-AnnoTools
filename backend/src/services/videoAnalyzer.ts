/**
 * Video Analysis Service
 * Provides video metadata analysis for annotation system
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

interface VideoMetadata {
  filename: string;
  duration: number;
  frameCount: number;
  frameRate: number;
  width: number;
  height: number;
}

export class VideoAnalyzer {
  private static instance: VideoAnalyzer;
  private cache: Map<string, VideoMetadata> = new Map();

  public static getInstance(): VideoAnalyzer {
    if (!VideoAnalyzer.instance) {
      VideoAnalyzer.instance = new VideoAnalyzer();
    }
    return VideoAnalyzer.instance;
  }

  /**
   * Get video metadata using ffprobe
   */
  public async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    const absolutePath = path.resolve(videoPath);
    
    // Check cache first
    const cacheKey = `${absolutePath}:${this.getFileModTime(absolutePath)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Verify file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Video file not found: ${absolutePath}`);
    }

    try {
      logger.info(`Analyzing video: ${path.basename(videoPath)}`);
      
      const metadata = await this.analyzeWithFFprobe(absolutePath);
      
      // Cache the result
      this.cache.set(cacheKey, metadata);
      
      logger.info(`Video analysis complete: ${metadata.frameCount} frames, ${metadata.frameRate}fps`);
      return metadata;

    } catch (error) {
      logger.error(`Failed to analyze video: ${videoPath}`, { error });
      throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get frame count for a video (convenience method)
   */
  public async getFrameCount(videoPath: string): Promise<number> {
    const metadata = await this.getVideoMetadata(videoPath);
    return metadata.frameCount;
  }

  /**
   * Analyze video with ffprobe
   */
  private async analyzeWithFFprobe(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        '-select_streams', 'v:0',
        videoPath
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const probeData = JSON.parse(stdout);
          const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video');
          
          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          const duration = parseFloat(probeData.format.duration);
          const frameRate = this.parseFrameRate(videoStream.r_frame_rate);
          const frameCount = parseInt(videoStream.nb_frames) || Math.ceil(duration * frameRate);

          const metadata: VideoMetadata = {
            filename: path.basename(videoPath),
            duration,
            frameCount,
            frameRate,
            width: parseInt(videoStream.width),
            height: parseInt(videoStream.height)
          };

          resolve(metadata);
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`ffprobe spawn error: ${error.message}`));
      });
    });
  }

  /**
   * Parse frame rate from ffprobe format (e.g., "30/1" -> 30)
   */
  private parseFrameRate(frameRateStr: string): number {
    if (!frameRateStr) return 30; // default

    const [numerator, denominator = '1'] = frameRateStr.split('/');
    return parseInt(numerator) / parseInt(denominator);
  }

  /**
   * Get file modification time for caching
   */
  private getFileModTime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Video metadata cache cleared');
  }
}