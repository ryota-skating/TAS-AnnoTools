# TAS-AnnoTools

TAS (Temporal Action Segmentation) Dataset Creation Tool for Video Annotation

## Overview

TAS-AnnoTools is a frame-precise video annotation tool designed for creating TAS (Temporal Action Segmentation) datasets from video content. The system provides minimal latency frame-by-frame control with WebCodecs API integration for research collaboration. While originally developed for figure skating analysis, the tool is designed to be adaptable for various action recognition and video analysis tasks.

## ✨ Features

### 🎬 Video Processing
- **Frame-Precise Navigation**: 1-frame stepping with ←/→ keys (≤50ms response time)
- **Auto Video Optimization**: GOP30 H.264 encoding for WebCodecs compatibility  
- **Smart File Management**: Automatic cleanup and optimization on server startup
- **Performance Monitoring**: Built-in latency tracking for SLA compliance

### 🔐 Authentication & Security
- **JWT-based Authentication**: Secure token-based auth with role management
- **Role-Based Access Control**: Admin/Annotator/Viewer permissions
- **Rate Limiting**: 5 login failures = 10-minute lockout
- **HTTPS Ready**: Production security with CORS protection

### 📊 Data Management
- **Flexible Label System**: Customizable action categories and elements
- **Figure Skating Support**: Pre-configured with 56 figure skating elements across 21 categories
- **SQLite Database**: Reliable data storage with PostgreSQL migration path
- **RESTful API**: Comprehensive backend API with WebSocket support
- **Export/Import**: JSON/CSV export with annotation versioning

### 🎯 Performance Requirements
- Frame step input → screen update: ≤50ms average (≤100ms p95)
- Timeline zoom/pan redraw: 16.7-33ms per frame (30-60fps feel)
- Initial frame display: ≤1000ms
- Support for 3 simultaneous users

## 🚀 Quick Start

### Prerequisites
- **Node.js**: ≥18.0.0
- **FFmpeg**: Required for video optimization
- **Chrome Browser**: For WebCodecs support

### Installation

```bash
# Clone the repository
git clone https://github.com/ryota-skating/TAS-AnnoTools.git
cd TAS-AnnoTools

# Install dependencies
npm install
```

### ⚠️ Initial Setup (Required after cloning)

After cloning the repository, you need to set up the following:

#### 1. Environment Configuration
```bash
# Create backend environment file
cp backend/.env.example backend/.env

# Create frontend environment file (if needed)
cp frontend/.env.example frontend/.env
```

#### 2. Required Environment Variables
**Backend (.env)**:
```bash
NODE_ENV=development
PORT=3001
JWT_SECRET=your-secure-jwt-secret-minimum-32-characters
DATABASE_PATH=./data/annotations.db
DEFAULT_ADMIN_PASSWORD=your-secure-admin-password
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

**Frontend (.env)** (optional):
```bash
VITE_API_URL=http://localhost:3001/api
```

#### 3. Directory Structure
The following directories are created automatically, but ensure they exist:
```bash
# These directories are maintained by .gitkeep files
backend/data/          # SQLite database storage
backend/videos/original/   # Original video files
backend/videos/optimized/  # Optimized video files
backend/logs/          # Application logs
```

#### 4. Security Notes
- **Change default passwords**: The default admin password is for development only
- **Generate JWT secret**: Use a cryptographically secure random string ≥32 characters
- **Video files**: Place your video files in `backend/videos/original/` directory

### 🎯 Quick Mapping Example

Create a simple sports action mapping:

```bash
# Create mapping/sports_element.txt
0 Running
1 Walking
2 Jumping
3 Throwing
4 Catching
5 NONE

# Create mapping/sports_set.txt
0 Running
1 Walking
2 Jumping
3 Throwing
4 Catching
5 NONE

# Use in frontend
apiService.getActionElements('sports').then(data => {
  console.log(data.elements); // Your custom sports elements
});
```

### 🔧 User Management

TAS-AnnoTools includes a comprehensive user management system with username-based authentication.

#### Quick User Management
```bash
# Interactive user management (recommended)
./scripts/manage-users.sh

