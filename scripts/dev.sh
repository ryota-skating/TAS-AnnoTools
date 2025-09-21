#!/bin/bash

# FS-AnnoTools3 Development Script
# Starts development servers for both frontend and backend

set -e

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
if [[ ! -f "package.json" ]] || [[ ! -d "frontend" ]] || [[ ! -d "backend" ]]; then
    error "Please run this script from the project root directory"
    exit 1
fi

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes using a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null)
    
    if [[ -n "$pids" ]]; then
        log "Killing processes using port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        
        # Check if port is now free
        if ! check_port $port; then
            success "Port $port is now available"
            return 0
        else
            warning "Some processes on port $port might still be running"
            return 1
        fi
    else
        log "No processes found using port $port"
        return 0
    fi
}

# Function to start backend
start_backend() {
    log "Starting backend development server..."
    
    cd backend
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        warning "Backend node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Check if backend port is available
    if check_port 3001; then
        warning "Port 3001 is already in use. Attempting to free it..."
        kill_port 3001
        
        # Double check if port is now free
        if check_port 3001; then
            error "Unable to free port 3001. Please manually stop the process using:"
            error "  lsof -ti :3001 | xargs kill -9"
            cd ..
            return 1
        fi
    fi
    
    # Start backend in development mode
    npm run dev &
    BACKEND_PID=$!
    
    cd ..
    
    success "Backend development server starting on port 3001"
}

# Function to start frontend
start_frontend() {
    log "Starting frontend development server..."
    
    cd frontend
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        warning "Frontend node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Check if frontend port is available (trying 5174 first, then 5173)
    if check_port 5174; then
        warning "Port 5174 is already in use. Attempting to free it..."
        kill_port 5174
    fi
    
    if check_port 5173; then
        warning "Port 5173 is already in use. Attempting to free it..."
        kill_port 5173
    fi
    
    # Start frontend in development mode
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
    
    success "Frontend development server starting (Vite will choose available port)"
}

# Function to show help
show_help() {
    echo "FS-AnnoTools3 Development Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -f, --frontend  Start frontend only"
    echo "  -b, --backend   Start backend only"
    echo "  -i, --install   Install dependencies before starting"
    echo ""
    echo "Examples:"
    echo "  $0                # Start both frontend and backend"
    echo "  $0 --frontend     # Start frontend only"
    echo "  $0 --backend      # Start backend only"
    echo "  $0 --install      # Install deps and start both servers"
    echo ""
    echo "Development URLs:"
    echo "  Frontend: http://localhost:5174 (or auto-assigned port)"
    echo "  Backend:  http://localhost:3001"
}

# Function to cleanup background processes
cleanup() {
    log "Shutting down development servers..."
    
    if [[ -n "$BACKEND_PID" ]]; then
        kill $BACKEND_PID 2>/dev/null || true
        log "Backend server stopped (PID: $BACKEND_PID)"
    fi
    
    if [[ -n "$FRONTEND_PID" ]]; then
        kill $FRONTEND_PID 2>/dev/null || true
        log "Frontend server stopped (PID: $FRONTEND_PID)"
    fi
    
    # Kill any remaining processes on development ports
    kill_port 3001 > /dev/null 2>&1 || true
    kill_port 5173 > /dev/null 2>&1 || true
    kill_port 5174 > /dev/null 2>&1 || true
    
    # Kill any remaining npm/node processes for our project
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "nodemon.*src/index.ts" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    success "Development servers stopped"
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

# Parse command line arguments
FRONTEND_ONLY=false
BACKEND_ONLY=false
INSTALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        -b|--backend)
            BACKEND_ONLY=true
            shift
            ;;
        -i|--install)
            INSTALL=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Set up signal handling for cleanup
trap cleanup SIGINT SIGTERM EXIT

# Main execution
main() {
    log "Starting FS-AnnoTools3 development environment..."
    
    # Install dependencies if requested
    if [[ "$INSTALL" == "true" ]]; then
        install_deps
    fi
    
    # Start servers based on options
    if [[ "$FRONTEND_ONLY" == "true" ]]; then
        start_frontend
    elif [[ "$BACKEND_ONLY" == "true" ]]; then
        start_backend
    else
        # Start both (default)
        start_backend
        sleep 2  # Give backend time to start
        start_frontend
    fi
    
    echo ""
    success "Development environment is ready!"
    echo ""
    echo "=== Development URLs ==="
    if [[ "$BACKEND_ONLY" != "true" ]]; then
        echo "🌐 Frontend: http://localhost:5174 (or auto-assigned port)"
    fi
    if [[ "$FRONTEND_ONLY" != "true" ]]; then
        echo "🔧 Backend:  http://localhost:3001"
        echo "📊 Health:   http://localhost:3001/health"
    fi
    echo "========================"
    echo ""
    log "Press Ctrl+C to stop all servers"
    
    # Wait for user to stop
    while true; do
        sleep 1
    done
}

# Run main function
main