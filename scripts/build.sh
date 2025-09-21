#!/bin/bash

# FS-AnnoTools3 Build Script
# Builds both frontend and backend with error handling and logging

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log function
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
if [[ ! -f "package.json" ]] || [[ ! -d "frontend" ]] || [[ ! -d "backend" ]]; then
    error "Please run this script from the project root directory"
    exit 1
fi

# Function to build frontend
build_frontend() {
    log "Building frontend..."
    
    cd frontend
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        warning "Frontend node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Run build
    log "Running frontend TypeScript compilation and Vite build..."
    if npm run build; then
        success "Frontend build completed successfully"
        
        # Show build output info
        if [[ -d "dist" ]]; then
            local size=$(du -sh dist 2>/dev/null | cut -f1 || echo "unknown")
            log "Frontend build size: $size"
        fi
    else
        error "Frontend build failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Function to build backend
build_backend() {
    log "Building backend..."
    
    cd backend
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        warning "Backend node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Run build
    log "Running backend TypeScript compilation..."
    if npm run build; then
        success "Backend build completed successfully"
        
        # Show build output info
        if [[ -d "dist" ]]; then
            local size=$(du -sh dist 2>/dev/null | cut -f1 || echo "unknown")
            log "Backend build size: $size"
        fi
    else
        error "Backend build failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Function to clean builds
clean_builds() {
    log "Cleaning previous builds..."
    
    if [[ -d "frontend/dist" ]]; then
        rm -rf frontend/dist
        log "Cleaned frontend/dist"
    fi
    
    if [[ -d "backend/dist" ]]; then
        rm -rf backend/dist
        log "Cleaned backend/dist"
    fi
}

# Function to install dependencies
install_deps() {
    log "Installing/updating dependencies..."
    
    # Install frontend dependencies
    log "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    # Install backend dependencies
    log "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    success "All dependencies installed successfully"
}

# Function to show help
show_help() {
    echo "FS-AnnoTools3 Build Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -c, --clean     Clean builds before building"
    echo "  -i, --install   Install/update dependencies before building"
    echo "  -f, --frontend  Build frontend only"
    echo "  -b, --backend   Build backend only"
    echo "  -v, --verbose   Enable verbose output"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build both frontend and backend"
    echo "  $0 --clean           # Clean and build both"
    echo "  $0 --frontend        # Build frontend only"
    echo "  $0 --backend         # Build backend only"
    echo "  $0 --clean --install # Clean, install deps, and build"
}

# Parse command line arguments
CLEAN=false
INSTALL=false
FRONTEND_ONLY=false
BACKEND_ONLY=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -i|--install)
            INSTALL=true
            shift
            ;;
        -f|--frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        -b|--backend)
            BACKEND_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            set -x  # Enable verbose mode
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    local start_time=$(date +%s)
    
    log "Starting FS-AnnoTools3 build process..."
    
    # Clean if requested
    if [[ "$CLEAN" == "true" ]]; then
        clean_builds
    fi
    
    # Install dependencies if requested
    if [[ "$INSTALL" == "true" ]]; then
        install_deps
    fi
    
    # Build based on options
    if [[ "$FRONTEND_ONLY" == "true" ]]; then
        build_frontend
    elif [[ "$BACKEND_ONLY" == "true" ]]; then
        build_backend
    else
        # Build both (default)
        build_frontend
        build_backend
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    success "Build process completed in ${duration} seconds"
    
    # Show final summary
    echo ""
    echo "=== Build Summary ==="
    if [[ "$FRONTEND_ONLY" != "true" ]] && [[ -d "backend/dist" ]]; then
        echo "✅ Backend: built successfully"
    fi
    if [[ "$BACKEND_ONLY" != "true" ]] && [[ -d "frontend/dist" ]]; then
        echo "✅ Frontend: built successfully"
    fi
    echo "====================="
}

# Run main function with error handling
if ! main; then
    error "Build process failed"
    exit 1
fi