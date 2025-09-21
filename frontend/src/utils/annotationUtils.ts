/**
 * Annotation Processing Utilities
 * Centralized utilities for processing annotation labels to avoid duplication
 */

import { getElementByName, type FigureSkatingElement } from '@shared/types/figure-skating';

export interface AnnotationRect {
  startFrame: number;
  endFrame: number;
  color: string;
  label: string;
}

export interface LabelSegment {
  element: FigureSkatingElement;
  startFrame: number;
  endFrame: number;
}

/**
 * Convert annotation labels array to visual rectangles for seekbar
 * Optimized with early termination and minimal object creation
 */
export function processAnnotationLabelsToRects(
  annotationLabels: string[],
  maxFrames?: number
): AnnotationRect[] {
  if (!annotationLabels || annotationLabels.length === 0) return [];

  const rects: AnnotationRect[] = [];
  const endFrame = maxFrames ? Math.min(annotationLabels.length, maxFrames) : annotationLabels.length;

  let currentLabel = '';
  let startFrame = -1;

  for (let i = 0; i < endFrame; i++) {
    const label = annotationLabels[i];

    if (label !== 'NONE' && label !== currentLabel) {
      // End previous segment if exists
      if (currentLabel !== 'NONE' && currentLabel !== '' && startFrame !== -1) {
        const element = getElementByName(currentLabel as any);
        if (element) {
          rects.push({
            startFrame,
            endFrame: i - 1,
            color: element.color || '#64748b',
            label: currentLabel
          });
        }
      }
      // Start new segment
      currentLabel = label;
      startFrame = i;
    } else if (label === 'NONE' && currentLabel !== 'NONE' && currentLabel !== '') {
      // End current segment
      const element = getElementByName(currentLabel as any);
      if (element && startFrame !== -1) {
        rects.push({
          startFrame,
          endFrame: i - 1,
          color: element.color || '#64748b',
          label: currentLabel
        });
      }
      currentLabel = 'NONE';
      startFrame = -1;
    }
  }

  // Handle final segment
  if (currentLabel !== 'NONE' && currentLabel !== '' && startFrame !== -1) {
    const element = getElementByName(currentLabel as any);
    if (element) {
      rects.push({
        startFrame,
        endFrame: endFrame - 1,
        color: element.color || '#64748b',
        label: currentLabel
      });
    }
  }

  return rects;
}

/**
 * Convert annotation labels array to label segments for AnnotationPanel
 * Reuses the same logic as processAnnotationLabelsToRects but returns different format
 */
export function processAnnotationLabelsToSegments(
  annotationLabels: string[]
): LabelSegment[] {
  const rects = processAnnotationLabelsToRects(annotationLabels);

  return rects.map(rect => {
    const element = getElementByName(rect.label as any);
    return {
      element: element!,
      startFrame: rect.startFrame,
      endFrame: rect.endFrame
    };
  }).filter(segment => segment.element);
}

/**
 * Calculate annotation statistics efficiently
 */
export function calculateAnnotationStats(
  annotationLabels: string[],
  totalFrames: number
) {
  if (!annotationLabels || annotationLabels.length === 0) {
    return {
      totalSegments: 0,
      annotatedFrames: 0,
      annotationRate: 0,
      elementCounts: {}
    };
  }

  let annotatedFrames = 0;
  const elementCounts: Record<string, number> = {};

  // Single pass through the array
  for (const label of annotationLabels) {
    if (label !== 'NONE') {
      annotatedFrames++;
      elementCounts[label] = (elementCounts[label] || 0) + 1;
    }
  }

  const segments = processAnnotationLabelsToRects(annotationLabels);

  return {
    totalSegments: segments.length,
    annotatedFrames,
    annotationRate: totalFrames > 0 ? (annotatedFrames / totalFrames) * 100 : 0,
    elementCounts
  };
}