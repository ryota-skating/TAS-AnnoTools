/**
 * Simple Video Player Component
 * Standard HTML5 video element for quick testing and basic functionality
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getElementByName, getElementById } from '@shared/types/figure-skating';
import { LabelSelector } from '../annotation/LabelSelector';
import { apiService } from '../../services/api';
import { processAnnotationLabelsToRects, type AnnotationRect } from '../../utils/annotationUtils';
import type { LabelSet } from '../../types/api';
import './VideoPlayer.css';

interface SimpleVideoPlayerProps {
  videoUrl?: string;
  videoFilename?: string; // Added for annotation file identification
  fps?: number;
  currentFrame?: number;
  annotationLabels?: string[]; // Added to receive annotation labels from parent
  labelSet?: LabelSet | null;
  onFrameChange?: (frame: number) => void;
  onReady?: (duration: number, fps: number) => void;
  onSegmentCreate?: (startFrame: number, endFrame: number, elementId: number) => void;
  onAnnotationLabelsChange?: (labels: string[]) => void;
  className?: string;
}

export function SimpleVideoPlayer({
  videoUrl,
  videoFilename,
  fps = 30,
  currentFrame = 0,
  annotationLabels: externalAnnotationLabels,
  labelSet,
  onFrameChange,
  onReady,
  onSegmentCreate,
  onAnnotationLabelsChange,
  className = ''
}: SimpleVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [segmentStart, setSegmentStart] = useState<number | null>(null);
  const [segmentEnd, setSegmentEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [labelSelectorPosition, setLabelSelectorPosition] = useState({ x: 0, y: 0 });
  
  // Annotation data state
  const [annotationLabels, setAnnotationLabels] = useState<string[]>([]);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState(false);

  // Frame stepping state for precision control
  const [isSeeking, setIsSeeking] = useState(false);
  const frameSteppingInProgressRef = useRef(false);
  const lastKeyPressRef = useRef<number>(0);
  const keyDebounceMs = 66; // Debounce key inputs by 66ms (1.5x faster: ~15 FPS)
  const currentFrameRef = useRef<number>(0); // Track current frame accurately

  // 2x playback and rewind state
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isRewinding, setIsRewinding] = useState(false);
  const rewindIntervalRef = useRef<number | null>(null);

  // Reset ready state when URL changes
  useEffect(() => {
    if (videoUrl) {
      setIsReady(false);
      setDuration(0);
      setCurrentTime(0);
    }
  }, [videoUrl]);

  // Sync external annotation labels with internal state
  useEffect(() => {
    if (externalAnnotationLabels) {
      setAnnotationLabels(externalAnnotationLabels);
    }
  }, [externalAnnotationLabels]);

  // Load annotation data when video filename changes
  useEffect(() => {
    if (videoFilename && apiService.token) {
      loadAnnotationData();
    }
  }, [videoFilename]);

  // Handle external currentFrame changes (e.g., from AnnotationPanel navigation)
  const lastSyncedFrameRef = useRef<number>(-1);
  
  useEffect(() => {
    if (!videoRef.current || !isReady || currentFrame === undefined) return;
    if (currentFrame === lastSyncedFrameRef.current) return; // Skip if already synced
    
    const targetTime = currentFrame / fps;
    const currentVideoTime = videoRef.current.currentTime;
    const timeDifference = Math.abs(targetTime - currentVideoTime);
    
    // Increase threshold to 2 frames to reduce unnecessary updates
    const frameThreshold = (2 / fps);
    if (timeDifference > frameThreshold) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration - 0.01, targetTime));
      lastSyncedFrameRef.current = currentFrame;
    }
  }, [currentFrame, fps, isReady, duration]);

  const loadAnnotationData = useCallback(async () => {
    if (!videoFilename) return;
    

    
    try {
      setIsLoadingAnnotations(true);
      const response = await apiService.loadAnnotationData(videoFilename);
      if (response.success) {
        const labels = response.data.labels || [];
        setAnnotationLabels(labels);
        onAnnotationLabelsChange?.(labels);

      }
    } catch (error) {
      console.error('Failed to load annotation data:', error);
      setAnnotationLabels([]);
      onAnnotationLabelsChange?.([]);
    } finally {
      setIsLoadingAnnotations(false);
    }
  }, [videoFilename]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      const totalFrames = Math.floor(videoDuration * fps);
      

      
      setDuration(videoDuration);
      // setIsReady(true); // onCanPlayで管理するため削除
      onReady?.(totalFrames, fps);
    }
  }, [fps, onReady, videoUrl]);

  // Throttled timeUpdate to prevent excessive state updates
  const lastTimeUpdateRef = useRef<number>(0);
  const timeUpdateThrottleMs = 16; // ~60fps limit
  
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    const now = Date.now();
    if (now - lastTimeUpdateRef.current < timeUpdateThrottleMs) return;
    lastTimeUpdateRef.current = now;
    
    const currentTime = videoRef.current.currentTime;
    const frameNumber = Math.floor(currentTime * fps + 0.001);
    
    // Only update if frame number actually changed
    // Check if frame number actually changed from last update
    if (frameNumber !== lastSyncedFrameRef.current) {
      lastSyncedFrameRef.current = frameNumber;
      currentFrameRef.current = frameNumber;
      setCurrentTime(currentTime);
      onFrameChange?.(frameNumber);
    }
  }, [fps, onFrameChange]);

  // Handle seeking events for precise frame control
  const handleSeeking = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeeked = useCallback(() => {
    setIsSeeking(false);
    frameSteppingInProgressRef.current = false;

    // Update frame information after seek completes
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      const frameNumber = Math.floor(currentTime * fps + 0.001); // Add small offset for precision
      setCurrentTime(currentTime);
      onFrameChange?.(frameNumber);
      lastSyncedFrameRef.current = frameNumber;
      currentFrameRef.current = frameNumber;
    }
  }, [fps, onFrameChange]);

  const togglePlayback = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;

      // If in 2x rewind mode, stop rewinding first (takes priority over play/pause)
      if (isRewinding) {
        if (rewindIntervalRef.current !== null) {
          cancelAnimationFrame(rewindIntervalRef.current);
          rewindIntervalRef.current = null;
        }
        setIsRewinding(false);
        // Video is already paused during rewind, so just return
        return;
      }

      if (video.paused) {
        // Resume playback
        video.play();
      } else {
        // Pause playback
        video.pause();

        // If in 2x playback mode, reset to normal speed
        if (playbackRate === 2.0) {
          video.playbackRate = 1.0;
          setPlaybackRate(1.0);
        }
      }
    }
  }, [playbackRate, isRewinding]);

const stepFrame = useCallback((delta: number) => {
    if (!videoRef.current || duration <= 0) return;

    // Only prevent during active seeking (removed frameSteppingInProgressRef check for Phase 2 optimization)
    if (isSeeking) return;

    // Debounce rapid key inputs
    const now = Date.now();
    if (now - lastKeyPressRef.current < keyDebounceMs) return;
    lastKeyPressRef.current = now;

    const video = videoRef.current;
    // Use current frame reference for more accurate frame tracking
    const currentFrameNum = currentFrameRef.current;
    const totalFrames = Math.floor(duration * fps);
    const newFrame = Math.max(0, Math.min(totalFrames - 1, currentFrameNum + delta));

    // Skip if already at target frame
    if (newFrame === currentFrameNum) {
      return;
    }

    // Pause video if playing
    if (!video.paused) {
      video.pause();
    }

    // Set frame position - specify center time of frame
    const targetTime = (newFrame + 0.5) / fps;
    const clampedTime = Math.max(0, Math.min(duration - 0.01, targetTime));

    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    onFrameChange?.(newFrame);
    currentFrameRef.current = newFrame;
  }, [fps, duration, onFrameChange, isSeeking, keyDebounceMs]);

  const goToStart = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, []);

  const goToEnd = useCallback(() => {
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = duration - 0.1; // 0.1s before end
    }
  }, [duration]);

  // 2x rewind stop function (defined early for use in other functions)
  const stopRewind2x = useCallback(() => {
    if (rewindIntervalRef.current !== null) {
      cancelAnimationFrame(rewindIntervalRef.current);
      rewindIntervalRef.current = null;
    }
    setIsRewinding(false);
  }, []);

  // 2x playback toggle
  const togglePlayback2x = useCallback(() => {
    if (!videoRef.current) return;

    // Stop rewinding if active
    if (isRewinding) {
      stopRewind2x();
    }

    const video = videoRef.current;

    if (playbackRate === 2.0) {
      // Return to normal speed
      video.playbackRate = 1.0;
      setPlaybackRate(1.0);
    } else {
      // Switch to 2x speed
      video.playbackRate = 2.0;
      setPlaybackRate(2.0);

      // Start playing if paused
      if (video.paused) {
        video.play();
      }
    }
  }, [playbackRate, isRewinding]);

  // 2x rewind functions
  const startRewind2x = useCallback(() => {
    if (!videoRef.current || duration <= 0 || isRewinding) return;

    const video = videoRef.current;

    // Pause video for frame-based rewinding
    if (!video.paused) {
      video.pause();
    }

    // Reset playback rate if it was 2x
    if (playbackRate === 2.0) {
      video.playbackRate = 1.0;
      setPlaybackRate(1.0);
    }

    setIsRewinding(true);

    // Use requestAnimationFrame for smooth 2x rewind
    let lastFrameTime = performance.now();
    const targetFrameInterval = (1000 / fps) / 2; // 2x speed

    const rewindFrame = () => {
      const now = performance.now();
      const elapsed = now - lastFrameTime;

      if (elapsed >= targetFrameInterval) {
        const currentFrameNum = currentFrameRef.current;

        if (currentFrameNum > 0) {
          const newFrame = Math.max(0, currentFrameNum - 2); // Step back 2 frames for 2x speed
          const targetTime = (newFrame + 0.5) / fps;
          const clampedTime = Math.max(0, Math.min(duration - 0.01, targetTime));

          video.currentTime = clampedTime;
          setCurrentTime(clampedTime);
          onFrameChange?.(newFrame);
          currentFrameRef.current = newFrame;

          lastFrameTime = now;
        } else {
          // Reached beginning, stop rewinding
          stopRewind2x();
          return;
        }
      }

      if (rewindIntervalRef.current !== null) {
        rewindIntervalRef.current = requestAnimationFrame(rewindFrame);
      }
    };

    rewindIntervalRef.current = requestAnimationFrame(rewindFrame);
  }, [duration, fps, onFrameChange, playbackRate, isRewinding, stopRewind2x]);

  // Cleanup rewind on unmount
  useEffect(() => {
    return () => {
      if (rewindIntervalRef.current !== null) {
        cancelAnimationFrame(rewindIntervalRef.current);
      }
    };
  }, []);

  const seekToTime = useCallback((targetTime: number) => {
    if (!videoRef.current || duration <= 0) return;
    
    const clampedTime = Math.max(0, Math.min(duration - 0.01, targetTime));
    const frameNumber = Math.floor(clampedTime * fps + 0.001);
    
    videoRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    onFrameChange?.(frameNumber);
  }, [duration, fps, onFrameChange]);

  const handleSeekBarClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isReady || isDragging) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * duration;
    
    seekToTime(targetTime);
  }, [isReady, isDragging, duration, seekToTime]);

  const handleSeekBarMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isReady) return;
    
    setIsDragging(true);
    handleSeekBarClick(event);
  }, [isReady, handleSeekBarClick]);

  const handleSeekBarMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isReady) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const hoverX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
    const targetTime = percentage * duration;
    
    setHoverTime(targetTime);
    
    if (isDragging) {
      seekToTime(targetTime);
    }
  }, [isReady, duration, isDragging, seekToTime]);

  const handleSeekBarMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging && videoRef.current) {
        // ドラッグ中にシークバーの外でマウスが動いた場合の処理
        event.preventDefault();
      }
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousemove', handleMouseMove);
      
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isDragging]);

  // セグメント選択関数
  const startSegmentSelection = useCallback(() => {
    const currentFrameNum = currentFrame || 0;
    setSegmentStart(currentFrameNum);
    setSegmentEnd(null);
    setIsSelecting(true);

  }, [currentFrame]);

  const updateSegmentSelection = useCallback(() => {
    if (segmentStart === null) return;
    
    const currentFrameNum = currentFrame || 0;
    setSegmentEnd(currentFrameNum);

  }, [currentFrame, segmentStart]);

  const clearSegmentSelection = useCallback(() => {
    setSegmentStart(null);
    setSegmentEnd(null);
    setIsSelecting(false);
    setShowLabelSelector(false);

  }, []);

  const handleLabelSelect = useCallback(async (elementId: number) => {
    if (segmentStart !== null && segmentEnd !== null) {
      const startFrame = Math.min(segmentStart, segmentEnd);
      const endFrame = Math.max(segmentStart, segmentEnd);

      // Find the element from labelSet
      const element = labelSet?.items.find(item => item.elementId === elementId);
      if (!element) {
        console.error('Element not found:', elementId);
        alert('Error: Selected label not found. Please try again.');
        return;
      }

      // Get element name, fallback to getElementById if not in labelSet
      let elementName = element.name;
      if (!elementName) {
        const fallbackElement = getElementById(elementId);
        if (fallbackElement) {
          elementName = fallbackElement.name;
        } else {
          console.error('Element name not found for ID:', elementId);
          alert('Error: Label name not found. Please try again.');
          return;
        }
      }

      if (videoFilename && apiService.token) {
        try {
          // Create a copy of current annotation labels
          const updatedLabels = [...annotationLabels];

          // Ensure the array has enough elements
          const maxFrame = Math.max(endFrame, updatedLabels.length - 1);
          while (updatedLabels.length <= maxFrame) {
            updatedLabels.push('NONE');
          }

          // Update labels for the selected segment
          for (let i = startFrame; i <= endFrame; i++) {
            updatedLabels[i] = elementName;
          }

          console.log('Saving annotation:', {
            videoFilename,
            startFrame,
            endFrame,
            elementName,
            updatedLabelsLength: updatedLabels.length
          });

          // Save to backend immediately with timeout
          const response = await apiService.updateAnnotationBatch(videoFilename, updatedLabels);
          if (response.success) {
            setAnnotationLabels(updatedLabels);
            onAnnotationLabelsChange?.(updatedLabels);
            console.log('Annotation saved successfully');
          } else {
            console.error('Failed to save annotation:', response);
            alert(`Failed to save annotation: ${response.message || 'Unknown error'}`);
            return; // Don't clear selection if save failed
          }
        } catch (error) {
          console.error('Error saving annotation:', error);
          alert(`Error saving annotation: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return; // Don't clear selection if error occurred
        }
      } else {
        console.warn('No videoFilename or token, skipping backend save');
      }

      // Also call the original segment create callback if provided
      onSegmentCreate?.(startFrame, endFrame, elementId);
      clearSegmentSelection();
    }
  }, [segmentStart, segmentEnd, videoFilename, annotationLabels, labelSet, onSegmentCreate, clearSegmentSelection, onAnnotationLabelsChange]);

  const handleCloseLabelSelector = useCallback(() => {
    setShowLabelSelector(false);
  }, []);

  // キーボードイベントハンドリング
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isReady) return;

    // 入力フィールドでは無視
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const isShiftPressed = event.shiftKey;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (isShiftPressed) {
          if (!isSelecting) {
            startSegmentSelection();
          }
          stepFrame(-1);
          updateSegmentSelection();
        } else {
          stepFrame(-1);
        }
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (isShiftPressed) {
          if (!isSelecting) {
            startSegmentSelection();
          }
          stepFrame(1);
          updateSegmentSelection();
        } else {
          stepFrame(1);
        }
        break;
      case ' ':
      case 'Space':
        event.preventDefault();
        togglePlayback(); // 再生/停止
        break;
      case 'Home':
        event.preventDefault();
        goToStart(); // 開始位置
        break;
      case 'End':
        event.preventDefault();
        goToEnd(); // 終了位置
        break;
      case 'Escape':
        event.preventDefault();
        clearSegmentSelection();
        break;
      case '>':
      case '.':
        // Shift+> for 2x playback toggle
        if (isShiftPressed) {
          event.preventDefault();
          togglePlayback2x();
        }
        break;
      case '<':
      case ',':
        // Shift+< for 2x rewind toggle
        if (isShiftPressed) {
          event.preventDefault();
          if (isRewinding) {
            stopRewind2x();
          } else {
            startRewind2x();
          }
        }
        break;
    }
  }, [isReady, stepFrame, togglePlayback, goToStart, goToEnd, isSelecting, startSegmentSelection, updateSegmentSelection, clearSegmentSelection, togglePlayback2x, startRewind2x, stopRewind2x, isRewinding]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!isReady) return;

    // SHIFTキーが離されたとき、選択中であればラベル選択画面を表示
    if (event.key === 'Shift' && isSelecting && segmentStart !== null && segmentEnd !== null) {
      const startFrame = Math.min(segmentStart, segmentEnd);
      const endFrame = Math.max(segmentStart, segmentEnd);
      
      // 有効なセグメントサイズの場合のみラベル選択画面を表示
      if (endFrame > startFrame) {
        // 画面中央にポップアップを表示
        setLabelSelectorPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
        setShowLabelSelector(true);
      }
    }
  }, [isReady, isSelecting, segmentStart, segmentEnd]);

  // Optimized keyboard event listeners with passive option
  useEffect(() => {
    if (!isReady) return; // Only add listeners when video is ready
    
    const keyDownOptions: AddEventListenerOptions = { passive: false }; // preventDefault needed
    const keyUpOptions: AddEventListenerOptions = { passive: true }; // No preventDefault needed
    
    document.addEventListener('keydown', handleKeyDown, keyDownOptions);
    document.addEventListener('keyup', handleKeyUp, keyUpOptions);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, keyDownOptions);
      document.removeEventListener('keyup', handleKeyUp, keyUpOptions);
    };
  }, [handleKeyDown, handleKeyUp, isReady]);

  const formatTimestamp = (frameNum: number) => {
    const totalSeconds = frameNum / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frame = Math.floor(frameNum % fps);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${frame.toString().padStart(2, '0')}`;
  };

  // Get current frame label from annotation data
  const getCurrentFrameLabel = useCallback((frameNum: number) => {
    if (annotationLabels.length === 0) {
      return isLoadingAnnotations ? 'Loading...' : 'No annotation';
    }

    if (frameNum >= 0 && frameNum < annotationLabels.length) {
      const label = annotationLabels[frameNum];
      if (!label || label === 'NONE') return 'No label';
      return label.replace(/_/g, ' ');
    }

    return 'No label';
  }, [annotationLabels, isLoadingAnnotations]);

  // Get current frame label color from figure skating elements
  const getCurrentFrameLabelColor = useCallback((frameNum: number) => {
    if (annotationLabels.length === 0 || frameNum < 0 || frameNum >= annotationLabels.length) {

      return '#64748b'; // Default gray color
    }
    
    const label = annotationLabels[frameNum];
    if (label === 'NONE') {

      return '#64748b'; // Default gray color
    }
    
    // Find the element by name to get its color
    const element = getElementByName(label as any);
    // Use gray color for ambiguous/unrecognized labels
    const color = element?.color || '#9ca3af';

    return color;
  }, [annotationLabels]);

  // Optimized frame annotation rectangles using shared utility
  const [frameAnnotationRects, setFrameAnnotationRects] = useState<AnnotationRect[]>([]);

  // Update frame annotation rectangles when annotation labels change
  useEffect(() => {
    if (!annotationLabels || annotationLabels.length === 0 || duration <= 0) {
      setFrameAnnotationRects([]);
      return;
    }

    // Use shared utility to avoid code duplication
    const rects = processAnnotationLabelsToRects(annotationLabels);
    setFrameAnnotationRects(rects);
  }, [annotationLabels, duration]);

  const totalFrames = duration ? Math.floor(duration * fps) : 0;
  const currentFrameNum = Math.floor(currentTime * fps);

  return (
    <div className={`video-player ${className}`}>
      <div className="video-container">
        {!videoUrl ? (
          <div className="video-placeholder">
            <p>No video selected</p>
            <p className="placeholder-note">
              Select a video to begin playback
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onSeeking={handleSeeking}
              onSeeked={handleSeeked}
              onCanPlay={() => {
                setIsReady(true);
              }}
              onError={(e) => {
                console.error('Video error details:', {
                  videoUrl,
                  errorCode: e.currentTarget.error?.code,
                  errorMessage: e.currentTarget.error?.message,
                  networkState: e.currentTarget.networkState,
                  readyState: e.currentTarget.readyState,
                  src: e.currentTarget.src
                });
              }}
              className="video-element"
              style={{ width: '100%', height: 'auto' }}
            />
            
            <div className="frame-hud">
              <div className="hud-left">
                <span className="frame-counter">
                  Frame: {currentFrameNum} / {totalFrames}
                </span>
                <span className="timestamp">
                  {formatTimestamp(currentFrameNum)}
                </span>
                {(segmentStart !== null || segmentEnd !== null) && (
                  <span className="selection-info">
                    {segmentStart !== null && segmentEnd !== null
                      ? `Selection: ${Math.min(segmentStart, segmentEnd)}-${Math.max(segmentStart, segmentEnd)} (${Math.abs(segmentEnd - segmentStart) + 1} frames)`
                      : `Selecting from: ${segmentStart}`
                    }
                  </span>
                )}
              </div>
              
              <div className="hud-right">
                <span className="fps-info">{fps} FPS</span>
                <span 
                  className="frame-label-info"
                  style={{ 
                    backgroundColor: isReady ? getCurrentFrameLabelColor(currentFrameNum) : '#64748b',
                    fontWeight: '600'
                  }}
                >
                  {isReady ? getCurrentFrameLabel(currentFrameNum) : 'Loading...'}
                </span>
                {isSelecting && (
                  <span className="selection-status">
                    SHIFT+← → to select
                  </span>
                )}
              </div>
            </div>
            
            {!isReady && (
              <div className="video-loading">
                <div className="loading-spinner">Loading video...</div>
              </div>
            )}

            {/* New Label Selector Component */}
            <LabelSelector
              isOpen={showLabelSelector}
              position={labelSelectorPosition}
              currentLabel={undefined} // セグメント新規作成時は現在ラベルなし
              labelSet={labelSet}
              onSelect={handleLabelSelect}
              onClose={handleCloseLabelSelector}
            />


            {/* Video Seekbar Overlay */}
            {isReady && (
              <div className="seekbar-overlay">
                <div className="seekbar-controls-container">
                  {/* Playback Controls */}
                  <div className="seekbar-playback-controls">
                    <button
                      disabled={!isReady}
                      onClick={() => {
                        if (isRewinding) {
                          stopRewind2x();
                        } else {
                          startRewind2x();
                        }
                      }}
                      title="2x Rewind (Shift+<)"
                      className={`playback-btn ${isRewinding ? 'active' : ''}`}
                    >
                      ⏪
                    </button>
                    <button
                      disabled={!isReady}
                      onClick={() => stepFrame(-1)}
                      title="Previous frame (←)"
                      className="frame-btn"
                    >
                      ⏮
                    </button>
                    <button
                      disabled={!isReady}
                      onClick={togglePlayback}
                      title="Play/Pause (Space)"
                      className={`playback-btn ${videoRef.current && !videoRef.current.paused ? 'playing' : 'paused'}`}
                    >
                      {videoRef.current && !videoRef.current.paused ? '⏸' : '▶'}
                    </button>
                    <button
                      disabled={!isReady}
                      onClick={() => stepFrame(1)}
                      title="Next frame (→)"
                      className="frame-btn"
                    >
                      ⏭
                    </button>
                    <button
                      disabled={!isReady}
                      onClick={togglePlayback2x}
                      title="2x Playback (Shift+>)"
                      className={`playback-btn ${playbackRate === 2.0 ? 'active' : ''}`}
                    >
                      ⏩
                    </button>
                  </div>

                  {/* Seekbar */}
                  <div
                    className="seekbar-container"
                    onClick={handleSeekBarClick}
                    onMouseDown={handleSeekBarMouseDown}
                    onMouseMove={handleSeekBarMouseMove}
                    onMouseLeave={handleSeekBarMouseLeave}
                  >
                    <div className="seekbar-track">


                      {/* Frame-based Annotations Visualization */}
                      {frameAnnotationRects.map((rect, index) => (
                        <div
                          key={`${rect.label}-${rect.startFrame}-${index}`}
                          className="seekbar-frame-annotation"
                          style={{
                            left: `${(rect.startFrame / fps / duration) * 100}%`,
                            width: `${((rect.endFrame - rect.startFrame + 1) / fps / duration) * 100}%`,
                            backgroundColor: rect.color
                          }}
                          title={`${rect.label.replace(/_/g, ' ')}: frames ${rect.startFrame}-${rect.endFrame}`}
                        />
                      ))}

                      {/* Selected Segment Visualization */}
                      {segmentStart !== null && segmentEnd !== null && (
                        <div 
                          className="seekbar-segment"
                          style={{
                            left: `${(Math.min(segmentStart, segmentEnd) / fps / duration) * 100}%`,
                            width: `${(Math.abs(segmentEnd - segmentStart) / fps / duration) * 100}%`
                          }}
                        />
                      )}
                      
                      <div 
                        className="seekbar-progress"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                      <div 
                        className="seekbar-handle"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                      />
                      {hoverTime !== null && (
                        <div
                          className="seekbar-hover-indicator"
                          style={{ left: `${(hoverTime / duration) * 100}%` }}
                        >
                          <div className="hover-timestamp">
                            {formatTimestamp(Math.floor(hoverTime * fps))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seekbar Segment Info - Always visible with fixed width */}
                  <div className="seekbar-segment-info">
                    {segmentStart !== null && segmentEnd !== null ? (
                      <span className="seekbar-segment-range">
                        Segment: {Math.min(segmentStart, segmentEnd)} - {Math.max(segmentStart, segmentEnd)}
                        <button 
                          className="seekbar-clear-segment-btn"
                          onClick={clearSegmentSelection}
                          title="Clear selection (Esc)"
                        >
                          ✕
                        </button>
                      </span>
                    ) : segmentStart !== null ? (
                      <span className="seekbar-segment-selecting">
                        From {segmentStart}...
                      </span>
                    ) : (
                      <span className="seekbar-segment-none">
                        No selection
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>


    </div>
  );
}