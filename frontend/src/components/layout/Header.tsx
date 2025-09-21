/**
 * Header Component
 * Application header with user info and navigation
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { PerformanceTest } from '../performance/PerformanceTest';
import './Header.css';

interface HeaderProps {
  onSelectVideoClick?: () => void;
}

export function Header({ onSelectVideoClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const [showPerformanceTest, setShowPerformanceTest] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="app-title">FS-AnnoTools3</h1>
          <span className="app-subtitle">TAS Dataset Creation Tool</span>
        </div>

        <div className="header-right">
          {user && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={onSelectVideoClick}
                title="Select Video for Annotation"
              >
                📹 Select Video
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPerformanceTest(true)}
                title="Run Performance Tests"
              >
                📊 Performance
              </Button>
              
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role" data-role={user.role.toLowerCase()}>
                  {user.role}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                >
                  Sign Out
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    
    {/* Performance Test Modal */}
    {showPerformanceTest && (
      <div className="modal-overlay" onClick={() => setShowPerformanceTest(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Performance Testing</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPerformanceTest(false)}
              title="Close"
            >
              ✕
            </Button>
          </div>
          <div className="modal-body">
            <PerformanceTest />
          </div>
        </div>
      </div>
    )}
    </>
  );
}