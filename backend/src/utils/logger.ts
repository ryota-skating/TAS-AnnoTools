/**
 * Logging Configuration
 * Structured logging with JSON Lines format for operational requirements
 */

import winston from 'winston';
import path from 'path';

// Custom log levels for application-specific events
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    performance: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    performance: 'cyan',
    debug: 'blue',
  },
};

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');

// JSON formatter for structured logging
const jsonFormatter = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console formatter for development
const consoleFormatter = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create winston logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormatter,
  defaultMeta: {
    service: 'fs-annotools3-backend',
    version: require('../../package.json').version,
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // Combined log file (JSON Lines format)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 7, // 7 generations as per requirement [OP-3]
      tailable: true,
    }),
    
    // Performance log file
    new winston.transports.File({
      filename: path.join(logDir, 'performance.log'),
      level: 'performance',
      maxsize: 25 * 1024 * 1024, // 25MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
    }),
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormatter,
    level: 'debug',
  }));
}

// Add colors for custom levels
winston.addColors(customLevels.colors);

// Performance logging utilities
export const performanceLogger = {
  logFrameStep: (latency: number, reqId?: string) => {
    logger.log('performance', 'Frame step latency recorded', {
      type: 'frame_step',
      latencyMs: latency,
      targetMs: 50,
      withinTarget: latency <= 50,
      reqId,
    });
  },
  
  logZoomPan: (latency: number, reqId?: string) => {
    logger.log('performance', 'Zoom/pan latency recorded', {
      type: 'zoom_pan',
      latencyMs: latency,
      targetMs: 33,
      withinTarget: latency <= 33,
      reqId,
    });
  },
  
  logThumbnailGeneration: (latency: number, frameNumber: number, reqId?: string) => {
    logger.log('performance', 'Thumbnail generation time recorded', {
      type: 'thumbnail_generation',
      latencyMs: latency,
      targetMs: 120,
      withinTarget: latency <= 120,
      frameNumber,
      reqId,
    });
  },
  
  logMemoryUsage: () => {
    const memoryUsage = process.memoryUsage();
    logger.log('performance', 'Memory usage recorded', {
      type: 'memory_usage',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
    });
  },
};

// Security logging utilities
export const securityLogger = {
  logLoginAttempt: (userId: string, ip: string, success: boolean, reqId?: string) => {
    logger.info('Authentication attempt', {
      type: 'auth_attempt',
      userId,
      ip: process.env.NODE_ENV === 'production' ? 'redacted' : ip, // Minimize PII in production
      success,
      reqId,
    });
  },
  
  logLoginBlock: (ip: string, reqId?: string) => {
    logger.warn('Login attempts blocked due to rate limiting', {
      type: 'auth_blocked',
      ip: process.env.NODE_ENV === 'production' ? 'redacted' : ip,
      reqId,
    });
  },
  
  logUnauthorizedAccess: (path: string, ip: string, reqId?: string) => {
    logger.warn('Unauthorized access attempt', {
      type: 'unauthorized_access',
      path,
      ip: process.env.NODE_ENV === 'production' ? 'redacted' : ip,
      reqId,
    });
  },
};

// Business logic logging utilities
export const businessLogger = {
  logAnnotationCreated: (segmentId: string, userId: string, videoId: string, reqId?: string) => {
    logger.info('Annotation segment created', {
      type: 'annotation_created',
      segmentId,
      userId,
      videoId,
      reqId,
    });
  },
  
  logAnnotationUpdated: (segmentId: string, userId: string, changes: any, reqId?: string) => {
    logger.info('Annotation segment updated', {
      type: 'annotation_updated',
      segmentId,
      userId,
      changes,
      reqId,
    });
  },
  
  logAnnotationDeleted: (segmentId: string, userId: string, reqId?: string) => {
    logger.info('Annotation segment deleted', {
      type: 'annotation_deleted',
      segmentId,
      userId,
      reqId,
    });
  },
  
  logVideoUpload: (videoId: string, userId: string, fileSize: number, reqId?: string) => {
    logger.info('Video uploaded', {
      type: 'video_upload',
      videoId,
      userId,
      fileSizeMB: Math.round(fileSize / 1024 / 1024),
      reqId,
    });
  },
  
  logExportRequest: (format: string, videoId: string, userId: string, reqId?: string) => {
    logger.info('Annotation export requested', {
      type: 'export_request',
      format,
      videoId,
      userId,
      reqId,
    });
  },
};

export { logger };