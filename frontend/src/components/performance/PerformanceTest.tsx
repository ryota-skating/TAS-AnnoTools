/**
 * Performance Test Component
 * UI for running and displaying performance validation results
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../ui/Button';
import { validatePerformanceRequirements } from '../../utils/performanceValidator';
import type { PerformanceReport, PerformanceTestResult } from '../../utils/performanceValidator';
import './PerformanceTest.css';

export function PerformanceTest() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPerformanceTests = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setReport(null);

    try {
      const testReport = await validatePerformanceRequirements();
      setReport(testReport);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Performance test error:', err);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const exportReport = useCallback(() => {
    if (!report) return;

    const reportData = {
      ...report,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [report]);

  const renderSystemInfo = () => {
    if (!report) return null;

    const { systemInfo } = report;
    
    return (
      <div className="system-info">
        <h3>System Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">WebCodecs Support:</span>
            <span className={`info-value ${systemInfo.webCodecsSupported ? 'supported' : 'unsupported'}`}>
              {systemInfo.webCodecsSupported ? '✅ Supported' : '❌ Not Supported'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">OffscreenCanvas:</span>
            <span className={`info-value ${systemInfo.canvasSupported ? 'supported' : 'unsupported'}`}>
              {systemInfo.canvasSupported ? '✅ Supported' : '❌ Not Supported'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Web Workers:</span>
            <span className={`info-value ${systemInfo.workerSupported ? 'supported' : 'unsupported'}`}>
              {systemInfo.workerSupported ? '✅ Supported' : '❌ Not Supported'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">User Agent:</span>
            <span className="info-value user-agent">{systemInfo.userAgent}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTestResult = (result: PerformanceTestResult) => {
    return (
      <div key={result.testName} className={`test-result ${result.passed ? 'passed' : 'failed'}`}>
        <div className="test-header">
          <span className="test-status">
            {result.passed ? '✅' : '❌'}
          </span>
          <h4 className="test-name">{result.testName}</h4>
          {result.duration > 0 && (
            <span className="test-duration">{result.duration.toFixed(1)}ms</span>
          )}
        </div>
        
        {result.error && (
          <div className="test-error">
            <strong>Error:</strong> {result.error}
          </div>
        )}
        
        {result.metrics.length > 0 && (
          <div className="test-metrics">
            {result.metrics.map((metric, index) => (
              <div key={index} className={`metric ${metric.passed ? 'passed' : 'failed'}`}>
                <div className="metric-header">
                  <span className="metric-status">
                    {metric.passed ? '✅' : '❌'}
                  </span>
                  <span className="metric-name">{metric.name}</span>
                </div>
                <div className="metric-details">
                  <span className="metric-value">
                    {metric.value.toFixed(1)}{metric.unit}
                  </span>
                  <span className="metric-requirement">
                    (req: ≤{metric.requirement}{metric.unit})
                  </span>
                </div>
                {metric.details && (
                  <div className="metric-extra">{metric.details}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="performance-test">
      <div className="test-header">
        <h2>Performance Validation</h2>
        <p className="test-description">
          Validate all performance requirements from sys_req.md including frame step latency,
          video load time, timeline responsiveness, and thumbnail generation speed.
        </p>
      </div>

      <div className="test-controls">
        <Button
          onClick={runPerformanceTests}
          disabled={isRunning}
          variant="primary"
          size="lg"
        >
          {isRunning ? 'Running Tests...' : 'Run Performance Tests'}
        </Button>
        
        {report && (
          <Button
            onClick={exportReport}
            variant="secondary"
            size="lg"
          >
            Export Report
          </Button>
        )}
      </div>

      {isRunning && (
        <div className="test-progress">
          <div className="progress-indicator">
            <div className="spinner"></div>
            <span>Running performance validation tests...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="test-error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {report && (
        <div className="test-results">
          <div className="results-summary">
            <h3>Test Results Summary</h3>
            <div className={`overall-status ${report.overallPassed ? 'passed' : 'failed'}`}>
              <span className="status-icon">
                {report.overallPassed ? '✅' : '❌'}
              </span>
              <span className="status-text">
                {report.overallPassed ? 'All Tests Passed' : 'Some Tests Failed'}
              </span>
              <span className="status-count">
                ({report.passedTests}/{report.totalTests} passed)
              </span>
            </div>
            <div className="generated-at">
              Generated: {report.generatedAt.toLocaleString()}
            </div>
          </div>

          {renderSystemInfo()}

          <div className="test-results-list">
            <h3>Detailed Results</h3>
            {report.results.map(renderTestResult)}
          </div>

          <div className="requirements-info">
            <h3>Performance Requirements</h3>
            <ul>
              <li><strong>PR-1:</strong> Frame step latency ≤50ms</li>
              <li><strong>PR-2:</strong> Video load time ≤1000ms</li>
              <li><strong>PR-3:</strong> Seekbar performance ≤33ms</li>
              <li><strong>PR-4:</strong> Thumbnail generation ≤120ms</li>
              <li><strong>PR-5:</strong> Keyboard response ≤16ms</li>
              <li><strong>PR-6:</strong> Cache hit rate ≥70%</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}