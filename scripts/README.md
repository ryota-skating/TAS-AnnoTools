# Video Optimization for FS-AnnoTools3

This directory contains scripts for optimizing videos for WebCodecs-based frame-precise annotation.

## Directory Structure

```
backend/videos/
├── original/           # Place original video files here
├── optimized/          # Optimized videos for annotation (auto-generated)
├── sample.mp4         # Symlink to optimized/sample.mp4
└── sample-video.mp4   # Symlink to optimized/sample.mp4 (for compatibility)
```

## Video Optimization Script (Bash)

### Usage

```bash
# Show help
./scripts/optimize-videos.sh --help

# Default optimization (annotation preset)
./scripts/optimize-videos.sh

# Preview preset (fast, low quality for quick preview)
./scripts/optimize-videos.sh preview

# Archive preset (high quality for archival)
./scripts/optimize-videos.sh archive
```

### Quality Presets

| Preset | Resolution | CRF | GOP | Use Case |
|--------|------------|-----|-----|----------|
| `preview` | 854x480 | 28 | 15 | Quick preview, fast processing |
| `annotation` | 1280px max | 23 | 30 | Balanced quality for annotation work (default) |
| `archive` | Original | 18 | 30 | High quality archival storage |

### Optimization Settings

The script optimizes videos for **WebCodecs frame-precise annotation** with:

- **H.264/AVC codec** (WebCodecs compatible)
- **High Profile Level 4.0** (quality + compatibility)
- **No B-frames** (`-bf 0`) - Maximum seek performance
- **Constant 30fps** - Frame-precise navigation
- **Dynamic GOP structure**: 15/30 frames based on preset
- **Resolution scaling**: Automatic 1280px width limit (annotation preset)
- **MP4 + faststart** - Web streaming optimized
- **AAC audio** - Web compatible
- **WebCodecs optimizations**: `tune=film`, minimal reference frames

### Requirements

- FFmpeg with libx264 support
- Bash shell

### How It Works

1. **Input**: Looks for videos in `backend/videos/original/` directory
2. **Analysis**: Intelligent GOP and resolution detection
3. **Processing**: Applies preset-based optimization settings
4. **Output**: Saves to `backend/videos/optimized/` with simplified naming
5. **Cache**: Automatically generates video metadata cache
6. **Integration**: Application serves videos from `optimized/` directory

### Supported Formats

Input: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`
Output: `.mp4` (H.264 + AAC)

## Video Metadata Generation

### Usage

```bash
# Generate metadata for a specific video
node scripts/generate-video-metadata.js backend/videos/optimized/video.mp4

# Metadata is automatically generated after optimization
```

### Generated Cache

- **Location**: `backend/cache/video-metadata.json`
- **Contents**: Video dimensions, FPS, duration, file size, timestamps
- **Purpose**: Fast video selection without FFprobe analysis

## User Management

### Usage

```bash
# Add new user
npx ts-node scripts/manage-users.ts add username password

# List users
npx ts-node scripts/manage-users.ts list

# Delete user
npx ts-node scripts/manage-users.ts delete username
```

## Cache Testing

### Usage

```bash
# Test cache system functionality
node scripts/test-cache-creation.js
```

Validates video metadata cache and annotation cache structure.

## Adding New Videos

1. Place original video files in `backend/videos/original/`
2. Run the optimization script:
   ```bash
   ./scripts/optimize-videos.sh annotation
   ```
3. The application will automatically detect optimized videos
4. Video metadata cache is generated automatically

## Performance Optimization Tips

### For Frame-Precise Annotation
- Use `annotation` preset (default) - balanced quality with 1280px scaling
- GOP30 ensures keyframes every second for precise seeking
- No B-frames eliminate decode dependencies

### For Quick Preview
- Use `preview` preset - 854x480 resolution, GOP15 for faster seeking
- Lower CRF (28) reduces file size significantly

### For Archival Storage
- Use `archive` preset - original resolution with CRF18 for maximum quality

## Verification

Check optimization results:
```bash
ffprobe -v quiet -print_format json -show_streams backend/videos/optimized/your-video.mp4 | \
  jq '.streams[0] | {codec_name, profile, has_b_frames, r_frame_rate, width, height}'
```

Expected output (annotation preset):
```json
{
  "codec_name": "h264",
  "profile": "High", 
  "has_b_frames": 0,
  "r_frame_rate": "30/1",
  "width": 1280,
  "height": 720
}
```

## Troubleshooting

### FFmpeg Not Found
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

### Permission Issues
```bash
chmod +x scripts/optimize-videos.sh
```

### Large File Sizes
- Use `preview` preset for smaller files
- Check original video resolution - files >1920px are automatically scaled down in `annotation` preset