# Direct backend access
cd backend && npm run users
```

#### Features
- **User Registration**: Create new accounts with username/password
- **Role Management**: Admin, Annotator, Viewer permissions
- **User Listing**: View all registered users and their status
- **User Deletion**: Remove users with safety checks
- **Security**: bcrypt password hashing, duplicate prevention

#### Default Account
- **Username**: `admin`
- **Password**: `admin123` (開発環境のみ)
- **Role**: Admin

> ⚠️ **重要なセキュリティ注意**:
> - このデフォルトパスワードは開発・デモ用です
> - 本番環境では必ず強力なパスワードに変更してください
> - 環境変数 `DEFAULT_ADMIN_PASSWORD` で設定することを推奨します

#### Usage Examples
```bash
# Check system prerequisites
./scripts/manage-users.sh --check-only

# Add a new annotator
./scripts/manage-users.sh
# Choose: 1. 新規ユーザー登録
# Enter user details and select role

# List all users
./scripts/manage-users.sh  
# Choose: 2. ユーザー一覧表示

# Remove inactive users
./scripts/manage-users.sh
# Choose: 3. ユーザー削除
```

### Development Setup

#### Quick Start (Recommended)
```bash
# Start both frontend and backend servers
./scripts/dev.sh

# Or start individually:
./scripts/dev.sh --backend   # Backend only (port 3001)
./scripts/dev.sh --frontend  # Frontend only (port 5174)
```

#### Manual Setup
1. **Start Backend Server:**
```bash
cd backend
npm install
npm run dev
```
Backend runs on: http://localhost:3001

2. **Start Frontend Server:**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: http://localhost:5174

3. **Login Credentials (開発環境用):**
   - **Username**: admin
   - **Password**: admin123

   > **注意**: 本番環境では必ず環境変数でパスワードを設定してください

## 🎬 Video Optimization

TAS-AnnoTools includes a powerful video optimization pipeline that automatically converts videos for frame-precise playback with GOP30 encoding.

### Setup Process

1. **Place Original Videos**
```bash
# Copy your MP4 videos to the original directory
cp your-video.mp4 backend/videos/original/
```

2. **Run Optimization Script**
```bash
# Optimize all videos in original directory
bash scripts/optimize-videos.sh
```

3. **Optimized Videos Ready**
```bash
# Check optimized videos
ls -la backend/videos/optimized/
# Videos are now available with same filename as original
```

### Video Processing Pipeline

```bash
# Processing flow:
backend/videos/original/sample.mp4      # Your original video
# ↓ [GOP30 + faststart optimization]
backend/videos/optimized/sample.mp4     # Frame-precise optimized version
# ↓ [API serves optimized videos]
http://localhost:3001/videos/optimized/sample.mp4
```

### Manual Optimization
```bash
# Run optimization script manually
bash scripts/optimize-videos.sh

# Check optimization status (Admin API)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/admin/video-optimization/status
```

### Optimization Features
- **H.264/AVC**: High Profile for WebCodecs compatibility
- **GOP30**: 30-frame GOP for precise seeking (1 second @ 30fps)
- **No B-frames**: Perfect frame-step performance
- **Faststart**: Optimized for web streaming
- **Auto-cleanup**: Removes duplicate and temporary files

## 📁 Project Structure

```
TAS-AnnoTools/
├── frontend/                # React + TypeScript UI
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── video/       # Video player components  
│   │   │   ├── timeline/    # Timeline and annotation UI
│   │   │   └── auth/        # Authentication components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client services
│   │   └── types/           # TypeScript definitions
│   └── dist/                # Production build
├── backend/                 # Node.js + Fastify API
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   │   ├── auth.ts      # Authentication endpoints
│   │   │   ├── videos.ts    # Video management API
│   │   │   ├── admin.ts     # Admin management API
│   │   │   └── index.ts     # Route registration
│   │   ├── services/        # Business logic services
│   │   │   ├── database.ts  # Database management
│   │   │   └── videoOptimizer.ts  # Video processing
│   │   ├── middleware/      # Request middleware
│   │   └── utils/           # Utility functions
│   ├── videos/              # Video file storage
│   │   ├── original/        # Original video files
│   │   ├── optimized/       # Optimized videos (GOP30)
│   │   └── *.mp4           # Symlinks to optimized videos
│   └── data/                # SQLite database
├── shared/                  # Shared TypeScript types
│   └── types/               # Common type definitions
├── scripts/                 # Utility scripts
│   └── optimize-videos.js   # Video optimization script
├── tools/                   # Development tools
│   └── testing/             # Frame navigation test tools
└── mapping/                 # Action element definitions
    ├── mapping_step_element.txt  # 56 figure skating elements (example)
    └── mapping_step_set.txt      # 21 element categories (example)
