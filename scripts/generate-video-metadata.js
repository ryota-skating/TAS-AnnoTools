#!/usr/bin/env node

/**
 * Generate Video Metadata Cache
 * Analyzes video files and updates the metadata cache
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Color output functions
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message) {
  console.log(`${colors.blue}[METADATA]${colors.reset} ${message}`);
}

function error(message) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
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
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }

      try {
        const metadata = JSON.parse(stdout);
        resolve(metadata);
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });
  });
}

/**
 * Extract relevant metadata for caching
 */
function extractVideoData(ffprobeData, videoPath) {
  const videoStream = ffprobeData.streams.find(stream => stream.codec_type === 'video');
  const format = ffprobeData.format;

  if (!videoStream) {
    throw new Error('No video stream found');
  }

  const filename = path.basename(videoPath);
  const baseName = path.parse(filename).name;
  const stats = require('fs').statSync(videoPath);

  // Calculate frame count and FPS
  const duration = parseFloat(format.duration) || 0;
  const fps = eval(videoStream.r_frame_rate) || 30; // r_frame_rate is like "30/1"
  const frameCount = Math.round(duration * fps);

  return {
    title: baseName.replace(/-optimized$/, '').replace(/-/g, ' '),
    filename: filename,
    path: `/videos/optimized/${filename}`,
    fps: Math.round(fps),
    durationFrames: frameCount,
    width: parseInt(videoStream.width) || 0,
    height: parseInt(videoStream.height) || 0,
    size: stats.size,
    hash: null, // Could add hash calculation later
    createdAt: stats.mtime.toISOString(),
    lastOptimized: new Date().toISOString()
  };
}

/**
 * Load existing cache or create new one
 */
async function loadCache(cachePath) {
  try {
    const content = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      videos: {}
    };
  }
}

/**
 * Save cache to disk
 */
async function saveCache(cachePath, cache) {
  const cacheDir = path.dirname(cachePath);
  await fs.mkdir(cacheDir, { recursive: true });
  
  cache.lastUpdated = new Date().toISOString();
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Main function
 */
async function main() {
  const videoPath = process.argv[2];
  
  if (!videoPath) {
    error('Usage: node generate-video-metadata.js <video-path>');
    process.exit(1);
  }

  if (!require('fs').existsSync(videoPath)) {
    error(`Video file not found: ${videoPath}`);
    process.exit(1);
  }

  const filename = path.basename(videoPath);
  const backendDir = path.resolve(__dirname, '..', 'backend');
  const cachePath = path.join(backendDir, 'cache', 'video-metadata.json');

  try {
    log(`Analyzing video: ${filename}`);
    
    // Get video metadata using ffprobe
    const ffprobeData = await getVideoMetadata(videoPath);
    const videoData = extractVideoData(ffprobeData, videoPath);
    
    // Load existing cache
    const cache = await loadCache(cachePath);
    
    // Update cache with new video data
    cache.videos[filename] = {
      id: filename,
      ...videoData
    };
    
    // Save updated cache
    await saveCache(cachePath, cache);
    
    success(`Metadata cached: ${filename} (${videoData.fps}fps, ${videoData.durationFrames} frames)`);
    
  } catch (err) {
    error(`Failed to generate metadata for ${filename}: ${err.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
  });
}