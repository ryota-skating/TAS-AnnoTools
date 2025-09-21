# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **FS-AnnoTools3** - a TAS (Technical Artistic Score) dataset creation tool for figure skating video annotation. The system provides frame-precise video annotation with minimal latency for research collaboration.

### Core Purpose
- Frame-exact interval selection and labeling for figure skating videos
- Generate frame-number-based TAS annotations for research
- Support simultaneous annotation by up to 3 researchers
- Handle ~3-minute H.264/MP4 videos with frame-precise control

## Architecture

### High-Performance Stack
- **Frontend**: React + TypeScript with WebCodecs API for frame-precise video control
- **Video Decoding**: WebCodecs + OffscreenCanvas + Web Workers (UI/decode separation)
- **Video Delivery**: Nginx with HTTP Range support, direct video serving
- **Backend**: Node.js (Fastify/Express) with REST + WebSocket APIs
- **Database**: SQLite (with PostgreSQL migration path)
- **Authentication**: ID/Password or OAuth (Google/GitHub)
- **Security**: HTTPS with Let's Encrypt, CORS-free same-origin delivery

### Performance Requirements
- Frame step input → screen update: ≤50ms average (≤100ms p95)
- Zoom/pan redraw: 16.7-33ms per frame (30-60fps feel)
- Initial frame display: ≤1000ms
- Support 3 simultaneous clients maintaining performance

## Key Features

### Video Control
- WebCodecs-based 1-frame stepping with ←/→ keys
- Variable speed playback (0.25x-2x) without frame drops
- Frame-accurate HUD display showing current frame number
- Keyboard shortcuts: Space (play/pause), Shift+←/→ (range selection), Home/End (navigation)

### Timeline & Annotation
- Canvas-based timeline with zoom/pan support
- Segment selection via Shift+drag, editing via timeline interaction
- 10 dynamic highlight thumbnails that update based on zoom position
- LRU cache for thumbnails (max 200 thumbnails, 50MB limit)
- Frame-number-based segment storage (not time-based)

### Data Management
- Local auto-save (IndexedDB) + server versioned storage
- Label set management with colors, descriptions, and hotkeys
- JSON/CSV export, JSON import
- Multi-video project support with progress tracking

## File Structure

```
├── sys_req.md                    # Complete requirements specification (Japanese)
├── mapping/
│   ├── mapping_step_element.txt  # Figure skating element mappings (55 elements)
│   └── mapping_step_set.txt      # Element set mappings (20 categories)
└── .history/                     # Version history of requirements
```

## Domain Knowledge

### Figure Skating Elements
The system annotates specific figure skating elements defined in the mapping files:

**Element Categories** (mapping_step_set.txt):
- Turns: Three_Turn, Bracket_Turn, Rocker_Turn, Counter_Turn, Loop_Turn
- Footwork: Twizzle, Toe_Step, Chasse, Mohawk, Choctaw
- Edge work: Change_of_Edge, Cross_Roll, Swing_Roll, Cross_Over
- Field moves: Spiral, Arabesque, Spread_Eagles, Ina_Bauers, Hydroblading, Knee_Slide

**Detailed Elements** (mapping_step_element.txt):
- 55 specific elements including directional variations (RFI, RFO, RBI, RBO, LFI, LFO, LBI, LBO)
- Each turn type has 8 directional variants (Right/Left + Forward/Backward + Inside/Outside edge)

## Development Approach

### Browser Target
- **Chrome only** - leverages WebCodecs API and modern web features
- COOP/COEP headers for SharedArrayBuffer support
- CSP security headers for XSS protection

### Performance Optimization
- Worker-based video decoding to keep UI thread responsive  
- OffscreenCanvas for efficient rendering
- Throttled thumbnail generation (150ms debounce during scroll/zoom)
- GPU-optimized transforms for UI animations
- HTTP/2 and nginx sendfile optimization

### Data Integrity
- Frame-based timing (not time-based) for precise annotation
- Segment overlap/intersection validation
- Video hash/size/mtime tracking for change detection
- Versioned annotation storage

## Security Considerations
- HTTPS mandatory with HSTS
- Rate limiting: 5 login failures = 10-minute lockout
- CSRF protection with SameSite cookies
- Video directory listing disabled with secure ID generation
- Minimal access logging (no long-term signature URL storage)

## Deployment Notes
- Production environment requires proper HTTPS setup
- Video files served directly from `/videos/*.mp4` path
- Regular database/annotation backups recommended
- Configure environment variables for production security

This is a research tool focused on frame-precise video annotation for figure skating technical analysis. The codebase prioritizes performance and accuracy over broad compatibility.

## Development Environment

### Python Environment
- **Python Version**: 3.11 (managed via uv)
- **Package Manager**: uv for dependency management and virtual environments
- **Project Structure**: Standard Python package with pyproject.toml

### Available Tools
- **Serena MCP**: Semantic code analysis and intelligent editing capabilities
  - Provides symbol-level code comprehension
  - Multi-language support for Python, TypeScript/JavaScript, and more
  - Advanced project analysis and code understanding

### Common Commands
```bash
# Virtual environment activation
source .venv/bin/activate

# Install dependencies
uv sync

# Add new dependencies
uv add <package-name>

# Run Python scripts
uv run <script.py>
```