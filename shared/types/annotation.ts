/**
 * Annotation Data Types
 * Frame-based annotation system for TAS dataset creation
 */

import type { ElementId } from './figure-skating.js';

// Frame number (0-based)
export type FrameNumber = number;

// Video ID (unique identifier)
export type VideoId = string;

// User/Annotator ID
export type UserId = string;

// Annotation segment (frame-based)
export interface AnnotationSegment {
  id: string; // Unique segment ID
  videoId: VideoId;
  startFrame: FrameNumber; // Start frame (inclusive)
  endFrame: FrameNumber; // End frame (inclusive)
  elementId: ElementId; // Figure skating element ID (0-55)
  annotatorId: UserId;
  createdAt: Date;
  updatedAt: Date;
  confidence?: number; // Optional confidence score (0-1)
  notes?: string; // Optional notes
}

// Video metadata
export interface VideoMetadata {
  id: VideoId;
  title: string;
  path: string; // File path or URL
  fps: number; // Frames per second (fixed)
  durationFrames: FrameNumber; // Total number of frames
  hash: string; // File hash for integrity check
  size: number; // File size in bytes
  mtime: Date; // Last modified time
  createdAt: Date;
}

// Annotation project
export interface AnnotationProject {
  id: string;
  name: string;
  description?: string;
  videos: VideoMetadata[];
  labelSet: LabelSet;
  createdAt: Date;
  updatedAt: Date;
}

// Label set configuration
export interface LabelSet {
  project: string;
  version: number;
  items: LabelItem[];
  updatedAt: Date;
}

// Individual label configuration
export interface LabelItem {
  elementId: ElementId;
  color: string; // Hex color for visualization
  description?: string;
  enabled: boolean;
}

// Annotation version (for conflict resolution)
export interface AnnotationVersion {
  id: string;
  videoId: VideoId;
  version: number;
  segments: AnnotationSegment[];
  updatedBy: UserId;
  updatedAt: Date;
  checksum: string; // Data integrity check
}

// User roles
export type UserRole = 'Admin' | 'Annotator' | 'Viewer';

// User information
export interface User {
  id: UserId;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  lastLoginAt?: Date;
}

// Authentication info
export interface AuthInfo {
  user: User;
  token: string;
  expiresAt: Date;
}

// Annotation statistics
export interface AnnotationStats {
  videoId: VideoId;
  totalSegments: number;
  annotatedFrames: FrameNumber;
  totalFrames: FrameNumber;
  annotationRate: number; // Percentage (0-100)
  elementCounts: Record<ElementId, number>;
  annotators: UserId[];
  lastUpdated: Date;
}

// Export formats
export type ExportFormat = 'json' | 'csv';

// Export data structure
export interface AnnotationExport {
  format: ExportFormat;
  project: string;
  videoId: VideoId;
  exportedAt: Date;
  annotatedBy: UserId;
  data: AnnotationSegment[];
  metadata: VideoMetadata;
}

// Import result
export interface ImportResult {
  success: boolean;
  importedSegments: number;
  skippedSegments: number;
  errors: string[];
  warnings: string[];
}

// Real-time progress update (WebSocket)
export interface ProgressUpdate {
  type: 'annotation_created' | 'annotation_updated' | 'annotation_deleted' | 'user_activity';
  videoId: VideoId;
  userId: UserId;
  timestamp: Date;
  data: any; // Type-specific data
}

// Timeline view configuration
export interface TimelineConfig {
  zoomLevel: number; // Pixels per frame
  viewportStart: FrameNumber; // First visible frame
  viewportEnd: FrameNumber; // Last visible frame
  selectedSegment?: string; // Selected segment ID
  showThumbnails: boolean;
  thumbnailInterval: number; // Frames between thumbnails
}

// Thumbnail data
export interface ThumbnailData {
  videoId: VideoId;
  frameNumber: FrameNumber;
  blob: Blob; // Image data
  width: number;
  height: number;
  generatedAt: Date;
}

// Performance metrics
export interface PerformanceMetrics {
  frameStepLatency: number; // ms
  zoomLatency: number; // ms
  thumbnailGenerationTime: number; // ms
  memoryUsage: number; // MB
  timestamp: Date;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'overlap' | 'invalid_range' | 'missing_element' | 'invalid_frame';
  message: string;
  segmentId?: string;
  frameNumber?: FrameNumber;
}

export interface ValidationWarning {
  type: 'short_segment' | 'long_gap' | 'frequent_element';
  message: string;
  segmentId?: string;
  frameNumber?: FrameNumber;
}

// API request/response types
export interface CreateSegmentRequest {
  videoId: VideoId;
  startFrame: FrameNumber;
  endFrame: FrameNumber;
  elementId: ElementId;
  notes?: string;
}

export interface UpdateSegmentRequest {
  startFrame?: FrameNumber;
  endFrame?: FrameNumber;
  elementId?: ElementId;
  notes?: string;
}

export interface SegmentListResponse {
  segments: AnnotationSegment[];
  totalCount: number;
  hasMore: boolean;
}

// Utility functions for working with annotations
export function validateSegment(segment: AnnotationSegment): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check frame range
  if (segment.startFrame >= segment.endFrame) {
    errors.push({
      type: 'invalid_range',
      message: 'Start frame must be less than end frame',
      segmentId: segment.id,
    });
  }

  if (segment.startFrame < 0) {
    errors.push({
      type: 'invalid_frame',
      message: 'Start frame cannot be negative',
      segmentId: segment.id,
      frameNumber: segment.startFrame,
    });
  }

  // Warn about very short segments
  const duration = segment.endFrame - segment.startFrame;
  if (duration < 5) {
    warnings.push({
      type: 'short_segment',
      message: `Segment is very short (${duration} frames)`,
      segmentId: segment.id,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function checkSegmentOverlap(segment1: AnnotationSegment, segment2: AnnotationSegment): boolean {
  return !(segment1.endFrame < segment2.startFrame || segment2.endFrame < segment1.startFrame);
}

export function calculateAnnotationRate(stats: AnnotationStats): number {
  return (stats.annotatedFrames / stats.totalFrames) * 100;
}

export function frameToTimestamp(frameNumber: FrameNumber, fps: number): string {
  const totalSeconds = frameNumber / fps;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = frameNumber % fps;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames
    .toString()
    .padStart(2, '0')}`;
}

export function timestampToFrame(timestamp: string, fps: number): FrameNumber {
  const [time, frameStr] = timestamp.split('.');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const frames = frameStr ? parseInt(frameStr) : 0;

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return Math.floor(totalSeconds * fps) + frames;
}