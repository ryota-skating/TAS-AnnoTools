/**
 * Database Service
 * SQLite database setup and management for TAS annotation data
 */

import sqlite3 from 'sqlite3';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export class Database {
  private db: sqlite3.Database | null = null;
  private static instance: Database;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(config.database.path);
      fs.mkdir(dataDir, { recursive: true }).then(() => {
        
        this.db = new sqlite3.Database(config.database.path, (err) => {
          if (err) {
            logger.error('Failed to connect to database', { error: err.message });
            reject(err);
          } else {
            logger.info('Connected to SQLite database', { path: config.database.path });
            resolve();
          }
        });
        
        // Enable WAL mode for better concurrency
        this.db.run('PRAGMA journal_mode = WAL;');
        this.db.run('PRAGMA foreign_keys = ON;');
        
      }).catch(reject);
    });
  }

  public async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database', { error: err.message });
            reject(err);
          } else {
            logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getDb(): sqlite3.Database {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  public async run(sql: string, params?: any[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.getDb().run(sql, params || [], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  public async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.getDb().get(sql, params || [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T);
        }
      });
    });
  }

  public async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.getDb().all(sql, params || [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve((rows || []) as T[]);
        }
      });
    });
  }
}

// Database migration function
async function migrateDatabase(): Promise<void> {
  const db = Database.getInstance();

  try {
    // Check if mapping_name column exists in label_sets
    const tableInfo = await db.all(`PRAGMA table_info(label_sets)`);
    const hasMappingColumn = tableInfo.some((col: any) => col.name === 'mapping_name');

    if (!hasMappingColumn) {
      logger.info('Adding mapping_name column to label_sets table');
      await db.run(`ALTER TABLE label_sets ADD COLUMN mapping_name TEXT DEFAULT 'default'`);
      logger.info('Migration completed: label_sets table updated');
    }
  } catch (error) {
    logger.warn('Migration check failed, table might not exist yet', { error });
  }
}

// Database schema creation
export async function setupDatabase(): Promise<void> {
  const db = Database.getInstance();
  await db.connect();

  // Users table
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      role TEXT CHECK(role IN ('Admin', 'Annotator', 'Viewer')) NOT NULL,
      password_hash TEXT,
      oauth_sub TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      is_active BOOLEAN DEFAULT 1
    )
  `);

  // Videos table
  await db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      path TEXT NOT NULL,
      fps REAL NOT NULL,
      duration_frames INTEGER NOT NULL,
      hash TEXT NOT NULL,
      size INTEGER NOT NULL,
      mtime DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Projects table
  await db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // Label sets table
  await db.run(`
    CREATE TABLE IF NOT EXISTS label_sets (
      project TEXT NOT NULL,
      version INTEGER NOT NULL,
      items_json TEXT NOT NULL,
      mapping_name TEXT DEFAULT 'default',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (project, version),
      FOREIGN KEY (project) REFERENCES projects(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);

  // Migrate existing label_sets table if needed
  await migrateDatabase();

  // Annotations table (versioned)
  await db.run(`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      payload_json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id),
      UNIQUE(video_id, version)
    )
  `);

  // Annotation segments table (for efficient querying)
  await db.run(`
    CREATE TABLE IF NOT EXISTS annotation_segments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      start_frame INTEGER NOT NULL,
      end_frame INTEGER NOT NULL,
      element_id INTEGER NOT NULL,
      annotator_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confidence REAL,
      notes TEXT,
      annotation_version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (annotator_id) REFERENCES users(id),
      CHECK (start_frame >= 0),
      CHECK (end_frame > start_frame),
      CHECK (element_id >= 0 AND element_id <= 55),
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
    )
  `);

  // Login attempts table (for rate limiting)
  await db.run(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN NOT NULL,
      user_agent TEXT
    )
  `);

  // Performance metrics table
  await db.run(`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      metadata_json TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      session_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes for better performance
  await db.run('CREATE INDEX IF NOT EXISTS idx_segments_video_frames ON annotation_segments(video_id, start_frame, end_frame)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_segments_element ON annotation_segments(element_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_segments_annotator ON annotation_segments(annotator_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time ON login_attempts(username, attempt_time)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_performance_type_time ON performance_metrics(type, recorded_at)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_videos_hash ON videos(hash)');

  // Create default admin user if none exists
  await createDefaultAdminUser();

  logger.info('Database schema setup completed');
}

async function createDefaultAdminUser(): Promise<void> {
  const db = Database.getInstance();
  
  const existingAdmin = await db.get(
    'SELECT id FROM users WHERE role = ? LIMIT 1',
    ['Admin']
  );

  if (!existingAdmin) {
    const bcrypt = require('bcrypt');
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(defaultPassword, config.auth.bcryptRounds);
    
    await db.run(`
      INSERT INTO users (id, name, username, email, role, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'admin-default',
      'Default Admin',
      'admin',
      'admin@localhost',
      'Admin',
      passwordHash
    ]);

    logger.info('Default admin user created', {
      email: 'admin@localhost',
      password: defaultPassword,
      warning: 'Change password immediately in production!'
    });
  }
}

// Database utility functions
export async function cleanupOldRecords(): Promise<void> {
  const db = Database.getInstance();
  
  // Clean up old login attempts (keep last 30 days)
  await db.run(`
    DELETE FROM login_attempts 
    WHERE attempt_time < datetime('now', '-30 days')
  `);
  
  // Clean up old performance metrics (keep last 7 days)
  await db.run(`
    DELETE FROM performance_metrics 
    WHERE recorded_at < datetime('now', '-7 days')
  `);
  
  logger.info('Old database records cleaned up');
}

// Export singleton instance
export const database = Database.getInstance();