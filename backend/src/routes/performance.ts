/**
 * Performance Routes
 * Handle performance metrics recording and monitoring
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { database } from '../services/database';
import { logger, performanceLogger } from '../utils/logger';

export async function performanceRoutes(fastify: FastifyInstance) {
  // Record performance metric
  fastify.post('/metrics', async (request: any, reply: FastifyReply) => {
    try {
      const { type, value, metadata, sessionId } = request.body;

      // Validate metric type
      const validTypes = [
        'frame_step_latency',
        'zoom_pan_latency',
        'thumbnail_generation',
        'memory_usage',
        'initial_load_time',
        'video_decode_time'
      ];

      if (!validTypes.includes(type)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid metric type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      if (typeof value !== 'number' || value < 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Value must be a positive number'
        });
      }

      // Save metric
      await database.run(`
        INSERT INTO performance_metrics (type, value, metadata_json, user_id, session_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        type,
        value,
        metadata ? JSON.stringify(metadata) : null,
        request.user.userId,
        sessionId || null
      ]);

      // Log specific performance events
      switch (type) {
        case 'frame_step_latency':
          performanceLogger.logFrameStep(value, request.id);
          break;
        case 'zoom_pan_latency':
          performanceLogger.logZoomPan(value, request.id);
          break;
        case 'thumbnail_generation':
          performanceLogger.logThumbnailGeneration(
            value, 
            metadata?.frameNumber || 0, 
            request.id
          );
          break;
      }

      return {
        success: true,
        message: 'Metric recorded'
      };
    } catch (error) {
      logger.error('Record metric error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to record metric'
      });
    }
  });

  // Get performance summary
  fastify.get('/summary', async (request: any, reply: FastifyReply) => {
    try {
      const { timeRange = '1h' } = request.query as any;
      
      let timeFilter = '';
      switch (timeRange) {
        case '1h':
          timeFilter = "recorded_at > datetime('now', '-1 hour')";
          break;
        case '24h':
          timeFilter = "recorded_at > datetime('now', '-1 day')";
          break;
        case '7d':
          timeFilter = "recorded_at > datetime('now', '-7 days')";
          break;
        default:
          timeFilter = "recorded_at > datetime('now', '-1 hour')";
      }

      // Get averages by type
      const averages = await database.all(`
        SELECT type, 
               COUNT(*) as count,
               AVG(value) as average,
               MIN(value) as minimum,
               MAX(value) as maximum,
               PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY value) as p95
        FROM performance_metrics
        WHERE ${timeFilter}
        GROUP BY type
        ORDER BY type
      `);

      // Check SLA compliance
      const slaStatus = {
        frameStepLatency: {
          target: 50,
          current: 0,
          compliance: true
        },
        zoomPanLatency: {
          target: 33,
          current: 0,
          compliance: true
        },
        thumbnailGeneration: {
          target: 120,
          current: 0,
          compliance: true
        }
      };

      averages.forEach(metric => {
        switch (metric.type) {
          case 'frame_step_latency':
            slaStatus.frameStepLatency.current = metric.average;
            slaStatus.frameStepLatency.compliance = metric.average <= 50 && metric.p95 <= 100;
            break;
          case 'zoom_pan_latency':
            slaStatus.zoomPanLatency.current = metric.average;
            slaStatus.zoomPanLatency.compliance = metric.average <= 33;
            break;
          case 'thumbnail_generation':
            slaStatus.thumbnailGeneration.current = metric.average;
            slaStatus.thumbnailGeneration.compliance = metric.average <= 120;
            break;
        }
      });

      return {
        timeRange,
        metrics: averages,
        slaCompliance: slaStatus,
        overallHealth: Object.values(slaStatus).every(s => s.compliance)
      };
    } catch (error) {
      logger.error('Get performance summary error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get performance summary'
      });
    }
  });

  // Get detailed metrics (Admin only)
  fastify.get('/detailed', {
    preHandler: async (request: any, reply: FastifyReply) => {
      if (request.user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required'
        });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { 
        type, 
        timeRange = '24h', 
        limit = 100, 
        offset = 0 
      } = request.query as any;

      let timeFilter = '';
      switch (timeRange) {
        case '1h':
          timeFilter = "recorded_at > datetime('now', '-1 hour')";
          break;
        case '24h':
          timeFilter = "recorded_at > datetime('now', '-1 day')";
          break;
        case '7d':
          timeFilter = "recorded_at > datetime('now', '-7 days')";
          break;
        default:
          timeFilter = "recorded_at > datetime('now', '-1 day')";
      }

      let typeFilter = '';
      const params: any[] = [];
      
      if (type) {
        typeFilter = 'AND type = ?';
        params.push(type);
      }

      params.push(parseInt(limit), parseInt(offset));

      const metrics = await database.all(`
        SELECT type, value, metadata_json, recorded_at, user_id, session_id
        FROM performance_metrics
        WHERE ${timeFilter} ${typeFilter}
        ORDER BY recorded_at DESC
        LIMIT ? OFFSET ?
      `, params);

      const total = await database.get(`
        SELECT COUNT(*) as count
        FROM performance_metrics
        WHERE ${timeFilter} ${typeFilter}
      `, type ? [type] : []);

      return {
        metrics: metrics.map(m => ({
          type: m.type,
          value: m.value,
          metadata: m.metadata_json ? JSON.parse(m.metadata_json) : null,
          recordedAt: m.recorded_at,
          userId: m.user_id,
          sessionId: m.session_id
        })),
        total: total.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total.count
      };
    } catch (error) {
      logger.error('Get detailed metrics error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get detailed metrics'
      });
    }
  });

  // Get system health check
  fastify.get('/health', async (request: any, reply: FastifyReply) => {
    try {
      // Get recent performance metrics
      const recentMetrics = await database.all(`
        SELECT type, AVG(value) as average
        FROM performance_metrics
        WHERE recorded_at > datetime('now', '-5 minutes')
        GROUP BY type
      `);

      const health: {
        timestamp: string;
        status: string;
        metrics: Record<string, number>;
        alerts: string[];
      } = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        metrics: {},
        alerts: []
      };

      // Check each metric against thresholds
      recentMetrics.forEach(metric => {
        health.metrics[metric.type] = metric.average;

        switch (metric.type) {
          case 'frame_step_latency':
            if (metric.average > 100) {
              health.status = 'degraded';
              health.alerts.push(`Frame step latency high: ${metric.average}ms`);
            }
            break;
          case 'zoom_pan_latency':
            if (metric.average > 50) {
              health.status = 'degraded';
              health.alerts.push(`Zoom/pan latency high: ${metric.average}ms`);
            }
            break;
        }
      });

      // Check memory usage
      performanceLogger.logMemoryUsage();

      return health;
    } catch (error) {
      logger.error('Health check error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Health check failed'
      });
    }
  });
}