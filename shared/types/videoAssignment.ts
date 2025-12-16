/**
 * Video Assignment Types
 * Types for user-video assignment system with pattern matching
 */

export interface VideoAssignment {
  id: string;
  userId: string;
  assignmentType: 'pattern' | 'explicit';

  // Pattern-based fields
  competition?: string;  // 'Olympic', 'World'
  gender?: string;       // 'Men', 'Women'
  numberStart?: number;  // Starting number (inclusive)
  numberEnd?: number;    // Ending number (inclusive)

  // Explicit assignment
  videoFilename?: string;

  // Metadata
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface ParsedVideo {
  competition: 'Olympic' | 'World';
  gender: 'Men' | 'Women';
  number: number;
  name: string;
  filename: string;
}

export interface AssignmentPattern {
  competition?: string;
  gender?: string;
  numberStart?: number;
  numberEnd?: number;
}

export interface CreateAssignmentRequest {
  userId: string;
  assignmentType: 'pattern' | 'explicit';
  competition?: string;
  gender?: string;
  numberStart?: number;
  numberEnd?: number;
  videoFilename?: string;
  notes?: string;
}

export interface BulkAssignmentSetup {
  usernames: string[];
  patterns: {
    competition: string;
    gender: string;
    start: number;
    end: number;
  }[];
}