```

## 🎯 Label Customization

TAS-AnnoTools supports flexible label customization through mapping files, allowing you to adapt the tool for various action recognition tasks.

### Creating Custom Mappings

1. **Create Element Mapping File**
   ```bash
   # Create custom element mapping: mapping/custom_element.txt
   0 Walk
   1 Run
   2 Jump
   3 Stand
   4 Sit
   5 None
   ```

2. **Create Category Mapping File**
   ```bash
   # Create category mapping: mapping/custom_set.txt
   0 Walk
   1 Run
   2 Jump
   3 Stand
   4 Sit
   5 None
   ```

3. **API Usage**
   ```bash
   # Get elements for custom mapping
   GET /api/labels/elements/all?mapping=custom

   # Get label set for project with custom mapping
   GET /api/labels/myproject?mapping=custom
   ```

### Available APIs

- `GET /api/labels/mappings` - List available mapping configurations
- `GET /api/labels/mappings/{name}/validate` - Validate mapping file format
- `GET /api/labels/elements/all?mapping={name}` - Get elements for specific mapping

### File Format Requirements

**Element Mapping (`*_element.txt`)**:
- Format: `id element_name`
- Sequential IDs starting from 0
- No duplicate IDs
- Include "NONE" element for non-annotated segments

**Category Mapping (`*_set.txt`)**:
- Format: `id category_name`
- Must match element categories
- Used for UI grouping and organization

### 🏒 Example: Figure Skating Elements

The system includes pre-configured support for figure skating action annotation:

### Turn Elements (40 variants)
- **Three Turn** (8 directional variants: RFI, RFO, RBI, RBO, LFI, LFO, LBI, LBO)
- **Bracket Turn** (8 directional variants)
- **Rocker Turn** (8 directional variants)
- **Counter Turn** (8 directional variants) 
- **Loop Turn** (8 directional variants)

### Other Elements (16 elements)
- **Footwork**: Twizzle, Toe Step, Chasse, Mohawk, Choctaw
- **Edge Work**: Change of Edge, Cross Roll, Swing Roll, Cross Over
- **Field Moves**: Spiral, Arabesque, Spread Eagles, Ina Bauers, Hydroblading, Knee Slide
- **Special**: NONE (for non-annotated segments)

## 📡 API Endpoints

### Authentication
```bash
POST /api/auth/login        # User login
GET  /api/auth/me          # Current user info  
POST /api/auth/logout      # User logout
```

### Video Management
```bash
GET  /api/videos           # List available videos
GET  /api/videos/:id       # Get video metadata
```

### Annotations
```bash
GET  /api/annotations/:videoId        # Get annotations
POST /api/annotations/:videoId        # Save annotations
GET  /api/annotations/:videoId/export # Export annotations
```

### Admin API
```bash
GET  /api/admin/video-optimization/status   # Check optimization status
POST /api/admin/video-optimization/optimize # Trigger manual optimization
GET  /api/admin/system/health               # System health check
```

### Labels & Elements
```bash
GET  /api/labels/:project           # Get label set
GET  /api/labels/elements/all       # Get all action elements
```

## ⚙️ Configuration

### Backend Environment (.env)
```bash
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-minimum-32-characters-change-in-production
DATABASE_PATH=./data/annotations.db
DEFAULT_ADMIN_PASSWORD=change-this-strong-password-in-production
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

### Frontend Environment (.env)
```bash
VITE_API_URL=http://localhost:3000/api
```

## 🧪 Testing

