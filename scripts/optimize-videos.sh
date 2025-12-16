#!/bin/bash

# FS-AnnoTools3 Video Optimization Script
# Optimizes videos for frame-precise playback with resolution scaling and GOP30 encoding
#
# Usage: ./scripts/optimize-videos.sh [preset]
# Presets:
#   preview    - Fast, low quality (854x480, CRF28, GOP15) for quick preview
#   annotation - Balanced quality (1280px max, CRF23, GOP30) for annotation work
#   archive    - High quality (original resolution, CRF18, GOP30) for archival
#
# Default preset: annotation

# set -e

# Parse command-line arguments
FORCE_REPROCESS=false
SKIP_EXISTING=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            echo "FS-AnnoTools3 Video Optimization Script"
            echo ""
            echo "Usage: $0 [options] [preset]"
            echo ""
            echo "Available presets:"
            echo "  preview    - Fast, low quality (854x480, CRF28, GOP15) for quick preview"
            echo "  annotation - Balanced quality (1280px max, CRF23, GOP30) for annotation work (default)"
            echo "  archive    - High quality (original resolution, CRF18, GOP30) for archival"
            echo ""
            echo "Options:"
            echo "  --force           - Force reprocessing of all videos (ignore existing files)"
            echo "  --skip-existing   - Skip videos that already have optimized versions"
            echo "  -h, --help        - Show this help message"
            echo ""
            echo "The script processes videos in backend/videos/original/ and outputs to backend/videos/optimized/"
            echo "All videos are optimized for frame-precise playback with WebCodecs API compatibility."
            exit 0
            ;;
        --force)
            FORCE_REPROCESS=true
            shift
            ;;
        --skip-existing)
            SKIP_EXISTING=true
            shift
            ;;
        preview|annotation|archive)
            PRESET_ARG="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the project root
if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]]; then
    error "Please run this script from the project root directory"
    exit 1
fi

# Set up directories
BACKEND_DIR="backend"
ORIGINAL_DIR="${BACKEND_DIR}/videos/original"
OPTIMIZED_DIR="${BACKEND_DIR}/videos/optimized"

# Create directories if they don't exist
mkdir -p "${ORIGINAL_DIR}"
mkdir -p "${OPTIMIZED_DIR}"

log "Starting video optimization process..."

# Check if ffmpeg is available
if ! command -v ffmpeg &> /dev/null; then
    error "FFmpeg is not installed or not in PATH"
    error "Please install FFmpeg:"
    error "  macOS: brew install ffmpeg"
    error "  Ubuntu: sudo apt install ffmpeg"
    error "  Windows: Download from https://ffmpeg.org/"
    exit 1
fi

# Check if original directory exists and has videos
if [[ ! -d "${ORIGINAL_DIR}" ]]; then
    error "Original videos directory not found: ${ORIGINAL_DIR}"
    exit 1
fi

# Find video files in original directory
video_files=()
while IFS= read -r -d $'\0' file; do
    video_files+=("$file")
done < <(find "${ORIGINAL_DIR}" -type f \( -iname "*.mp4" -o -iname "*.mov" -o -iname "*.avi" -o -iname "*.mkv" -o -iname "*.webm" \) -print0)

if [[ ${#video_files[@]} -eq 0 ]]; then
    warning "No video files found in ${ORIGINAL_DIR}"
    log "Please place video files in ${ORIGINAL_DIR} directory"
    exit 0
fi

log "Found ${#video_files[@]} video file(s) to process"

# Quality presets for different use cases
PRESET=${PRESET_ARG:-annotation}

# Set preset parameters based on selection
case "$PRESET" in
    preview)
        CRF_VALUE="28"
        SCALE_VALUE="854:480"
        GOP_VALUE="15"
        ;;
    annotation)
        CRF_VALUE="23"
        SCALE_VALUE="1280:-2"
        GOP_VALUE="15"
        ;;
    archive)
        CRF_VALUE="18"
        SCALE_VALUE="-2:-2"
        GOP_VALUE="15"
        ;;
    *)
        error "Invalid preset: $PRESET. Available: preview, annotation, archive"
        exit 1
        ;;
esac

log "Using quality preset: $PRESET (CRF=$CRF_VALUE, Scale=$SCALE_VALUE, GOP=$GOP_VALUE)"

# Process each video file
processed=0
skipped=0
failed=0

