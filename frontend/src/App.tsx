import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';
import { Header } from './components/layout/Header';
import { SimpleVideoPlayer } from './components/video/SimpleVideoPlayer';
import { VideoSelector } from './components/video/VideoSelector';

import { AnnotationPanel } from './components/annotation/AnnotationPanel';
import type { AnnotationSegment, LabelSet, VideoMetadata } from './types/api';
import { useFigureSkatingHotkeys } from './hooks/useFigureSkatingHotkeys';
import { apiService } from './services/api';
import './App.css';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [currentFrame, setCurrentFrame] = useState(0);

  // Handle frame change for navigation
  const handleFrameChange = useCallback((frameNumber: number) => {
    setCurrentFrame(frameNumber);
  }, [currentFrame]);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoFps, setVideoFps] = useState(30);
  const [videoUrl, setVideoUrl] = useState<string | undefined>();
  const [videoId, setVideoId] = useState<string>('');
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [segments, setSegments] = useState<AnnotationSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<AnnotationSegment | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [labelSet, setLabelSet] = useState<LabelSet | null>(null);
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const [annotationLabels, setAnnotationLabels] = useState<string[]>([]);

  // Debug: Monitor annotation labels changes


  const handleVideoSelect = useCallback((video: VideoMetadata | null, url: string | null) => {
    if (video && url) {

      setVideoMetadata(video);
      setVideoUrl(url);
      
      let cleanVideoId = video.id;
      if (video.id.startsWith('/videos/')) {
        cleanVideoId = video.id.substring('/videos/'.length);
        if (cleanVideoId.endsWith('.mp4')) {
          cleanVideoId = cleanVideoId.slice(0, -4);
        }
      } else if (video.id.startsWith('videos/')) {
        cleanVideoId = video.id.substring('videos/'.length);
        if (cleanVideoId.endsWith('.mp4')) {
          cleanVideoId = cleanVideoId.slice(0, -4);
        }
      }
      setVideoId(cleanVideoId);
      setVideoDuration(0);
      setVideoFps(video.fps);
      setCurrentFrame(0);
      setSegments([]);
      setSelectedSegment(null);
      setSelectionRange(null);
      setAnnotationLabels([]);
    } else {
      setVideoMetadata(null);
      setVideoUrl(undefined);
      setVideoId('');
      setVideoDuration(0);
      setCurrentFrame(0);
      setSegments([]);
      setSelectedSegment(null);
      setSelectionRange(null);
      setAnnotationLabels([]);
    }
  }, []);
  const handleSegmentCreate = useCallback(async (segment: Omit<AnnotationSegment, 'id' | 'createdAt' | 'updatedAt'>) => {
    // セグメント作成は現在のフレームベースアノテーションシステムでは不要
    // アノテーションはファイルに直接保存される

  }, []);

  const handleSegmentUpdate = useCallback(async (segment: AnnotationSegment) => {
    try {
      const updatedSegment = await apiService.updateAnnotationSegment(segment.id, segment);
      setSegments(prev => prev.map(s => s.id === segment.id ? updatedSegment : s));
      setSelectedSegment(updatedSegment);
    } catch (error) {
      console.error('Failed to update segment:', error);
    }
  }, []);

  const handleSegmentDelete = useCallback(async (segmentId: string) => {
    try {
      await apiService.deleteAnnotationSegment(segmentId);
      setSegments(prev => prev.filter(s => s.id !== segmentId));
      if (selectedSegment?.id === segmentId) {
        setSelectedSegment(null);
      }
    } catch (error) {
      console.error('Failed to delete segment:', error);
    }
  }, [selectedSegment]);

  const handleSaveAnnotations = useCallback(async () => {
    try {
      await Promise.all(segments.map(segment => 
        apiService.updateAnnotationSegment(segment.id, segment)
      ));
    } catch (error) {
      console.error('Failed to save annotations:', error);
      throw error;
    }
  }, [segments]);

  const handleRangeSelect = useCallback((startFrame: number, endFrame: number) => {
    setSelectionRange({ start: startFrame, end: endFrame });
    setSelectedSegment(null);
  }, []);

  const loadAnnotations = useCallback(async () => {
    try {
      const annotations = await apiService.getVideoAnnotations(videoId);
      setSegments(annotations);
      
      // Load label set for hotkeys
      const labelSetData = await apiService.getLabelSet('default');
      setLabelSet(labelSetData);
    } catch (error) {
      console.error('Failed to load annotations:', error);
      setSegments([]);
    }
  }, [videoId]);

  const handleVideoReady = useCallback((duration: number, fps: number) => {
    setVideoDuration(duration);
    setVideoFps(fps);
    loadAnnotations();
  }, [loadAnnotations]);

  const handleQuickAnnotate = useCallback((elementId: number) => {
    if (selectedSegment) {
      const updatedSegment: AnnotationSegment = {
        ...selectedSegment,
        elementId,
        updatedAt: new Date().toISOString()
      };
      handleSegmentUpdate(updatedSegment);
    } else if (selectionRange) {
      const newSegment: Omit<AnnotationSegment, 'id' | 'createdAt' | 'updatedAt'> = {
        videoId,
        startFrame: selectionRange.start,
        endFrame: selectionRange.end,
        elementId,
        annotatorId: 'current-user'
      };
      handleSegmentCreate(newSegment);
    }
  }, [selectedSegment, selectionRange, videoId, handleSegmentCreate, handleSegmentUpdate]);

  const handleDeleteCurrentSegment = useCallback(() => {
    if (selectedSegment) {
      handleSegmentDelete(selectedSegment.id);
    }
  }, [selectedSegment, handleSegmentDelete]);

  const handleClearSelection = useCallback(() => {
    setSelectionRange(null);
    setSelectedSegment(null);
  }, []);

  useFigureSkatingHotkeys({
    onQuickAnnotate: handleQuickAnnotate,
    onDeleteCurrentSegment: handleDeleteCurrentSegment,
    onSaveAnnotations: handleSaveAnnotations,
    onClearSelection: handleClearSelection
  }, {
    enabled: isAuthenticated && videoDuration > 0,
    labelSet,
    selectedSegment,
    selectionRange
  });

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="app">
      <Header onSelectVideoClick={() => setShowVideoSelector(true)} />
      <main className="app-main">
        <div className="workspace">
          {videoUrl && videoMetadata ? (
            <>
              <div className="video-section">
                <SimpleVideoPlayer
                  videoUrl={videoUrl}
                  videoFilename={videoMetadata?.filename || videoId || 'unknown'}
                  fps={videoFps}
                  currentFrame={currentFrame}
                  annotationLabels={annotationLabels}
                  onFrameChange={setCurrentFrame}
                  onReady={handleVideoReady}
                  onSegmentCreate={(startFrame, endFrame, elementId) => {
                    const newSegment: Omit<AnnotationSegment, 'id' | 'createdAt' | 'updatedAt'> = {
                      videoId,
                      startFrame,
                      endFrame,
                      elementId,
                      annotatorId: 'current-user'
                    };
                    handleSegmentCreate(newSegment);
                  }}
                  onAnnotationLabelsChange={setAnnotationLabels}
                />
              </div>
              
              <div className="annotation-section">
                <AnnotationPanel
                  videoId={videoId}
                  currentFrame={currentFrame}
                  totalFrames={videoDuration}
                  segments={segments}
                  selectedSegment={selectedSegment}
                  selectionRange={selectionRange}
                  onSegmentCreate={handleSegmentCreate}
                  onSegmentUpdate={handleSegmentUpdate}
                  onSegmentDelete={handleSegmentDelete}
                  onSaveAnnotations={handleSaveAnnotations}
                  annotationLabels={annotationLabels}
                  onFrameClick={handleFrameChange}
                  videoFilename={videoMetadata?.filename || videoId}
                  onAnnotationLabelsChange={setAnnotationLabels}
                />
              </div>
            </>
          ) : (
            <div className="no-video-selected">
              <div className="no-video-message">
                <h3>Welcome to FS-AnnoTools3</h3>
                <p>Select or upload a video to begin annotating figure skating elements.</p>
                <p>This tool helps create precise, frame-by-frame annotations for technical artistic score (TAS) analysis.</p>
              </div>
            </div>
          )}
        </div>
      </main>
      {showVideoSelector && (
        <VideoSelector
          selectedVideoId={videoId}
          onVideoSelect={handleVideoSelect}
          onClose={() => setShowVideoSelector(false)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
