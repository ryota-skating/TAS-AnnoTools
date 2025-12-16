/**
 * Application Configuration
 * Environment-based configuration for the TAS annotation tool backend
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    path: string;
    maxConnections: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  cors: {
    origin: string | string[] | boolean;
  };
  rateLimit: {
    max: number;
    timeWindow: string;
  };
  videos: {
    storagePath: string;
    maxFileSize: number;
    allowedFormats: string[];
  };
  auth: {
    bcryptRounds: number;
    loginAttempts: {
      max: number;
      windowMs: number;
      blockDurationMs: number;
    };
  };
  performance: {
    frameStepTargetMs: number;
    thumbnailCacheSize: number;
    thumbnailCacheSizeMB: number;
  };
  websocket: {
    heartbeatInterval: number;
    connectionTimeout: number;
  };
}

const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/annotations.db'),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set in production environment');
      }
      return 'dev-secret-key-change-in-production';
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  cors: {
    origin: (() => {
      // 優先: .env に CORS_ORIGIN があればそれを使う（複数可）
      if (process.env.CORS_ORIGIN) {
        return process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
      }

      // 本番環境（Cloudflareドメイン含む）を許可
      if (process.env.NODE_ENV === 'production') {
        return [
          'https://*.trycloudflare.com',
          'https://your-domain.com', // ← 将来カスタムドメインを使う場合ここに追記
        ];
      }

      // 開発環境（ローカル）を許可
      return [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
      ];
    })(),
  },
  
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },
  
  videos: {
    storagePath: process.env.VIDEOS_PATH || path.join(__dirname, '../../videos'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '500', 10) * 1024 * 1024, // 500MB default
    allowedFormats: ['mp4', 'webm'],
  },
  
  auth: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    loginAttempts: {
      max: 5, // As per requirement [SR-2]
      windowMs: 10 * 60 * 1000, // 10 minutes
      blockDurationMs: 10 * 60 * 1000, // 10 minutes block
    },
  },
  
  performance: {
    frameStepTargetMs: 50, // As per requirement [PR-1]
    thumbnailCacheSize: 200, // As per requirement [PR-6]
    thumbnailCacheSizeMB: 50, // As per requirement [PR-6]
  },
  
  websocket: {
    heartbeatInterval: 30000, // 30 seconds
    connectionTimeout: 60000, // 1 minute
  },
};

export { config };

// Validation functions
export function validateConfig(): void {
  const errors: string[] = [];
  
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('Invalid server port');
  }
  
  if (config.jwt.secret.length < 32) {
    errors.push('JWT secret must be at least 32 characters');
  }
  
  if (config.auth.bcryptRounds < 10 || config.auth.bcryptRounds > 15) {
    errors.push('Bcrypt rounds should be between 10-15');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
}

// Initialize configuration
validateConfig();