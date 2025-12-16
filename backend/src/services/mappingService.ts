/**
 * Mapping Service
 * Handle dynamic loading of action elements from mapping files
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface ActionElement {
  id: number;
  name: string;
  category: string;
  description?: string;
  color?: string;
}

export interface ActionCategory {
  id: number;
  name: string;
  elements: ActionElement[];
}

export interface MappingConfig {
  elements: ActionElement[];
  categories: ActionCategory[];
  totalElements: number;
}

class MappingService {
  private cache: Map<string, MappingConfig> = new Map();
  private readonly mappingDir: string;

  constructor() {
    // Default to project root mapping directory
    this.mappingDir = path.join(__dirname, '../../../mapping');
  }

  /**
   * Load mapping configuration from files
   */
  async loadMappingConfig(mappingName: string = 'default'): Promise<MappingConfig> {
    try {
      // Check cache first
      if (this.cache.has(mappingName)) {
        return this.cache.get(mappingName)!;
      }

      // Define file paths
      const elementFile = path.join(this.mappingDir, 'mapping_step_element.txt');
      const categoryFile = path.join(this.mappingDir, 'mapping_step_set.txt');

      // Check if custom mapping exists
      const customElementFile = path.join(this.mappingDir, `${mappingName}_element.txt`);
      const customCategoryFile = path.join(this.mappingDir, `${mappingName}_set.txt`);

      const useElementFile = fs.existsSync(customElementFile) ? customElementFile : elementFile;
      const useCategoryFile = fs.existsSync(customCategoryFile) ? customCategoryFile : categoryFile;

      // Read element mapping
      const elements = await this.parseElementFile(useElementFile);

      // Read category mapping
      const categoryNames = await this.parseCategoryFile(useCategoryFile);

      // Group elements by category
      const categories = this.groupElementsByCategory(elements, categoryNames);

      const config: MappingConfig = {
        elements,
        categories,
        totalElements: elements.length
      };

      // Cache the configuration
      this.cache.set(mappingName, config);

      logger.info(`Loaded mapping configuration: ${mappingName}`, {
        elementsCount: elements.length,
        categoriesCount: categories.length,
        elementFile: useElementFile,
        categoryFile: useCategoryFile
      });

      return config;
    } catch (error) {
      logger.error('Failed to load mapping configuration', {
        mappingName,
        error: error instanceof Error ? error.message : error
      });
      throw new Error(`Failed to load mapping configuration: ${mappingName}`);
    }
  }

  /**
   * Parse element mapping file (format: "id element_name")
   */
  private async parseElementFile(filePath: string): Promise<ActionElement[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    return lines.map(line => {
      const [idStr, ...nameParts] = line.trim().split(' ');
      const id = parseInt(idStr, 10);
      const name = nameParts.join(' ');

      if (isNaN(id)) {
        throw new Error(`Invalid element ID in mapping file: ${line}`);
      }

      // Determine category from element name
      const category = this.determineCategoryFromName(name);

      return {
        id,
        name,
        category,
        description: this.formatDescription(name),
        color: this.generateColor(category, id)
      };
    });
  }

  /**
   * Parse category mapping file (format: "id category_name")
   */
  private async parseCategoryFile(filePath: string): Promise<string[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const categories: string[] = [];

    lines.forEach(line => {
      const [idStr, ...nameParts] = line.trim().split(' ');
      const id = parseInt(idStr, 10);
      const name = nameParts.join(' ');

      if (isNaN(id)) {
        throw new Error(`Invalid category ID in mapping file: ${line}`);
      }

      categories[id] = name;
    });

    return categories;
  }

  /**
   * Group elements by category
   */
  private groupElementsByCategory(elements: ActionElement[], categoryNames: string[]): ActionCategory[] {
    const categoryMap = new Map<string, ActionElement[]>();

    // Group elements
    elements.forEach(element => {
      if (!categoryMap.has(element.category)) {
        categoryMap.set(element.category, []);
      }
      categoryMap.get(element.category)!.push(element);
    });

    // Create category objects
    const categories: ActionCategory[] = [];
    categoryNames.forEach((name, id) => {
      if (name && categoryMap.has(name)) {
        categories.push({
          id,
          name,
          elements: categoryMap.get(name)! || []
        });
      }
    });

    return categories;
  }

  /**
   * Determine category from element name
   */
  private determineCategoryFromName(name: string): string {
    if (name.includes('Three_Turn')) return 'Three_Turn';
    if (name.includes('Bracket_Turn')) return 'Bracket_Turn';
    if (name.includes('Rocker_Turn')) return 'Rocker_Turn';
    if (name.includes('Counter_Turn')) return 'Counter_Turn';
    if (name.includes('Loop_Turn')) return 'Loop_Turn';

    // Direct category names
    const directCategories = [
      'Twizzle', 'Toe_Step', 'Chasse', 'Mohawk', 'Choctaw',
      'Change_of_Edge', 'Cross_Roll', 'Swing_Roll', 'Cross_Over',
      'Spiral', 'Arabesque', 'Spread_Eagles', 'Ina_Bauers',
      'Hydroblading', 'Knee_Slide', 'NONE'
    ];

    for (const category of directCategories) {
      if (name === category) return category;
    }

    // Default category for unknown elements
    return 'Other';
  }

  /**
   * Format element name for description
   */
  private formatDescription(name: string): string {
    return name.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  }

  /**
   * Generate color based on category and ID
   */
  private generateColor(category: string, id: number): string {
    const categoryColors: Record<string, string> = {
      'Three_Turn': '#3b82f6',     // Blue
      'Bracket_Turn': '#8b5cf6',   // Purple
      'Rocker_Turn': '#06b6d4',    // Cyan
      'Counter_Turn': '#10b981',   // Emerald
      'Loop_Turn': '#f59e0b',      // Amber
      'Twizzle': '#ef4444',        // Red
      'Toe_Step': '#ec4899',       // Pink
      'Chasse': '#84cc16',         // Lime
      'Mohawk': '#f97316',         // Orange
      'Choctaw': '#8b5cf6',        // Violet
      'Change_of_Edge': '#06b6d4', // Cyan
      'Cross_Roll': '#059669',     // Emerald
      'Swing_Roll': '#0d9488',     // Teal
      'Cross_Over': '#7c3aed',     // Violet
      'Spiral': '#db2777',         // Pink
      'Arabesque': '#be185d',      // Rose
      'Spread_Eagles': '#c2410c',  // Orange
      'Ina_Bauers': '#7c2d12',     // Orange
      'Hydroblading': '#1e40af',   // Blue
      'Knee_Slide': '#374151',     // Gray
      'NONE': '#6b7280',           // Gray
      'Other': '#9ca3af'           // Light Gray
    };

    return categoryColors[category] || categoryColors['Other'];
  }

  /**
   * Get available mapping configurations
   */
  async getAvailableMappings(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.mappingDir);
      const mappings = new Set<string>();

      // Always include default
      mappings.add('default');

      // Find custom mapping files
      files.forEach(file => {
        const match = file.match(/^(.+)_element\.txt$/);
        if (match && match[1] !== 'mapping_step') {
          mappings.add(match[1]);
        }
      });

      return Array.from(mappings).sort();
    } catch (error) {
      logger.error('Failed to get available mappings', { error });
      return ['default'];
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Mapping cache cleared');
  }

  /**
   * Validate mapping file format
   */
  async validateMappingFiles(mappingName: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const config = await this.loadMappingConfig(mappingName);

      // Check for duplicate IDs
      const ids = config.elements.map(e => e.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        errors.push(`Duplicate element IDs: ${duplicateIds.join(', ')}`);
      }

      // Check for sequential IDs starting from 0
      const sortedIds = [...ids].sort((a, b) => a - b);
      for (let i = 0; i < sortedIds.length; i++) {
        if (sortedIds[i] !== i) {
          errors.push(`Non-sequential element IDs. Expected ${i}, found ${sortedIds[i]}`);
          break;
        }
      }

      // Check for empty names
      const emptyNames = config.elements.filter(e => !e.name.trim());
      if (emptyNames.length > 0) {
        errors.push(`Empty element names found: ${emptyNames.map(e => e.id).join(', ')}`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`Failed to load mapping: ${error instanceof Error ? error.message : error}`);
      return { valid: false, errors };
    }
  }
}

export const mappingService = new MappingService();