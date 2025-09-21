/**
 * Label Routes
 * Handle label sets and configuration for annotation projects
 */

import { FastifyInstance, FastifyReply } from 'fastify';
import { database } from '../services/database';
import { logger } from '../utils/logger';
import { FIGURE_SKATING_ELEMENTS, ELEMENT_SETS } from '../../../shared/types/figure-skating';
import { mappingService } from '../services/mappingService';

export async function labelRoutes(fastify: FastifyInstance) {
  // Get label set for a project
  fastify.get('/:project', async (request: any, reply: FastifyReply) => {
    try {
      const { project } = request.params;
      const { mapping = 'default' } = request.query as any;

      // Get latest version of label set
      const labelSet = await database.get(`
        SELECT version, items_json, updated_at, updated_by, mapping_name
        FROM label_sets
        WHERE project = ? AND (mapping_name = ? OR mapping_name IS NULL)
        ORDER BY version DESC
        LIMIT 1
      `, [project, mapping]);

      if (!labelSet) {
        // Load mapping configuration
        const mappingConfig = await mappingService.loadMappingConfig(mapping);

        // Return default label set based on mapping configuration
        const defaultItems = mappingConfig.elements.map(element => ({
          elementId: element.id,
          color: element.color || getDefaultColor(element.id),
          description: element.description || element.name.replace(/_/g, ' '),
          hotkey: element.hotkey || getDefaultHotkey(element.id),
          enabled: true,
          name: element.name,
          category: element.category
        }));

        return {
          project,
          version: 0,
          mapping: mapping,
          items: defaultItems,
          updatedAt: new Date().toISOString(),
          isDefault: true
        };
      }

      return {
        project,
        version: labelSet.version,
        mapping: labelSet.mapping_name || mapping,
        items: JSON.parse(labelSet.items_json),
        updatedAt: labelSet.updated_at,
        updatedBy: labelSet.updated_by,
        isDefault: false
      };
    } catch (error) {
      logger.error('Get label set error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get label set'
      });
    }
  });

  // Update label set (Admin only)
  fastify.post('/:project', {
    preHandler: async (request: any, reply: FastifyReply) => {
      if (request.user.role !== 'Admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin role required to update label sets'
        });
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { project } = request.params;
      const { items } = request.body;

      // Validate items structure
      if (!Array.isArray(items)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Items must be an array'
        });
      }

      // Validate each item
      for (const item of items) {
        if (typeof item.elementId !== 'number' ||
            item.elementId < 0 || item.elementId > 55) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid elementId: ${item.elementId}`
          });
        }

        if (!item.color || !/^#[0-9A-Fa-f]{6}$/.test(item.color)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid color format for element ${item.elementId}`
          });
        }
      }

      // Get next version
      const currentVersion = await database.get(`
        SELECT MAX(version) as max_version FROM label_sets WHERE project = ?
      `, [project]);

      const nextVersion = (currentVersion?.max_version || 0) + 1;

      // Save new version
      await database.run(`
        INSERT INTO label_sets (project, version, items_json, updated_by)
        VALUES (?, ?, ?, ?)
      `, [
        project,
        nextVersion,
        JSON.stringify(items),
        request.user.userId
      ]);

      logger.info('Label set updated', {
        project,
        version: nextVersion,
        itemCount: items.length,
        updatedBy: request.user.userId,
        reqId: request.id
      });

      return {
        success: true,
        project,
        version: nextVersion,
        itemCount: items.length
      };
    } catch (error) {
      logger.error('Update label set error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update label set'
      });
    }
  });

  // Get available action elements (supports custom mappings)
  fastify.get('/elements/all', async (request: any, reply: FastifyReply) => {
    try {
      const { mapping = 'default' } = request.query as any;

      if (mapping === 'figure-skating' || mapping === 'default') {
        // Return hardcoded figure skating elements for backward compatibility
        return {
          elements: Object.values(FIGURE_SKATING_ELEMENTS),
          elementSets: ELEMENT_SETS,
          mapping: 'figure-skating'
        };
      }

      // Load from mapping files
      const mappingConfig = await mappingService.loadMappingConfig(mapping);

      return {
        elements: mappingConfig.elements,
        elementSets: mappingConfig.categories,
        mapping: mapping,
        totalElements: mappingConfig.totalElements
      };
    } catch (error) {
      logger.error('Get elements error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get elements'
      });
    }
  });

  // Get available mapping configurations
  fastify.get('/mappings', async (request: any, reply: FastifyReply) => {
    try {
      const mappings = await mappingService.getAvailableMappings();
      return {
        mappings: mappings.map(name => ({
          name,
          displayName: name === 'default' ? 'Figure Skating (Default)' : name,
          isDefault: name === 'default'
        }))
      };
    } catch (error) {
      logger.error('Get mappings error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get available mappings'
      });
    }
  });

  // Validate mapping configuration
  fastify.get('/mappings/:mapping/validate', async (request: any, reply: FastifyReply) => {
    try {
      const { mapping } = request.params;
      const validation = await mappingService.validateMappingFiles(mapping);

      return {
        mapping,
        valid: validation.valid,
        errors: validation.errors
      };
    } catch (error) {
      logger.error('Validate mapping error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate mapping'
      });
    }
  });

  // Get label set versions
  fastify.get('/:project/versions', async (request: any, reply: FastifyReply) => {
    try {
      const { project } = request.params;
      
      const versions = await database.all(`
        SELECT version, updated_at, updated_by,
               json_array_length(items_json) as item_count
        FROM label_sets
        WHERE project = ?
        ORDER BY version DESC
      `, [project]);

      return {
        project,
        versions: versions.map(v => ({
          version: v.version,
          itemCount: v.item_count,
          updatedAt: v.updated_at,
          updatedBy: v.updated_by
        }))
      };
    } catch (error) {
      logger.error('Get label set versions error', { error, reqId: request.id });
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get label set versions'
      });
    }
  });
}

// Helper functions for default label configuration
function getDefaultColor(elementId: number): string {
  // Generate consistent colors based on element category
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#AED6F1',
    '#A9DFBF', '#F9E79F', '#D2B4DE', '#AED6F1', '#A3E4D7'
  ];
  
  if (elementId === 55) return '#CCCCCC'; // NONE element
  
  // Group by category
  if (elementId < 8) return colors[0]; // Three_Turn
  if (elementId < 16) return colors[1]; // Bracket_Turn
  if (elementId < 24) return colors[2]; // Rocker_Turn
  if (elementId < 32) return colors[3]; // Counter_Turn
  if (elementId < 40) return colors[4]; // Loop_Turn
  
  // Individual elements get unique colors
  return colors[5 + (elementId - 40) % (colors.length - 5)];
}

function getDefaultHotkey(elementId: number): string | undefined {
  // Assign hotkeys for most common elements
  const hotkeys: Record<number, string> = {
    0: '1', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '7', 7: '8', // Three_Turn
    40: 'T', // Twizzle
    41: 'S', // Toe_Step
    42: 'C', // Chasse
    43: 'M', // Mohawk
    49: 'P', // Spiral
    55: '0', // NONE
  };
  
  return hotkeys[elementId];
}