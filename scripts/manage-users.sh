#!/bin/bash

# FS-AnnoTools3 User Management Shell Script
# ユーザーアカウント管理用シェルスクリプト

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
if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
    error "このスクリプトはプロジェクトルートディレクトリから実行してください"
    error "現在のディレクトリ: $(pwd)"
    exit 1
fi

# Check if backend directory exists and has the required files
if [[ ! -f "scripts/manage-users.ts" ]]; then
    error "ユーザー管理スクリプトが見つかりません: scripts/manage-users.ts"
    exit 1
fi

if [[ ! -f "backend/package.json" ]]; then
    error "backend/package.json が見つかりません"
    exit 1
fi

# Function to check if backend dependencies are installed
check_backend_deps() {
    log "バックエンドの依存関係を確認中..."
    
    cd backend
    
    if [[ ! -d "node_modules" ]]; then
        warning "バックエンドの依存関係がインストールされていません"
        log "依存関係をインストールしています..."
        npm install
        success "依存関係のインストールが完了しました"
    fi
    
    # Check if required packages are installed
    local required_packages=("uuid" "bcryptjs" "sqlite3" "ts-node" "typescript")
    local missing_packages=()
    
    for package in "${required_packages[@]}"; do
        if ! npm list "$package" >/dev/null 2>&1; then
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        warning "不足している依存関係があります: ${missing_packages[*]}"
        log "不足している依存関係をインストールしています..."
        npm install "${missing_packages[@]}" "@types/uuid" "@types/bcryptjs"
        success "依存関係のインストールが完了しました"
    fi
    
    cd ..
}

# Function to check if database exists and is accessible
check_database() {
    log "データベースの状態を確認中..."
    
    local db_path="backend/data/annotations.db"
    
    if [[ ! -f "$db_path" ]]; then
        warning "データベースファイルが見つかりません: $db_path"
        warning "バックエンドサーバーを一度起動してデータベースを初期化してください"
        echo ""
        echo "初期化コマンド:"
        echo "  cd backend && npm run dev"
        echo ""
        echo "サーバーが起動したら Ctrl+C で停止して、再度このスクリプトを実行してください"
        exit 1
    fi
    
    success "データベースファイルが確認できました"
}

# Function to run the TypeScript user management script
run_user_manager() {
    log "ユーザー管理スクリプトを起動しています..."
    echo ""
    
    cd backend
    
    # Run the TypeScript script
    npm run users
    
    cd ..
}

# Function to show help
show_help() {
    echo "FS-AnnoTools3 ユーザー管理スクリプト"
    echo ""
    echo "使用方法: $0 [オプション]"
    echo ""
    echo "オプション:"
    echo "  -h, --help      このヘルプメッセージを表示"
    echo "  --check-only    依存関係とデータベースのチェックのみ実行"
    echo ""
    echo "機能:"
    echo "  1. 新規ユーザー登録"
    echo "  2. 既存ユーザー一覧表示"
    echo "  3. ユーザー削除"
    echo ""
    echo "前提条件:"
    echo "  • バックエンドサーバーが一度起動されてデータベースが初期化済み"
    echo "  • Node.js と npm がインストール済み"
    echo "  • プロジェクトルートディレクトリから実行"
    echo ""
    echo "データベース初期化方法:"
    echo "  cd backend && npm run dev"
    echo "  (サーバー起動後、Ctrl+C で停止)"
}

# Function to perform checks only
check_only() {
    log "システムチェックを実行中..."
    check_backend_deps
    check_database
    success "全てのチェックが完了しました"
    echo ""
    echo "ユーザー管理を開始するには:"
    echo "  $0"
}

# Parse command line arguments
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        *)
            error "不明なオプション: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo ""
    echo "================================="
    echo "  FS-AnnoTools3 ユーザー管理"
    echo "================================="
    echo ""
    
    # Perform checks
    check_backend_deps
    check_database
    
    if [[ "$CHECK_ONLY" == "true" ]]; then
        check_only
        return 0
    fi
    
    # Run the user manager
    echo ""
    success "全ての前提条件が満たされています"
    echo ""
    run_user_manager
    
    echo ""
    success "ユーザー管理スクリプトが終了しました"
}

# Run main function
main "$@"