for video_path in "${video_files[@]}"; do
    # Get filename without path
    filename=$(basename "$video_path")
    # Get filename without extension
    basename_no_ext="${filename%.*}"
    
    # Output path in optimized directory (simplified naming)
    optimized_path="${OPTIMIZED_DIR}/${basename_no_ext}.mp4"
    
    log "Processing: $filename"

    # Check if already optimized based on command-line flags
    if [[ -f "$optimized_path" ]] && [[ "$FORCE_REPROCESS" == false ]]; then
        if [[ "$SKIP_EXISTING" == true ]]; then
            log "Skipping (already exists): $filename"
            ((skipped++))
            continue
        elif [[ "$optimized_path" -nt "$video_path" ]]; then
            log "Already optimized (newer than original): $filename"
            ((skipped++))
            continue
        else
            warning "Re-optimizing (original is newer): $filename"
        fi
    fi
    
    # Get video information for intelligent optimization
    log "Analyzing video properties..."
    
    # Get video dimensions and GOP information
    video_info=$(ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$video_path" 2>/dev/null)
    if [[ -n "$video_info" ]]; then
        IFS=',' read -r width height framerate <<< "$video_info"
        log "Original: ${width}x${height} @ ${framerate}fps"
        
        # Calculate target resolution based on preset
        if [[ "$SCALE_VALUE" == *":"* ]]; then
            target_scale="$SCALE_VALUE"
        else
            target_scale="${width}:${height}"
        fi
        
        # Check if resolution will be reduced
        if [[ "$SCALE_VALUE" == "1280:-2" ]] && [[ $width -gt 1280 ]]; then
            new_height=$((height * 1280 / width))
            log "Will scale down: ${width}x${height} → 1280x${new_height}"
        fi
    fi
    
    # Enhanced GOP analysis with frame rate consideration (informational only)
    gop_info=$(ffprobe -v quiet -select_streams v:0 -show_frames -show_entries frame=key_frame,pkt_pts_time -of csv=p=0 "$video_path" 2>/dev/null | head -200)

    if [[ -n "$gop_info" ]]; then
        # Count keyframes in first 200 frames for more accurate GOP estimation
        key_frames=$(echo "$gop_info" | grep -c "1" || echo "0")
        total_frames=$(echo "$gop_info" | wc -l)

        if [[ $key_frames -gt 1 && $total_frames -gt 30 ]]; then
            current_gop=$((total_frames / key_frames))
            log "Current GOP size: ~$current_gop frames (target: ${GOP_VALUE:-30})"
        fi
    fi
    
    log "Optimizing: $filename → ${basename_no_ext}.mp4"
    
    # Build FFmpeg command with dynamic parameters
    ffmpeg_cmd=(
        ffmpeg -y -i "$video_path"
        -c:v libx264
        -profile:v high
        -level 4.0
        -preset medium
        -crf "${CRF_VALUE:-23}"
        -r 30
        -g "${GOP_VALUE:-30}"
        -keyint_min "${GOP_VALUE:-30}"
        -sc_threshold 0
        -force_key_frames "expr:gte(t,n_forced*0.5)"
        -bf 0
        -b_strategy 0
        -pix_fmt yuv420p
        -c:a aac
        -b:a 128k
        -movflags +faststart
        -fflags +genpts
        # WebCodecs API optimizations
        -tune film
        -x264opts "ref=1:bframes=0:weightp=0:8x8dct=0:trellis=0"
    )
    
    # Add scaling filter if specified
    if [[ -n "$SCALE_VALUE" ]] && [[ "$SCALE_VALUE" != "-2:-2" ]]; then
        ffmpeg_cmd+=(-vf "scale=$SCALE_VALUE:flags=lanczos")
    fi
    
    ffmpeg_cmd+=("$optimized_path")
    
    # Execute FFmpeg command
    if "${ffmpeg_cmd[@]}" 2>/dev/null; then
        
        # Get file sizes for comparison
        original_size=$(stat -f%z "$video_path" 2>/dev/null || stat -c%s "$video_path" 2>/dev/null)
        optimized_size=$(stat -f%z "$optimized_path" 2>/dev/null || stat -c%s "$optimized_path" 2>/dev/null)
        
        original_mb=$((original_size / 1024 / 1024))
        optimized_mb=$((optimized_size / 1024 / 1024))
        
        if [[ $original_size -gt 0 ]]; then
            compression_ratio=$(((original_size - optimized_size) * 100 / original_size))
            success "Optimized: $filename (${original_mb}MB → ${optimized_mb}MB, ${compression_ratio}% reduction)"
        else
            success "Optimized: $filename → ${optimized_mb}MB"
        fi
        
        # Generate metadata cache entry
        log "Generating metadata cache for: $filename"
        node "scripts/generate-video-metadata.js" "$optimized_path" 2>/dev/null || warning "Failed to generate metadata cache for $filename"
        
        ((processed++))
    else
        error "Failed to optimize: $filename"
        ((failed++))
    fi
done

# Summary
log "=== Optimization Summary ==="
success "Processed: $processed videos"
log "Skipped (already optimized): $skipped videos"
if [[ $failed -gt 0 ]]; then
    error "Failed: $failed videos"
fi

# List optimized videos
if [[ $processed -gt 0 ]] || [[ $skipped -gt 0 ]]; then
    log ""
    log "Available optimized videos:"
    for optimized_file in "${OPTIMIZED_DIR}"/*.mp4; do
        if [[ -f "$optimized_file" ]]; then
            filename=$(basename "$optimized_file")
            size=$(stat -f%z "$optimized_file" 2>/dev/null || stat -c%s "$optimized_file" 2>/dev/null)
            size_mb=$((size / 1024 / 1024))
            log "  ✅ $filename (${size_mb}MB)"
        fi
    done
fi

if [[ $failed -gt 0 ]]; then
    error "Some videos failed to optimize. Check the error messages above."
    exit 1
else
    success "Video optimization completed successfully!"
fi