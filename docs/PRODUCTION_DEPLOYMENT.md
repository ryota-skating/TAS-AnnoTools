# FS-AnnoTools3 本番環境デプロイメントガイド

研究室のUbuntuサーバーでFS-AnnoTools3を本番環境に公開するための包括的な手順書です。

## 目次

1. [前提条件・システム要件](#前提条件システム要件)
2. [サーバー環境構築](#サーバー環境構築)
3. [アプリケーションデプロイ](#アプリケーションデプロイ)
4. [Nginx設定](#nginx設定)
5. [SSL/HTTPS設定](#sslhttps設定)
6. [セキュリティ設定](#セキュリティ設定)
7. [プロセス管理（PM2）](#プロセス管理pm2)
8. [監視・ログ管理](#監視ログ管理)
9. [バックアップ設定](#バックアップ設定)
10. [運用・メンテナンス](#運用メンテナンス)
11. [トラブルシューティング](#トラブルシューティング)

## 前提条件・システム要件

### ハードウェア要件
- **CPU**: 2コア以上（4コア推奨）
- **メモリ**: 4GB以上（8GB推奨）
- **ストレージ**: 50GB以上の空き容量
- **ネットワーク**: 100Mbps以上の安定した回線

### ソフトウェア要件
- **OS**: Ubuntu 20.04 LTS 以降
- **Node.js**: 18.x 以降
- **FFmpeg**: 動画処理用
- **Nginx**: リバースプロキシ・静的ファイル配信
- **PM2**: プロセス管理
- **Certbot**: SSL証明書管理

### ドメイン・ネットワーク設定
- 固定IPアドレスまたはDDNS設定
- ドメイン名の取得（例: `annotator.lab-univ.ac.jp`）
- DNSレコード設定（A/CNAMEレコード）
- ファイアウォール設定（ポート22, 80, 443を開放）

## サーバー環境構築

### 1. システムアップデート

```bash
# システムの更新
sudo apt update && sudo apt upgrade -y

# 必要パッケージのインストール
sudo apt install -y curl wget git unzip software-properties-common

# ファイアウォール設定
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
```

### 2. Node.js インストール

```bash
# NodeSourceからNode.js 20.x LTSをインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 3. FFmpeg インストール

```bash
# FFmpegのインストール
sudo apt install -y ffmpeg

# バージョン確認
ffmpeg -version
```

### 4. Nginx インストール

```bash
# Nginxのインストール
sudo apt install -y nginx

# サービス開始・自動起動設定
sudo systemctl start nginx
sudo systemctl enable nginx

# 動作確認
sudo systemctl status nginx
```

### 5. PM2 インストール

```bash
# PM2のグローバルインストール
sudo npm install -g pm2

# PM2自動起動設定
pm2 startup
# 表示されたコマンドを実行
```

### 6. Certbot インストール（SSL用）

```bash
# Certbotのインストール
sudo apt install -y certbot python3-certbot-nginx
```

## アプリケーションデプロイ

### 1. アプリケーションコードの配置

```bash
# デプロイ用ユーザー作成
sudo adduser --system --group --home /opt/fs-annotools3 fsanno

# アプリケーションディレクトリ作成
sudo mkdir -p /opt/fs-annotools3
sudo chown fsanno:fsanno /opt/fs-annotools3

# アプリケーションコードの配置（GitまたはSCP）
# 例: Git経由
sudo -u fsanno git clone https://github.com/your-org/FS-AnnoTools3.git /opt/fs-annotools3/app

# または: ローカルからSCP
# scp -r /path/to/FS-AnnoTools3 user@server:/tmp/
# sudo mv /tmp/FS-AnnoTools3 /opt/fs-annotools3/app
# sudo chown -R fsanno:fsanno /opt/fs-annotools3/app

cd /opt/fs-annotools3/app
```

### 2. 本番環境設定ファイル作成

#### バックエンド環境設定

```bash
# 本番用環境変数ファイル作成
sudo -u fsanno cat > /opt/fs-annotools3/app/backend/.env.production << 'EOF'
# FS-AnnoTools3 Production Configuration

# Server Configuration
PORT=3001
HOST=127.0.0.1
NODE_ENV=production

# Database Configuration
DATABASE_PATH=/opt/fs-annotools3/data/annotations.db
DB_MAX_CONNECTIONS=20

# JWT Configuration (ランダムな64文字の文字列に変更)
JWT_SECRET=CHANGE_THIS_TO_A_SECURE_64_CHAR_RANDOM_STRING_IN_PRODUCTION_ENV
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute

# Video Storage
VIDEOS_PATH=/opt/fs-annotools3/videos
MAX_FILE_SIZE=500

# Authentication
BCRYPT_ROUNDS=12
DEFAULT_ADMIN_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# Logging
LOG_LEVEL=info
EOF
```

#### フロントエンド環境設定

```bash
# 本番用環境変数ファイル作成
sudo -u fsanno cat > /opt/fs-annotools3/app/frontend/.env.production << 'EOF'
VITE_API_URL=https://annotator.lab-univ.ac.jp/api
EOF
```

### 3. ディレクトリ構造の作成

```bash
# 必要なディレクトリ作成
sudo -u fsanno mkdir -p /opt/fs-annotools3/data
sudo -u fsanno mkdir -p /opt/fs-annotools3/videos/original
sudo -u fsanno mkdir -p /opt/fs-annotools3/videos/optimized
sudo -u fsanno mkdir -p /opt/fs-annotools3/logs
sudo -u fsanno mkdir -p /opt/fs-annotools3/backups

# 権限設定
sudo chmod 755 /opt/fs-annotools3/videos
sudo chmod 644 /opt/fs-annotools3/app/backend/.env.production
sudo chmod 644 /opt/fs-annotools3/app/frontend/.env.production
```

### 4. 依存関係インストールとビルド

```bash
cd /opt/fs-annotools3/app

# 依存関係インストール
sudo -u fsanno npm run install:all

# 本番ビルド実行
sudo -u fsanno NODE_ENV=production npm run build:full

# ビルド確認
ls -la frontend/dist/
ls -la backend/dist/
```

### 5. データベース初期化

```bash
# データベースディレクトリの権限確認
sudo chown fsanno:fsanno /opt/fs-annotools3/data

# バックエンドのテスト実行（データベース初期化）
cd /opt/fs-annotools3/app/backend
sudo -u fsanno NODE_ENV=production node dist/index.js &
BACKEND_PID=$!

# しばらく待ってから停止
sleep 5
kill $BACKEND_PID

# データベースファイル確認
ls -la /opt/fs-annotools3/data/
```

## Nginx設定

### 1. Nginx設定ファイル作成

```bash
# メイン設定ファイル作成
sudo cat > /etc/nginx/sites-available/fs-annotools3 << 'EOF'
# FS-AnnoTools3 Nginx Configuration

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=3r/m;

# Upstream backend
upstream fs_annotools3_backend {
    server 127.0.0.1:3001;
    keepalive 16;
}

server {
    listen 80;
    server_name annotator.lab-univ.ac.jp;  # ドメイン名を変更
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name annotator.lab-univ.ac.jp;  # ドメイン名を変更

    # SSL Configuration (Let's Encryptで自動設定)
    ssl_certificate /etc/letsencrypt/live/annotator.lab-univ.ac.jp/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/annotator.lab-univ.ac.jp/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # COOP/COEP headers for WebCodecs API
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;

    # Logging
    access_log /var/log/nginx/fs-annotools3.access.log;
    error_log /var/log/nginx/fs-annotools3.error.log;

    # Root directory
    root /opt/fs-annotools3/app/frontend/dist;
    index index.html;

    # Client settings
    client_max_body_size 500M;
    client_body_timeout 300s;
    client_header_timeout 300s;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Static files (Frontend)
    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://fs_annotools3_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Auth endpoints (stricter rate limiting)
    location ~ ^/api/(auth|login)/ {
        limit_req zone=login burst=5 nodelay;

        proxy_pass http://fs_annotools3_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Video files
    location /videos/ {
        alias /opt/fs-annotools3/videos/;

        # Security: prevent directory listing
        autoindex off;

        # Video file access control
        location ~ \.(mp4|webm|avi|mov|mkv)$ {
            # Range requests for video streaming
            add_header Accept-Ranges bytes;

            # Cache videos for 1 hour
            expires 1h;
            add_header Cache-Control "public";

            # CORP header for video files
            add_header Cross-Origin-Resource-Policy "cross-origin";
        }
    }

    # Health check
    location /health {
        proxy_pass http://fs_annotools3_backend/health;
        access_log off;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ \.(env|conf|config)$ {
        deny all;
    }
}
EOF

# 設定を有効化
sudo ln -s /etc/nginx/sites-available/fs-annotools3 /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 設定テスト
sudo nginx -t
```

## SSL/HTTPS設定

### 1. Let's Encrypt証明書取得

```bash
# Nginxを一時停止
sudo systemctl stop nginx

# SSL証明書取得（ドメイン名を変更）
sudo certbot certonly --standalone -d annotator.lab-univ.ac.jp

# Nginxを再起動
sudo systemctl start nginx

# 設定テスト
sudo nginx -t && sudo systemctl reload nginx
```

### 2. 証明書自動更新設定

```bash
# 更新テスト
sudo certbot renew --dry-run

# 自動更新設定（crontab）
sudo crontab -e
# 以下を追加
# 0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

## セキュリティ設定

### 1. JWT秘密鍵生成

```bash
# 安全なJWT秘密鍵を生成
JWT_SECRET=$(openssl rand -base64 64)
echo "Generated JWT Secret: $JWT_SECRET"

# 環境設定ファイルを更新
sudo -u fsanno sed -i "s/CHANGE_THIS_TO_A_SECURE_64_CHAR_RANDOM_STRING_IN_PRODUCTION_ENV/$JWT_SECRET/" /opt/fs-annotools3/app/backend/.env.production
```

### 2. 管理者パスワード設定

```bash
# 安全な管理者パスワードを生成
ADMIN_PASSWORD=$(openssl rand -base64 24)
echo "Generated Admin Password: $ADMIN_PASSWORD"

# 環境設定ファイルを更新
sudo -u fsanno sed -i "s/CHANGE_THIS_SECURE_PASSWORD/$ADMIN_PASSWORD/" /opt/fs-annotools3/app/backend/.env.production

echo "Admin credentials:"
echo "Username: admin"
echo "Password: $ADMIN_PASSWORD"
echo "Please save these credentials securely!"
```

### 3. ファイル権限設定

```bash
# アプリケーションファイルの権限設定
sudo chown -R fsanno:fsanno /opt/fs-annotools3/
sudo chmod -R 755 /opt/fs-annotools3/app/
sudo chmod 600 /opt/fs-annotools3/app/backend/.env.production
sudo chmod 600 /opt/fs-annotools3/app/frontend/.env.production

# ログディレクトリ権限
sudo chmod 755 /opt/fs-annotools3/logs
sudo chown fsanno:fsanno /opt/fs-annotools3/logs
```

## プロセス管理（PM2）

### 1. PM2設定ファイル作成

```bash
# PM2設定ファイル作成
sudo -u fsanno cat > /opt/fs-annotools3/app/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'fs-annotools3-backend',
    script: './dist/index.js',
    cwd: '/opt/fs-annotools3/app/backend',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    env_file: '/opt/fs-annotools3/app/backend/.env.production',
    log_file: '/opt/fs-annotools3/logs/app.log',
    out_file: '/opt/fs-annotools3/logs/app-out.log',
    error_file: '/opt/fs-annotools3/logs/app-error.log',
    time: true,
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',
    restart_delay: 4000,
    watch: false,
    ignore_watch: ['node_modules', '*.log'],
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
```

### 2. アプリケーション起動

```bash
# PM2でアプリケーション起動
sudo -u fsanno pm2 start /opt/fs-annotools3/app/ecosystem.config.js

# 起動確認
sudo -u fsanno pm2 status
sudo -u fsanno pm2 logs

# PM2設定保存
sudo -u fsanno pm2 save

# システム起動時の自動起動設定
sudo -u fsanno pm2 startup systemd -u fsanno --hp /opt/fs-annotools3
# 表示されたコマンドを実行
```

## 監視・ログ管理

### 1. ログローテーション設定

```bash
# logrotate設定作成
sudo cat > /etc/logrotate.d/fs-annotools3 << 'EOF'
/opt/fs-annotools3/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 fsanno fsanno
    postrotate
        sudo -u fsanno pm2 reloadLogs
    endscript
}

/var/log/nginx/fs-annotools3.*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF
```

### 2. システム監視スクリプト

```bash
# 監視スクリプト作成
sudo cat > /opt/fs-annotools3/scripts/monitor.sh << 'EOF'
#!/bin/bash

# FS-AnnoTools3 System Monitor Script

LOG_FILE="/opt/fs-annotools3/logs/monitor.log"
EMAIL_ALERT="admin@lab-univ.ac.jp"  # 管理者メールアドレス

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

check_service() {
    local service=$1
    if ! systemctl is-active --quiet "$service"; then
        log "ERROR: $service is not running"
        echo "Service $service is down on $(hostname)" | mail -s "FS-AnnoTools3 Alert" "$EMAIL_ALERT"
        return 1
    fi
    return 0
}

check_disk_space() {
    local usage=$(df /opt/fs-annotools3 | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 85 ]; then
        log "WARNING: Disk usage is ${usage}%"
        echo "Disk usage is ${usage}% on $(hostname)" | mail -s "FS-AnnoTools3 Disk Alert" "$EMAIL_ALERT"
    fi
}

check_app_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
    if [ "$response" != "200" ]; then
        log "ERROR: Application health check failed (HTTP $response)"
        echo "Application health check failed on $(hostname)" | mail -s "FS-AnnoTools3 App Alert" "$EMAIL_ALERT"

        # Try to restart the application
        sudo -u fsanno pm2 restart fs-annotools3-backend
        log "Attempted to restart application"
    fi
}

# Main monitoring
log "Starting system monitor check"

check_service nginx
check_service pm2-fsanno
check_disk_space
check_app_health

log "Monitor check completed"
EOF

sudo chmod +x /opt/fs-annotools3/scripts/monitor.sh
sudo chown fsanno:fsanno /opt/fs-annotools3/scripts/monitor.sh

# Cron設定（5分毎に監視）
sudo crontab -e
# 以下を追加
# */5 * * * * /opt/fs-annotools3/scripts/monitor.sh
```

## バックアップ設定

### 1. バックアップスクリプト作成

```bash
# バックアップスクリプト作成
sudo cat > /opt/fs-annotools3/scripts/backup.sh << 'EOF'
#!/bin/bash

# FS-AnnoTools3 Backup Script

BACKUP_DIR="/opt/fs-annotools3/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Database backup
backup_database() {
    log "Backing up database..."
    cp /opt/fs-annotools3/data/annotations.db "$BACKUP_DIR/annotations_${DATE}.db"

    if [ $? -eq 0 ]; then
        log "Database backup completed: annotations_${DATE}.db"
    else
        log "ERROR: Database backup failed"
        return 1
    fi
}

# Configuration backup
backup_config() {
    log "Backing up configuration..."
    tar -czf "$BACKUP_DIR/config_${DATE}.tar.gz" \
        /opt/fs-annotools3/app/backend/.env.production \
        /opt/fs-annotools3/app/frontend/.env.production \
        /etc/nginx/sites-available/fs-annotools3 \
        /opt/fs-annotools3/app/ecosystem.config.js

    if [ $? -eq 0 ]; then
        log "Configuration backup completed: config_${DATE}.tar.gz"
    else
        log "ERROR: Configuration backup failed"
        return 1
    fi
}

# Annotation data backup
backup_annotations() {
    log "Backing up annotation data..."
    if [ -d "/opt/fs-annotools3/app/backend/annotations" ]; then
        tar -czf "$BACKUP_DIR/annotations_${DATE}.tar.gz" \
            /opt/fs-annotools3/app/backend/annotations/

        if [ $? -eq 0 ]; then
            log "Annotation data backup completed: annotations_${DATE}.tar.gz"
        else
            log "ERROR: Annotation data backup failed"
            return 1
        fi
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
    find "$BACKUP_DIR" -name "*.db" -mtime +${RETENTION_DAYS} -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete
    log "Cleanup completed"
}

# Main backup process
log "Starting backup process..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

backup_database
backup_config
backup_annotations
cleanup_old_backups

log "Backup process completed"

# Show backup status
echo "Current backups:"
ls -la "$BACKUP_DIR"
EOF

sudo chmod +x /opt/fs-annotools3/scripts/backup.sh
sudo chown fsanno:fsanno /opt/fs-annotools3/scripts/backup.sh

# 日次バックアップのCron設定
sudo crontab -e
# 以下を追加
# 0 2 * * * /opt/fs-annotools3/scripts/backup.sh >> /opt/fs-annotools3/logs/backup.log 2>&1
```

## 運用・メンテナンス

### 1. アプリケーション更新スクリプト

```bash
# 更新デプロイスクリプト作成
sudo cat > /opt/fs-annotools3/scripts/deploy.sh << 'EOF'
#!/bin/bash

# FS-AnnoTools3 Deployment Script

APP_DIR="/opt/fs-annotools3/app"
BACKUP_DIR="/opt/fs-annotools3/backups"
DATE=$(date +%Y%m%d_%H%M%S)

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

# Pre-deployment backup
pre_deploy_backup() {
    log "Creating pre-deployment backup..."
    /opt/fs-annotools3/scripts/backup.sh

    # Backup current application code
    tar -czf "$BACKUP_DIR/app_code_${DATE}.tar.gz" \
        --exclude="$APP_DIR/node_modules" \
        --exclude="$APP_DIR/frontend/dist" \
        --exclude="$APP_DIR/backend/dist" \
        "$APP_DIR"

    log "Pre-deployment backup completed"
}

# Update application code
update_code() {
    log "Updating application code..."
    cd "$APP_DIR"

    # Pull latest code (if using Git)
    sudo -u fsanno git pull origin main || error_exit "Failed to pull latest code"

    log "Code update completed"
}

# Install dependencies and build
build_application() {
    log "Installing dependencies and building application..."
    cd "$APP_DIR"

    # Install dependencies
    sudo -u fsanno npm run install:all || error_exit "Failed to install dependencies"

    # Build application
    sudo -u fsanno NODE_ENV=production npm run build:full || error_exit "Failed to build application"

    log "Application build completed"
}

# Restart services
restart_services() {
    log "Restarting services..."

    # Restart PM2 application
    sudo -u fsanno pm2 restart fs-annotools3-backend || error_exit "Failed to restart application"

    # Reload Nginx
    sudo systemctl reload nginx || error_exit "Failed to reload Nginx"

    log "Services restarted successfully"
}

# Health check
health_check() {
    log "Performing health check..."

    sleep 10  # Wait for services to start

    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
    if [ "$response" != "200" ]; then
        error_exit "Health check failed (HTTP $response)"
    fi

    log "Health check passed"
}

# Main deployment process
log "Starting deployment process..."

pre_deploy_backup
update_code
build_application
restart_services
health_check

log "Deployment completed successfully"
EOF

sudo chmod +x /opt/fs-annotools3/scripts/deploy.sh
sudo chown fsanno:fsanno /opt/fs-annotools3/scripts/deploy.sh
```

### 2. システム情報確認スクリプト

```bash
# システム情報確認スクリプト
sudo cat > /opt/fs-annotools3/scripts/status.sh << 'EOF'
#!/bin/bash

# FS-AnnoTools3 Status Check Script

echo "=== FS-AnnoTools3 System Status ==="
echo "Date: $(date)"
echo

echo "=== System Resources ==="
echo "Memory Usage:"
free -h

echo
echo "Disk Usage:"
df -h /opt/fs-annotools3

echo
echo "=== Service Status ==="
echo "Nginx:"
systemctl is-active nginx && echo "✅ Running" || echo "❌ Stopped"

echo
echo "PM2 Application:"
sudo -u fsanno pm2 jlist | jq -r '.[] | select(.name=="fs-annotools3-backend") | "Status: \(.pm2_env.status), CPU: \(.monit.cpu)%, Memory: \(.monit.memory/1024/1024 | floor)MB"'

echo
echo "=== Application Health ==="
response=$(curl -s http://localhost:3001/health)
if [ $? -eq 0 ]; then
    echo "✅ Application is responding"
    echo "Response: $response"
else
    echo "❌ Application is not responding"
fi

echo
echo "=== Recent Logs ==="
echo "Application Errors (last 10 lines):"
tail -n 10 /opt/fs-annotools3/logs/app-error.log

echo
echo "Nginx Errors (last 5 lines):"
tail -n 5 /var/log/nginx/fs-annotools3.error.log

echo
echo "=== Database Status ==="
if [ -f "/opt/fs-annotools3/data/annotations.db" ]; then
    db_size=$(du -h /opt/fs-annotools3/data/annotations.db | cut -f1)
    echo "✅ Database exists (Size: $db_size)"
else
    echo "❌ Database not found"
fi

echo
echo "=== Video Storage ==="
if [ -d "/opt/fs-annotools3/videos" ]; then
    video_count=$(find /opt/fs-annotools3/videos -name "*.mp4" | wc -l)
    storage_size=$(du -sh /opt/fs-annotools3/videos | cut -f1)
    echo "✅ Video storage available"
    echo "Videos: $video_count files"
    echo "Storage: $storage_size"
else
    echo "❌ Video storage not found"
fi

echo
echo "=== SSL Certificate ==="
cert_expiry=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/annotator.lab-univ.ac.jp/cert.pem 2>/dev/null | cut -d= -f2)
if [ $? -eq 0 ]; then
    echo "✅ SSL Certificate valid until: $cert_expiry"
else
    echo "❌ SSL Certificate not found or invalid"
fi

echo
echo "Status check completed."
EOF

sudo chmod +x /opt/fs-annotools3/scripts/status.sh
```

### 3. 管理用コマンド集

```bash
# 管理用コマンドエイリアス設定
sudo cat >> /home/ubuntu/.bashrc << 'EOF'

# FS-AnnoTools3 Management Aliases
alias fs-status='/opt/fs-annotools3/scripts/status.sh'
alias fs-backup='/opt/fs-annotools3/scripts/backup.sh'
alias fs-deploy='/opt/fs-annotools3/scripts/deploy.sh'
alias fs-logs='sudo -u fsanno pm2 logs fs-annotools3-backend'
alias fs-restart='sudo -u fsanno pm2 restart fs-annotools3-backend && sudo systemctl reload nginx'
alias fs-monitor='tail -f /opt/fs-annotools3/logs/monitor.log'
EOF
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. アプリケーションが起動しない

```bash
# PM2ログ確認
sudo -u fsanno pm2 logs fs-annotools3-backend

# 環境変数確認
sudo -u fsanno cat /opt/fs-annotools3/app/backend/.env.production

# ポート確認
sudo netstat -tlnp | grep 3001

# 手動起動テスト
cd /opt/fs-annotools3/app/backend
sudo -u fsanno NODE_ENV=production node dist/index.js
```

#### 2. Nginx設定エラー

```bash
# 設定ファイルテスト
sudo nginx -t

# エラーログ確認
sudo tail -f /var/log/nginx/error.log

# 設定リロード
sudo systemctl reload nginx
```

#### 3. SSL証明書問題

```bash
# 証明書確認
sudo certbot certificates

# 証明書更新
sudo certbot renew

# Nginx設定確認
sudo nginx -t
```

#### 4. データベース問題

```bash
# データベースファイル確認
ls -la /opt/fs-annotools3/data/

# SQLiteデータベースチェック
sqlite3 /opt/fs-annotools3/data/annotations.db ".tables"

# 権限確認
sudo chown fsanno:fsanno /opt/fs-annotools3/data/annotations.db
```

#### 5. 動画アップロード問題

```bash
# 動画ディレクトリ権限確認
ls -la /opt/fs-annotools3/videos/

# Nginx upload制限確認
grep client_max_body_size /etc/nginx/sites-available/fs-annotools3

# FFmpeg動作確認
ffmpeg -version
```

### 緊急対応手順

#### システム復旧

```bash
# 1. サービス停止
sudo systemctl stop nginx
sudo -u fsanno pm2 stop all

# 2. バックアップから復元
cd /opt/fs-annotools3/backups
# 最新のバックアップファイル確認
ls -la

# データベース復元
cp annotations_YYYYMMDD_HHMMSS.db /opt/fs-annotools3/data/annotations.db

# 設定ファイル復元
tar -xzf config_YYYYMMDD_HHMMSS.tar.gz -C /

# 3. サービス再起動
sudo systemctl start nginx
sudo -u fsanno pm2 start ecosystem.config.js
```

#### 完全な再構築

```bash
# アプリケーション完全停止
sudo -u fsanno pm2 delete all
sudo systemctl stop nginx

# クリーンビルド
cd /opt/fs-annotools3/app
sudo -u fsanno npm run clean:all
sudo -u fsanno npm run install:all
sudo -u fsanno NODE_ENV=production npm run build:full

# サービス再起動
sudo -u fsanno pm2 start ecosystem.config.js
sudo systemctl start nginx

# 健全性確認
/opt/fs-annotools3/scripts/status.sh
```

### パフォーマンス最適化

#### 1. Node.js メモリ設定

```bash
# ecosystem.config.jsのメモリ設定調整
# max_memory_restart: '1G'  # 大きなビデオファイル処理用
# node_args: '--max-old-space-size=1024'
```

#### 2. Nginx キャッシュ設定

```bash
# /etc/nginx/sites-available/fs-annotools3に追加
# proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;
```

#### 3. データベース最適化

```bash
# SQLite最適化（定期実行）
sqlite3 /opt/fs-annotools3/data/annotations.db "VACUUM; ANALYZE;"
```

## セキュリティチェックリスト

- [ ] JWT秘密鍵が十分に複雑で安全
- [ ] 管理者パスワードが強力で安全
- [ ] SSL証明書が有効で自動更新設定済み
- [ ] ファイアウォールが適切に設定
- [ ] 不要なポートが閉鎖されている
- [ ] アプリケーションが非root権限で実行
- [ ] ログローテーションが設定済み
- [ ] バックアップが定期実行されている
- [ ] 監視システムが動作中
- [ ] セキュリティヘッダーが適切に設定
- [ ] Rate limitingが有効
- [ ] CORS設定が適切
- [ ] 動画ファイルアクセスが制限されている
- [ ] データベースファイルが外部からアクセス不可

---

## まとめ

この手順書に従って設定することで、FS-AnnoTools3を研究室のUbuntuサーバーで安全かつ安定して運用できます。

### 重要なポイント
1. **セキュリティ**: HTTPS必須、強力な認証、適切な権限設定
2. **監視**: システム監視、ログ管理、アラート設定
3. **バックアップ**: 定期バックアップ、復旧手順の確認
4. **運用**: 更新手順、トラブルシューティング、パフォーマンス監視

### 運用開始後の定期作業
- 週次: システム状況確認、ログ確認
- 月次: バックアップ確認、セキュリティアップデート
- 四半期: 証明書更新確認、パフォーマンス分析

研究室での本番運用を開始する前に、テスト環境での動作確認を強く推奨します。