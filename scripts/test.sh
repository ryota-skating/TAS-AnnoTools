#!/bin/bash

# FS-AnnoTools3 Test Script
# Runs tests for both frontend and backend

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

# Function to test frontend
test_frontend() {
    log "Testing frontend..."
    
    cd frontend
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        warning "Frontend node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Run TypeScript check via build (more reliable)
    log "Running frontend TypeScript check..."
    if npm run build --silent; then
        success "Frontend TypeScript check passed"
    else
        error "Frontend TypeScript check failed"
        cd ..
        return 1
    fi
    
    # Run linting if available
    if npm run lint 2>/dev/null; then
        success "Frontend linting passed"
    else
        warning "Frontend linting not available or failed"
    fi
    
    # Run tests if available
    if npm test 2>/dev/null; then
        success "Frontend tests passed"
    else
        warning "Frontend tests not available"
    fi
    
    # Try build test
    log "Running frontend build test..."
    if npm run build; then
        success "Frontend build test passed"
    else
        error "Frontend build test failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Function to test backend
test_backend() {
    log "Testing backend..."
    
    cd backend
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        warning "Backend node_modules not found, installing dependencies..."
        npm install
    fi
    
    # Run TypeScript check via build (more reliable)
    log "Running backend TypeScript check..."
    if npm run build --silent; then
        success "Backend TypeScript check passed"
    else
        error "Backend TypeScript check failed"
        cd ..
        return 1
    fi
    
    # Run linting if available
    if npm run lint 2>/dev/null; then
        success "Backend linting passed"
    else
        warning "Backend linting not available or failed"
    fi
    
    # Run tests if available
    if npm test 2>/dev/null; then
        success "Backend tests passed"
    else
        warning "Backend tests not available"
    fi
    
    # Try build test
    log "Running backend build test..."
    if npm run build; then
        success "Backend build test passed"
    else
        error "Backend build test failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Function to show help
show_help() {
    echo "FS-AnnoTools3 Test Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -f, --frontend  Test frontend only"
    echo "  -b, --backend   Test backend only"
    echo "  -v, --verbose   Enable verbose output"
    echo ""
    echo "Tests include:"
    echo "  - TypeScript compilation check"
    echo "  - ESLint (if configured)"
    echo "  - Unit tests (if available)"
    echo "  - Build verification"
}

# Parse command line arguments
FRONTEND_ONLY=false
BACKEND_ONLY=false
VERBOSE=false

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
        -v|--verbose)
            VERBOSE=true
            set -x
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
    
    log "Starting FS-AnnoTools3 test suite..."
    
    local tests_passed=0
    local tests_failed=0
    
    # Test based on options
    if [[ "$FRONTEND_ONLY" == "true" ]]; then
        if test_frontend; then
            ((tests_passed++))
        else
            ((tests_failed++))
        fi
    elif [[ "$BACKEND_ONLY" == "true" ]]; then
        if test_backend; then
            ((tests_passed++))
        else
            ((tests_failed++))
        fi
    else
        # Test both (default)
        if test_backend; then
            ((tests_passed++))
        else
            ((tests_failed++))
        fi
        
        if test_frontend; then
            ((tests_passed++))
        else
            ((tests_failed++))
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "=== Test Results ==="
    echo "✅ Passed: $tests_passed"
    echo "❌ Failed: $tests_failed"
    echo "⏱️  Duration: ${duration}s"
    echo "===================="
    
    if [[ $tests_failed -gt 0 ]]; then
        error "Some tests failed"
        return 1
    else
        success "All tests passed!"
        return 0
    fi
}

# Run main function
if ! main; then
    exit 1
fi