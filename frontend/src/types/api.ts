/**
 * API Types
 * Types for API requests and responses
 */

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: 'Admin' | 'Annotator' | 'Viewer';
  };
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'Admin' | 'Annotator' | 'Viewer';
  createdAt: string;
  lastLoginAt?: string;
}

export interface VideoMetadata {
  id: string;
  title: string;
  filename: string;
  path: string;
  fps: number;
  durationFrames: number;
  hash: string;
  createdAt: string;
  lastAnnotationUpdate?: string | null;
}

export interface AnnotationSegment {
  id: string;
  videoId: string;
  startFrame: number;
  endFrame: number;
  elementId: number;
  annotatorId: string;
  createdAt: string;
  updatedAt: string;
  confidence?: number;
  notes?: string;
}

export interface AnnotationData {
  videoId: string;
  version: number;
  segments: AnnotationSegment[];
  updatedAt: string;
  updatedBy: string;
}

export interface LabelItem {
  elementId: number;
  color: string;
  description?: string;
  enabled: boolean;
  name?: string;
  category?: string;
}

export interface LabelSet {
  project: string;
  version: number;
  items: LabelItem[];
  updatedAt: string;
  updatedBy?: string;
  isDefault?: boolean;
}

export interface PerformanceMetric {
  type: string;
  value: number;
  metadata?: any;
  sessionId?: string;
}