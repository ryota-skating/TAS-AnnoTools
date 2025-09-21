/**
 * Video Selector Modal Component
 * Select videos from server's video directory for annotation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { apiService } from '../../services/api';
import type { VideoMetadata } from '../../types/api';
import './VideoSelector.css';

interface VideoSelectorProps {
  selectedVideoId?: string;
  onVideoSelect: (video: VideoMetadata | null, videoUrl: string | null) => void;
  onClose: () => void;
  className?: string;
}

export function VideoSelector({ 
  selectedVideoId, 
  onVideoSelect,
  onClose, 
  className = '' 
}: VideoSelectorProps) {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available videos
  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getVideos();
      setVideos(response.videos);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleVideoSelect = (video: VideoMetadata) => {
    // Generate direct video file URL for optimized video playback

    
    let videoUrl: string;
    
    // video.path comes from the API and should be like "/videos/optimized/filename.mp4"
    if (video.path && video.path.startsWith('/videos/optimized/')) {
      // Use the path directly from the API
      const backendBaseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
      videoUrl = `${backendBaseUrl}${video.path}`;
    } else {
      // Fallback: construct optimized path from video.id
      let filename = video.id;
      if (filename.startsWith('/videos/')) {
        filename = filename.substring('/videos/'.length);
      } else if (filename.startsWith('videos/')) {
        filename = filename.substring('videos/'.length);
      }
      
      // Construct direct video file URL pointing to optimized directory
      const backendBaseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
      videoUrl = `${backendBaseUrl}/videos/optimized/${filename}`;
      
      // Ensure .mp4 extension
      if (!videoUrl.endsWith('.mp4')) {
        videoUrl += '.mp4';
      }
    }
    

    onVideoSelect(video, videoUrl);
    onClose();
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="video-selector-overlay" onClick={handleBackdropClick}>
      <div className={`video-selector-modal ${className}`}>
        <div className="video-selector-header">
          <h3>Select Video</h3>
          <div className="video-selector-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadVideos}
              disabled={loading}
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              ✕ Close
            </Button>
          </div>
        </div>

      {error && (
        <div className="video-selector-error">
          ⚠️ {error}
        </div>
      )}

      <div className="video-list">
        {videos.length === 0 && !loading && (
          <div className="video-list-empty">
            <p>No videos available in the server's video directory</p>
            <p className="video-list-hint">
              Please contact your administrator to add video files to the server.
            </p>
          </div>
        )}

        {videos.map(video => (
          <div
            key={video.id}
            className={`video-item ${selectedVideoId === video.id ? 'selected' : ''}`}
            onClick={() => handleVideoSelect(video)}
          >
            <div className="video-item-info">
              <div className="video-item-title">{video.title}</div>
              <div className="video-item-details">
                {video.durationFrames > 0 ? (
                  `${Math.floor(video.durationFrames / video.fps / 60)}:${String(Math.floor((video.durationFrames / video.fps) % 60)).padStart(2, '0')} • ${video.fps} FPS • ${video.durationFrames} frames`
                ) : (
                  `${video.fps} FPS • Duration unknown`
                )}
              </div>
              <div className="video-item-date">
                {video.lastAnnotationUpdate ? (
                  `Last annotated ${new Date(video.lastAnnotationUpdate).toLocaleDateString()}`
                ) : (
                  'Not annotated yet'
                )}
              </div>
            </div>
            
            <div className="video-item-actions">
              {selectedVideoId === video.id && (
                <span className="video-item-selected">✅ Selected</span>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}