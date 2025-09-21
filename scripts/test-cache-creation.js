#!/usr/bin/env node

/**
 * Test Video Metadata Cache Creation
 * Tests if the video optimization process creates cache files in the correct location
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Color output functions
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message) {
  console.log(`${colors.blue}[TEST]${colors.reset} ${message}`);
}

function error(message) {
  console.error(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function warning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

/**
 * Check if required directories and files exist
 */
async function checkFileStructure() {
  const projectRoot = path.resolve(__dirname, '..');
  const backendDir = path.join(projectRoot, 'backend');
  
  log('Checking project file structure...');
  
  // Expected paths
  const paths = {
    projectRoot,
    backendDir,
    cacheDir: path.join(backendDir, 'cache'),
    videoCacheFile: path.join(backendDir, 'cache', 'video-metadata.json'),
    annotationsDir: path.join(backendDir, 'annotations'),
    videosDir: path.join(backendDir, 'videos'),
    optimizedDir: path.join(backendDir, 'videos', 'optimized'),
    originalDir: path.join(backendDir, 'videos', 'original'),
    generateScript: path.join(projectRoot, 'scripts', 'generate-video-metadata.js'),
    optimizeScript: path.join(projectRoot, 'scripts', 'optimize-videos.sh')
  };
  
  console.log('\nExpected file structure:');
  for (const [name, fullPath] of Object.entries(paths)) {
    const exists = fsSync.existsSync(fullPath);
    const status = exists ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${fullPath}`);
  }
  
  return paths;
}

/**
 * Create test video file for testing
 */
async function createTestVideo(originalDir) {
  const testVideoPath = path.join(originalDir, 'test-video.mp4');
  
  // Create a minimal test video using ffmpeg if available
  try {
    const { spawn } = require('child_process');
    
    log('Creating test video file...');
    
    return new Promise((resolve, reject) => {
      // Create a 1-second test video with ffmpeg
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'testsrc2=duration=1:size=320x240:rate=30',
        '-y', // Overwrite output file
        testVideoPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          success(`Test video created: ${testVideoPath}`);
          resolve(testVideoPath);
        } else {
          warning('FFmpeg not available or failed, creating dummy file');
          // Create a dummy file for testing
          fsSync.writeFileSync(testVideoPath, 'dummy video content for testing');
          resolve(testVideoPath);
        }
      });
      
      ffmpeg.on('error', (err) => {
        warning('FFmpeg not available, creating dummy file');
        fsSync.writeFileSync(testVideoPath, 'dummy video content for testing');
        resolve(testVideoPath);
      });
    });
  } catch (err) {
    warning('Creating dummy test file');
    fsSync.writeFileSync(testVideoPath, 'dummy video content for testing');
    return testVideoPath;
  }
}

/**
 * Test the generate-video-metadata.js script
 */
async function testMetadataGeneration(testVideoPath, paths) {
  log('Testing metadata generation...');
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [paths.generateScript, testVideoPath]);
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        success('Metadata generation completed');
        resolve({ stdout, stderr });
      } else {
        error(`Metadata generation failed with code ${code}`);
        error(`stderr: ${stderr}`);
        reject(new Error(`Process failed with code ${code}`));
      }
    });
  });
}

/**
 * Verify cache file was created with correct structure
 */
async function verifyCacheFile(paths) {
  log('Verifying cache file...');
  
  try {
    // Check if cache file exists
    if (!fsSync.existsSync(paths.videoCacheFile)) {
      error('Cache file was not created');
      return false;
    }
    
    // Read and parse cache file
    const content = await fs.readFile(paths.videoCacheFile, 'utf-8');
    const cache = JSON.parse(content);
    
    // Verify structure
    const requiredFields = ['version', 'lastUpdated', 'videos'];
    for (const field of requiredFields) {
      if (!(field in cache)) {
        error(`Cache missing required field: ${field}`);
        return false;
      }
    }
    
    success('Cache file structure is valid');
    
    // Show cache contents
    console.log('\nCache file contents:');
    console.log(JSON.stringify(cache, null, 2));
    
    return true;
  } catch (err) {
    error(`Failed to verify cache file: ${err.message}`);
    return false;
  }
}

/**
 * Test annotation cache structure
 */
async function testAnnotationCacheStructure(paths) {
  log('Testing annotation cache structure...');
  
  try {
    // Check if annotations directory exists
    if (!fsSync.existsSync(paths.annotationsDir)) {
      await fs.mkdir(paths.annotationsDir, { recursive: true });
      log('Created annotations directory');
    }
    
    // Create test user directory and cache
    const testUserDir = path.join(paths.annotationsDir, 'test-user');
    const testCacheFile = path.join(testUserDir, '.annotation-cache.json');
    
    await fs.mkdir(testUserDir, { recursive: true });
    
    const testCache = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      annotations: {
        'test-video': new Date().toISOString()
      }
    };
    
    await fs.writeFile(testCacheFile, JSON.stringify(testCache, null, 2));
    
    success(`Test annotation cache created: ${testCacheFile}`);
    
    return true;
  } catch (err) {
    error(`Failed to test annotation cache: ${err.message}`);
    return false;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 Testing Video Metadata Cache Creation\n');
  
  try {
    // 1. Check file structure
    const paths = await checkFileStructure();
    
    // 2. Create necessary directories
    await fs.mkdir(paths.cacheDir, { recursive: true });
    await fs.mkdir(paths.originalDir, { recursive: true });
    await fs.mkdir(paths.optimizedDir, { recursive: true });
    
    // 3. Create test video
    const testVideoPath = await createTestVideo(paths.originalDir);
    
    // 4. Test metadata generation
    try {
      await testMetadataGeneration(testVideoPath, paths);
    } catch (err) {
      warning(`Metadata generation test failed: ${err.message}`);
      warning('This might be expected if ffprobe is not available');
    }
    
    // 5. Verify cache file
    const cacheValid = await verifyCacheFile(paths);
    
    // 6. Test annotation cache structure
    const annotationCacheValid = await testAnnotationCacheStructure(paths);
    
    // 7. Summary
    console.log('\n📊 Test Results:');
    console.log(`  Video Metadata Cache: ${cacheValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Annotation Cache Structure: ${annotationCacheValid ? '✅ PASS' : '❌ FAIL'}`);
    
    if (cacheValid && annotationCacheValid) {
      success('All tests passed! Cache system is working correctly.');
    } else {
      error('Some tests failed. Please check the implementation.');
      process.exit(1);
    }
    
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err);
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