### Frame Navigation Testing
```bash
# Browser console testing (open http://localhost:5173)
FrameTest.testForwardStep()    # 50-frame forward test
FrameTest.testBackwardStep()   # 50-frame backward test  
FrameTest.runAllTests()        # Complete test suite
```

### Manual Testing Tools
- **Frame Navigation**: Use ←/→ keys for precise frame control
- **Playback Control**: Space bar for play/pause
- **Position Control**: Home/End for start/end navigation

## 🔧 Development Scripts

```bash
# Development
npm run dev                 # Start both servers
npm run dev:frontend        # Frontend only (port 5173)
npm run dev:backend         # Backend only (port 3000)

# Building  
npm run build               # Build both projects
npm run build:frontend      # Build frontend only
npm run build:backend       # Build backend only

# Testing
npm run test                # Run all tests
npm run type-check          # TypeScript compilation check

# Maintenance
npm run clean               # Clean build artifacts
bash scripts/optimize-videos.sh  # Run video optimization
```

## 📈 Performance Monitoring

The system includes comprehensive performance tracking:

- **Frame Step Latency**: Target ≤50ms (logged when exceeded)
- **Timeline Redraw Time**: Target ≤33ms for smooth 30fps
- **Video Loading Time**: Target ≤1000ms initial display
- **API Response Time**: Complete request/response tracking
- **Memory Usage**: Worker and main thread monitoring

Access performance data via Admin API endpoints.

## 🛠️ Technical Architecture

### Frontend Stack
- **React 18+**: Modern hooks-based UI framework
- **TypeScript**: Full type safety and IDE support
- **Vite**: Fast development and optimized builds
- **HTML5 Video API**: Frame-precise video control
- **Canvas API**: High-performance timeline rendering

### Backend Stack
- **Node.js + Fastify**: High-performance API server
- **SQLite**: Embedded database with migration path
- **JWT Authentication**: Secure token-based auth
- **Structured Logging**: JSON Lines format for monitoring
- **FFmpeg Integration**: Video processing and optimization

### Security Features
- HTTPS enforcement with HSTS headers
- CSRF protection with SameSite cookies
- XSS protection with CSP headers
- Bcrypt password hashing (12 rounds)
- Rate limiting and brute force protection

## 🗺️ Roadmap

### Phase 2: Enhanced Video Features
- ✅ Frame-precise navigation with keyboard controls
- ✅ Video optimization and GOP30 encoding
- ✅ Auto-optimization on server startup  
- 🔄 Advanced timeline with segment visualization
- 🔄 WebCodecs integration for optimal performance

### Phase 3: Annotation Tools
- 🔄 Segment selection and editing interface
- 🔄 Figure skating element assignment
- 🔄 Real-time collaboration via WebSocket
- 🔄 Annotation export/import functionality

### Phase 4: Production Features
- 🔄 Docker containerization
- 🔄 PostgreSQL database migration
- 🔄 Advanced monitoring and alerting
- 🔄 Multi-video project management

## 📝 Contributing

This project follows strict technical requirements for research-grade video annotation:

1. **Frame Precision**: All navigation must be frame-exact, never time-based
2. **Performance**: Frame stepping must meet ≤50ms SLA requirement
3. **Compatibility**: Chrome-only support for WebCodecs API access
4. **Security**: Production-ready authentication and authorization
5. **Data Integrity**: Reliable annotation storage and versioning

### セキュリティガイドライン
- 本番環境では必ず環境変数でシークレットキーとパスワードを設定
- デフォルトの設定値は開発・テスト用途のみで使用
- 機密情報をコードに直接埋め込まない

## 📄 License

MIT License

This project is developed for research purposes in temporal action segmentation and video analysis.
時系列動作セグメンテーションと動画解析の研究目的で開発されました。

## 🔗 Links

- **Health Check**: http://localhost:3000/health
- **API Documentation**: Available via route introspection
- **Performance Dashboard**: http://localhost:3000/api/performance/summary (Admin only)
- **System Status**: http://localhost:3000/api/admin/system/health (Admin only)

---

For questions about TAS dataset creation, video optimization, or technical implementation, please refer to the detailed documentation and issues section.