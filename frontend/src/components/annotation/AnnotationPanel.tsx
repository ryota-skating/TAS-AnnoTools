/**
 * Annotation Panel Component - Simplified
 * Shows annotation progress and annotated labels only
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { AnnotationSegment } from '../../types/api';
import { FIGURE_SKATING_ELEMENTS, getElementByName, type FigureSkatingElement } from '@shared/types/figure-skating';
import { LabelSelector } from './LabelSelector';
import { apiService } from '../../services/api';
import { processAnnotationLabelsToSegments, calculateAnnotationStats, type LabelSegment } from '../../utils/annotationUtils';
import './AnnotationPanel.css';

interface AnnotationPanelProps {
  videoId: string;
  currentFrame: number;
  totalFrames: number;
  segments: AnnotationSegment[];
  selectedSegment: AnnotationSegment | null;
  selectionRange: { start: number; end: number } | null;
  onSegmentCreate: (segment: Omit<AnnotationSegment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSegmentUpdate: (segment: AnnotationSegment) => void;
  onSegmentDelete: (segmentId: string) => void;
  onSaveAnnotations: () => Promise<void>;
  annotationLabels?: string[]; // Frame-based annotation labels
  onFrameClick?: (frameNumber: number) => void; // Navigation to specific frame
  videoFilename?: string; // For API calls
  onAnnotationLabelsChange?: (labels: string[]) => void; // For updating parent state
}

interface AnnotationStats {
  totalSegments: number;
  annotatedFrames: number;
  annotationRate: number;
  elementCounts: Record<number, number>;
}



export function AnnotationPanel({
  videoId,
  currentFrame,
  totalFrames,
  segments,
  selectedSegment,
  selectionRange,
  onSegmentCreate,
  onSegmentUpdate,
  onSegmentDelete,
  onSaveAnnotations,
  annotationLabels = [],
  onFrameClick,
  videoFilename,
  onAnnotationLabelsChange
}: AnnotationPanelProps) {
  const [annotationStats, setAnnotationStats] = useState<AnnotationStats>({
    totalSegments: 0,
    annotatedFrames: 0,
    annotationRate: 0,
    elementCounts: {}
  });

  // Segment editing state
  const [editingSegment, setEditingSegment] = useState<LabelSegment | null>(null);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [labelSelectorPosition, setLabelSelectorPosition] = useState({ x: 0, y: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<LabelSegment | null>(null);

  // Process annotation labels to create frame-based segments using shared utility
  const [labelSegments, setLabelSegments] = useState<LabelSegment[]>([]);

  // Update segments when annotation labels change (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!annotationLabels || annotationLabels.length === 0) {
        setLabelSegments([]);
        return;
      }
      const segments = processAnnotationLabelsToSegments(annotationLabels);
      setLabelSegments(segments);
    }, 100); // 100ms debounce to prevent excessive recalculation

    return () => clearTimeout(timeoutId);
  }, [annotationLabels]);

  // Update annotation statistics using shared utility (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stats = calculateAnnotationStats(annotationLabels, totalFrames);
      setAnnotationStats(stats);
    }, 150); // 150ms debounce to prevent excessive recalculation

    return () => clearTimeout(timeoutId);
  }, [annotationLabels, totalFrames]);

  const handleLabelSegmentClick = (segment: LabelSegment) => {

    if (onFrameClick) {
      onFrameClick(segment.startFrame);
    } else {

    }
  };

  const handleEditSegment = (segment: LabelSegment, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering segment click

    
    setEditingSegment(segment);
    const position = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
    setLabelSelectorPosition(position);
    setShowLabelSelector(true);
    

  };

  const handleDeleteSegment = (segment: LabelSegment, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering segment click
    setSegmentToDelete(segment);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSegment = async () => {
    if (!segmentToDelete || !annotationLabels) return;

    // Create updated annotation labels with the segment frames set to 'NONE'
    const updatedLabels = [...annotationLabels];
    for (let i = segmentToDelete.startFrame; i <= segmentToDelete.endFrame; i++) {
      if (i < updatedLabels.length) {
        updatedLabels[i] = 'NONE';
      }
    }

    // Save to backend via API call
    if (videoFilename && apiService.token) {
      try {
        console.log('Deleting segment:', {
          videoFilename,
          segmentFrames: `${segmentToDelete.startFrame}-${segmentToDelete.endFrame}`,
          updatedLabelsLength: updatedLabels.length,
          deletedFramesCount: segmentToDelete.endFrame - segmentToDelete.startFrame + 1
        });
        
        const response = await apiService.updateAnnotationBatch(videoFilename, updatedLabels);
        
        console.log('Delete response:', response);
        
        if (response.success) {
          // Update the annotation labels only after successful backend save
          onAnnotationLabelsChange?.(updatedLabels);
          console.log('Successfully deleted segment and updated annotation labels');
        } else {
          console.error('Failed to save annotation deletion:', response);
          return; // Don't close dialog if save failed
        }
      } catch (error) {
        console.error('Error saving annotation deletion:', error);
        return; // Don't close dialog if save failed
      }
    } else {
      console.warn('No videoFilename or token, updating locally only');
      // Update locally if no backend connection
      onAnnotationLabelsChange?.(updatedLabels);
    }

    // Close the confirmation dialog
    setShowDeleteConfirm(false);
    setSegmentToDelete(null);
  };

  const cancelDeleteSegment = () => {
    setShowDeleteConfirm(false);
    setSegmentToDelete(null);
  };

  const handleLabelSelect = async (element: FigureSkatingElement) => {
    if (!editingSegment || !annotationLabels) return;
    


    // Create updated annotation labels
    const updatedLabels = [...annotationLabels];
    
    // Ensure the array has enough elements
    const maxFrame = Math.max(editingSegment.endFrame, updatedLabels.length - 1);
    while (updatedLabels.length <= maxFrame) {
      updatedLabels.push('NONE');
    }
    
    // Update labels for the selected segment
    for (let i = editingSegment.startFrame; i <= editingSegment.endFrame; i++) {
      updatedLabels[i] = element.name;
    }
    
    // Save to backend via API call
    if (videoFilename && apiService.token) {
      try {
        const response = await apiService.updateAnnotationBatch(videoFilename, updatedLabels);
        if (response.success) {
          onAnnotationLabelsChange?.(updatedLabels);

        } else {
          console.error('AnnotationPanel: Failed to save annotation:', response);
        }
      } catch (error) {
        console.error('AnnotationPanel: Error saving annotation:', error);
      }
    }
    
    setShowLabelSelector(false);
    setEditingSegment(null);
  };

  const handleCloseLabelSelector = () => {
    setShowLabelSelector(false);
    setEditingSegment(null);
  };

  return (
    <div className="annotation-panel">
      {/* Statistics */}
      <div className="annotation-stats">
        <h3>Annotation Progress</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Segments</span>
            <span className="stat-value">{annotationStats.totalSegments}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Coverage</span>
            <span className="stat-value">{annotationStats.annotationRate.toFixed(1)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Frames</span>
            <span className="stat-value">{annotationStats.annotatedFrames}</span>
          </div>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${annotationStats.annotationRate}%` }}
          />
        </div>
      </div>



      {/* Frame-based Elements (from annotation labels) */}
      <div className="frame-based-elements">
        <h3>Annotated Elements</h3>
        {labelSegments.length === 0 ? (
          <p className="no-annotations">No annotations yet</p>
        ) : (
          <div className="segments-container">
            {labelSegments.map((segment, index) => {
              const isCurrentSegment = currentFrame >= segment.startFrame && currentFrame <= segment.endFrame;
              const duration = segment.endFrame - segment.startFrame + 1;
              
              return (
                <div
                  key={`${segment.element.name}-${segment.startFrame}-${index}`}
                  className={`segment-item ${isCurrentSegment ? 'current' : ''}`}
                  onClick={() => handleLabelSegmentClick(segment)}
                  title={`Jump to frame ${segment.startFrame}`}
                >
                  <div className="segment-header">
                    <div 
                      className="segment-color"
                      style={{ backgroundColor: segment.element.color }}
                    />
                    <div className="segment-info">
                      <div className="segment-name">
                        {segment.element.name.replace(/_/g, ' ')}
                      </div>
                      <div className="segment-details">
                        <span className="segment-frames">
                          {segment.startFrame} - {segment.endFrame}
                        </span>
                        <span className="segment-duration">
                          ({duration} frames)
                        </span>
                      </div>
                    </div>
                    <button
                      className="edit-segment-btn"
                      onClick={(e) => handleEditSegment(segment, e)}
                      title="Edit label"
                    >
                      {/* Pen icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      className="delete-segment-btn"
                      onClick={(e) => handleDeleteSegment(segment, e)}
                      title="Delete segment"
                    >
                      {/* Trash icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Label Selector for editing */}
      <LabelSelector
        isOpen={showLabelSelector}
        position={labelSelectorPosition}
        currentLabel={editingSegment?.element.name}
        onSelect={handleLabelSelect}
        onClose={handleCloseLabelSelector}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={cancelDeleteSegment}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <h3>Delete Segment</h3>
            </div>
            <div className="delete-confirm-body">
              <p>Are you sure you want to delete this segment?</p>
              {segmentToDelete && (
                <div className="segment-info-preview">
                  <div className="segment-preview">
                    <span style={{ backgroundColor: segmentToDelete.element.color }} className="segment-color-preview"></span>
                    <span className="segment-name-preview">{segmentToDelete.element.name}</span>
                    <span className="segment-range-preview">
                      Frames {segmentToDelete.startFrame}-{segmentToDelete.endFrame}
                    </span>
                  </div>
                </div>
              )}
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="delete-confirm-actions">
              <button 
                className="btn-cancel"
                onClick={cancelDeleteSegment}
              >
                Cancel
              </button>
              <button 
                className="btn-delete"
                onClick={confirmDeleteSegment}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}