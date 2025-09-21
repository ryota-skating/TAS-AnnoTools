/**
 * Figure Skating Element Types
 * Based on mapping/mapping_step_element.txt and mapping/mapping_step_set.txt
 */

// Element IDs (0-55)
export type ElementId = number;

// Element names as they appear in the mapping files
export type ElementName = 
  // Turn elements (0-39) - 8 directions each for 5 turn types
  | 'RFI_Three_Turn' | 'RFO_Three_Turn' | 'RBI_Three_Turn' | 'RBO_Three_Turn'
  | 'LFI_Three_Turn' | 'LFO_Three_Turn' | 'LBI_Three_Turn' | 'LBO_Three_Turn'
  | 'RFI_Bracket_Turn' | 'RFO_Bracket_Turn' | 'RBI_Bracket_Turn' | 'RBO_Bracket_Turn'
  | 'LFI_Bracket_Turn' | 'LFO_Bracket_Turn' | 'LBI_Bracket_Turn' | 'LBO_Bracket_Turn'
  | 'RFI_Rocker_Turn' | 'RFO_Rocker_Turn' | 'RBI_Rocker_Turn' | 'RBO_Rocker_Turn'
  | 'LFI_Rocker_Turn' | 'LFO_Rocker_Turn' | 'LBI_Rocker_Turn' | 'LBO_Rocker_Turn'
  | 'RFI_Counter_Turn' | 'RFO_Counter_Turn' | 'RBI_Counter_Turn' | 'RBO_Counter_Turn'
  | 'LFI_Counter_Turn' | 'LFO_Counter_Turn' | 'LBI_Counter_Turn' | 'LBO_Counter_Turn'
  | 'RFI_Loop_Turn' | 'RFO_Loop_Turn' | 'RBI_Loop_Turn' | 'RBO_Loop_Turn'
  | 'LFI_Loop_Turn' | 'LFO_Loop_Turn' | 'LBI_Loop_Turn' | 'LBO_Loop_Turn'
  // Other elements (40-54)
  | 'Twizzle' | 'Toe_Step' | 'Chasse' | 'Mohawk' | 'Choctaw'
  | 'Change_of_Edge' | 'Cross_Roll' | 'Swing_Roll' | 'Cross_Over'
  | 'Spiral' | 'Arabesque' | 'Spread_Eagles' | 'Ina_Bauers'
  | 'Hydroblading' | 'Knee_Slide'
  // None (55)
  | 'NONE';

// Element categories
export type ElementCategory =
  | 'Three_Turn' | 'Bracket_Turn' | 'Rocker_Turn' | 'Counter_Turn' | 'Loop_Turn'
  | 'Twizzle' | 'Toe_Step' | 'Chasse' | 'Mohawk' | 'Choctaw'
  | 'Change_of_Edge' | 'Cross_Roll' | 'Swing_Roll' | 'Cross_Over'
  | 'Spiral' | 'Arabesque' | 'Spread_Eagles' | 'Ina_Bauers'
  | 'Hydroblading' | 'Knee_Slide' | 'NONE';

// Turn directions (for turn elements only)
export type TurnDirection = 'RFI' | 'RFO' | 'RBI' | 'RBO' | 'LFI' | 'LFO' | 'LBI' | 'LBO';

// Element definition
export interface FigureSkatingElement {
  id: ElementId;
  name: ElementName;
  category: ElementCategory;
  direction?: TurnDirection; // Only for turn elements
  description?: string;
  color?: string; // For UI visualization
  hotkey?: string; // Keyboard shortcut
}

// Element set categories for grouping
export interface ElementSet {
  id: number;
  category: ElementCategory;
  elements: FigureSkatingElement[];
}

// Color scheme for different element categories
const ELEMENT_COLORS: Record<ElementCategory, string> = {
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
  'NONE': '#6b7280'            // Gray
};

// Complete mapping of all 56 elements (0-55)
export const FIGURE_SKATING_ELEMENTS: Record<ElementId, FigureSkatingElement> = {
  // Three Turn (0-7)
  0: { id: 0, name: 'RFI_Three_Turn', category: 'Three_Turn', direction: 'RFI', color: ELEMENT_COLORS['Three_Turn'], description: 'Right Forward Inside Three Turn' },
  1: { id: 1, name: 'RFO_Three_Turn', category: 'Three_Turn', direction: 'RFO', color: ELEMENT_COLORS['Three_Turn'], description: 'Right Forward Outside Three Turn' },
  2: { id: 2, name: 'RBI_Three_Turn', category: 'Three_Turn', direction: 'RBI', color: ELEMENT_COLORS['Three_Turn'], description: 'Right Backward Inside Three Turn' },
  3: { id: 3, name: 'RBO_Three_Turn', category: 'Three_Turn', direction: 'RBO', color: ELEMENT_COLORS['Three_Turn'], description: 'Right Backward Outside Three Turn' },
  4: { id: 4, name: 'LFI_Three_Turn', category: 'Three_Turn', direction: 'LFI', color: ELEMENT_COLORS['Three_Turn'], description: 'Left Forward Inside Three Turn' },
  5: { id: 5, name: 'LFO_Three_Turn', category: 'Three_Turn', direction: 'LFO', color: ELEMENT_COLORS['Three_Turn'], description: 'Left Forward Outside Three Turn' },
  6: { id: 6, name: 'LBI_Three_Turn', category: 'Three_Turn', direction: 'LBI', color: ELEMENT_COLORS['Three_Turn'], description: 'Left Backward Inside Three Turn' },
  7: { id: 7, name: 'LBO_Three_Turn', category: 'Three_Turn', direction: 'LBO', color: ELEMENT_COLORS['Three_Turn'], description: 'Left Backward Outside Three Turn' },
  
  // Bracket Turn (8-15)
  8: { id: 8, name: 'RFI_Bracket_Turn', category: 'Bracket_Turn', direction: 'RFI', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Right Forward Inside Bracket Turn' },
  9: { id: 9, name: 'RFO_Bracket_Turn', category: 'Bracket_Turn', direction: 'RFO', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Right Forward Outside Bracket Turn' },
  10: { id: 10, name: 'RBI_Bracket_Turn', category: 'Bracket_Turn', direction: 'RBI', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Right Backward Inside Bracket Turn' },
  11: { id: 11, name: 'RBO_Bracket_Turn', category: 'Bracket_Turn', direction: 'RBO', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Right Backward Outside Bracket Turn' },
  12: { id: 12, name: 'LFI_Bracket_Turn', category: 'Bracket_Turn', direction: 'LFI', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Left Forward Inside Bracket Turn' },
  13: { id: 13, name: 'LFO_Bracket_Turn', category: 'Bracket_Turn', direction: 'LFO', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Left Forward Outside Bracket Turn' },
  14: { id: 14, name: 'LBI_Bracket_Turn', category: 'Bracket_Turn', direction: 'LBI', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Left Backward Inside Bracket Turn' },
  15: { id: 15, name: 'LBO_Bracket_Turn', category: 'Bracket_Turn', direction: 'LBO', color: ELEMENT_COLORS['Bracket_Turn'], description: 'Left Backward Outside Bracket Turn' },
  
  // Rocker Turn (16-23)
  16: { id: 16, name: 'RFI_Rocker_Turn', category: 'Rocker_Turn', direction: 'RFI', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Right Forward Inside Rocker Turn' },
  17: { id: 17, name: 'RFO_Rocker_Turn', category: 'Rocker_Turn', direction: 'RFO', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Right Forward Outside Rocker Turn' },
  18: { id: 18, name: 'RBI_Rocker_Turn', category: 'Rocker_Turn', direction: 'RBI', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Right Backward Inside Rocker Turn' },
  19: { id: 19, name: 'RBO_Rocker_Turn', category: 'Rocker_Turn', direction: 'RBO', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Right Backward Outside Rocker Turn' },
  20: { id: 20, name: 'LFI_Rocker_Turn', category: 'Rocker_Turn', direction: 'LFI', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Left Forward Inside Rocker Turn' },
  21: { id: 21, name: 'LFO_Rocker_Turn', category: 'Rocker_Turn', direction: 'LFO', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Left Forward Outside Rocker Turn' },
  22: { id: 22, name: 'LBI_Rocker_Turn', category: 'Rocker_Turn', direction: 'LBI', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Left Backward Inside Rocker Turn' },
  23: { id: 23, name: 'LBO_Rocker_Turn', category: 'Rocker_Turn', direction: 'LBO', color: ELEMENT_COLORS['Rocker_Turn'], description: 'Left Backward Outside Rocker Turn' },
  
  // Counter Turn (24-31)
  24: { id: 24, name: 'RFI_Counter_Turn', category: 'Counter_Turn', direction: 'RFI', color: ELEMENT_COLORS['Counter_Turn'], description: 'Right Forward Inside Counter Turn' },
  25: { id: 25, name: 'RFO_Counter_Turn', category: 'Counter_Turn', direction: 'RFO', color: ELEMENT_COLORS['Counter_Turn'], description: 'Right Forward Outside Counter Turn' },
  26: { id: 26, name: 'RBI_Counter_Turn', category: 'Counter_Turn', direction: 'RBI', color: ELEMENT_COLORS['Counter_Turn'], description: 'Right Backward Inside Counter Turn' },
  27: { id: 27, name: 'RBO_Counter_Turn', category: 'Counter_Turn', direction: 'RBO', color: ELEMENT_COLORS['Counter_Turn'], description: 'Right Backward Outside Counter Turn' },
  28: { id: 28, name: 'LFI_Counter_Turn', category: 'Counter_Turn', direction: 'LFI', color: ELEMENT_COLORS['Counter_Turn'], description: 'Left Forward Inside Counter Turn' },
  29: { id: 29, name: 'LFO_Counter_Turn', category: 'Counter_Turn', direction: 'LFO', color: ELEMENT_COLORS['Counter_Turn'], description: 'Left Forward Outside Counter Turn' },
  30: { id: 30, name: 'LBI_Counter_Turn', category: 'Counter_Turn', direction: 'LBI', color: ELEMENT_COLORS['Counter_Turn'], description: 'Left Backward Inside Counter Turn' },
  31: { id: 31, name: 'LBO_Counter_Turn', category: 'Counter_Turn', direction: 'LBO', color: ELEMENT_COLORS['Counter_Turn'], description: 'Left Backward Outside Counter Turn' },
  
  // Loop Turn (32-39)
  32: { id: 32, name: 'RFI_Loop_Turn', category: 'Loop_Turn', direction: 'RFI', color: ELEMENT_COLORS['Loop_Turn'], description: 'Right Forward Inside Loop Turn' },
  33: { id: 33, name: 'RFO_Loop_Turn', category: 'Loop_Turn', direction: 'RFO', color: ELEMENT_COLORS['Loop_Turn'], description: 'Right Forward Outside Loop Turn' },
  34: { id: 34, name: 'RBI_Loop_Turn', category: 'Loop_Turn', direction: 'RBI', color: ELEMENT_COLORS['Loop_Turn'], description: 'Right Backward Inside Loop Turn' },
  35: { id: 35, name: 'RBO_Loop_Turn', category: 'Loop_Turn', direction: 'RBO', color: ELEMENT_COLORS['Loop_Turn'], description: 'Right Backward Outside Loop Turn' },
  36: { id: 36, name: 'LFI_Loop_Turn', category: 'Loop_Turn', direction: 'LFI', color: ELEMENT_COLORS['Loop_Turn'], description: 'Left Forward Inside Loop Turn' },
  37: { id: 37, name: 'LFO_Loop_Turn', category: 'Loop_Turn', direction: 'LFO', color: ELEMENT_COLORS['Loop_Turn'], description: 'Left Forward Outside Loop Turn' },
  38: { id: 38, name: 'LBI_Loop_Turn', category: 'Loop_Turn', direction: 'LBI', color: ELEMENT_COLORS['Loop_Turn'], description: 'Left Backward Inside Loop Turn' },
  39: { id: 39, name: 'LBO_Loop_Turn', category: 'Loop_Turn', direction: 'LBO', color: ELEMENT_COLORS['Loop_Turn'], description: 'Left Backward Outside Loop Turn' },
  
  // Other elements (40-54)
  40: { id: 40, name: 'Twizzle', category: 'Twizzle', color: ELEMENT_COLORS['Twizzle'], description: 'Twizzle', hotkey: '1' },
  41: { id: 41, name: 'Toe_Step', category: 'Toe_Step', color: ELEMENT_COLORS['Toe_Step'], description: 'Toe Step', hotkey: '2' },
  42: { id: 42, name: 'Chasse', category: 'Chasse', color: ELEMENT_COLORS['Chasse'], description: 'Chassé', hotkey: '3' },
  43: { id: 43, name: 'Mohawk', category: 'Mohawk', color: ELEMENT_COLORS['Mohawk'], description: 'Mohawk', hotkey: '4' },
  44: { id: 44, name: 'Choctaw', category: 'Choctaw', color: ELEMENT_COLORS['Choctaw'], description: 'Choctaw', hotkey: '5' },
  45: { id: 45, name: 'Change_of_Edge', category: 'Change_of_Edge', color: ELEMENT_COLORS['Change_of_Edge'], description: 'Change of Edge', hotkey: '6' },
  46: { id: 46, name: 'Cross_Roll', category: 'Cross_Roll', color: ELEMENT_COLORS['Cross_Roll'], description: 'Cross Roll', hotkey: '7' },
  47: { id: 47, name: 'Swing_Roll', category: 'Swing_Roll', color: ELEMENT_COLORS['Swing_Roll'], description: 'Swing Roll', hotkey: '8' },
  48: { id: 48, name: 'Cross_Over', category: 'Cross_Over', color: ELEMENT_COLORS['Cross_Over'], description: 'Cross Over', hotkey: '9' },
  49: { id: 49, name: 'Spiral', category: 'Spiral', color: ELEMENT_COLORS['Spiral'], description: 'Spiral', hotkey: 'q' },
  50: { id: 50, name: 'Arabesque', category: 'Arabesque', color: ELEMENT_COLORS['Arabesque'], description: 'Arabesque', hotkey: 'w' },
  51: { id: 51, name: 'Spread_Eagles', category: 'Spread_Eagles', color: ELEMENT_COLORS['Spread_Eagles'], description: 'Spread Eagles', hotkey: 'e' },
  52: { id: 52, name: 'Ina_Bauers', category: 'Ina_Bauers', color: ELEMENT_COLORS['Ina_Bauers'], description: 'Ina Bauers', hotkey: 'r' },
  53: { id: 53, name: 'Hydroblading', category: 'Hydroblading', color: ELEMENT_COLORS['Hydroblading'], description: 'Hydroblading', hotkey: 't' },
  54: { id: 54, name: 'Knee_Slide', category: 'Knee_Slide', color: ELEMENT_COLORS['Knee_Slide'], description: 'Knee Slide', hotkey: 'y' },
  
  // None (55)
  55: { id: 55, name: 'NONE', category: 'NONE', color: ELEMENT_COLORS['NONE'], description: 'No Element', hotkey: '0' },
};

// Element sets grouped by category (matching mapping_step_set.txt)
export const ELEMENT_SETS: ElementSet[] = [
  {
    id: 0,
    category: 'Three_Turn',
    elements: [0, 1, 2, 3, 4, 5, 6, 7].map(id => FIGURE_SKATING_ELEMENTS[id])
  },
  {
    id: 1,
    category: 'Bracket_Turn',
    elements: [8, 9, 10, 11, 12, 13, 14, 15].map(id => FIGURE_SKATING_ELEMENTS[id])
  },
  {
    id: 2,
    category: 'Rocker_Turn',
    elements: [16, 17, 18, 19, 20, 21, 22, 23].map(id => FIGURE_SKATING_ELEMENTS[id])
  },
  {
    id: 3,
    category: 'Counter_Turn',
    elements: [24, 25, 26, 27, 28, 29, 30, 31].map(id => FIGURE_SKATING_ELEMENTS[id])
  },
  {
    id: 4,
    category: 'Loop_Turn',
    elements: [32, 33, 34, 35, 36, 37, 38, 39].map(id => FIGURE_SKATING_ELEMENTS[id])
  },
  { id: 5, category: 'Twizzle', elements: [FIGURE_SKATING_ELEMENTS[40]] },
  { id: 6, category: 'Toe_Step', elements: [FIGURE_SKATING_ELEMENTS[41]] },
  { id: 7, category: 'Chasse', elements: [FIGURE_SKATING_ELEMENTS[42]] },
  { id: 8, category: 'Mohawk', elements: [FIGURE_SKATING_ELEMENTS[43]] },
  { id: 9, category: 'Choctaw', elements: [FIGURE_SKATING_ELEMENTS[44]] },
  { id: 10, category: 'Change_of_Edge', elements: [FIGURE_SKATING_ELEMENTS[45]] },
  { id: 11, category: 'Cross_Roll', elements: [FIGURE_SKATING_ELEMENTS[46]] },
  { id: 12, category: 'Swing_Roll', elements: [FIGURE_SKATING_ELEMENTS[47]] },
  { id: 13, category: 'Cross_Over', elements: [FIGURE_SKATING_ELEMENTS[48]] },
  { id: 14, category: 'Spiral', elements: [FIGURE_SKATING_ELEMENTS[49]] },
  { id: 15, category: 'Arabesque', elements: [FIGURE_SKATING_ELEMENTS[50]] },
  { id: 16, category: 'Spread_Eagles', elements: [FIGURE_SKATING_ELEMENTS[51]] },
  { id: 17, category: 'Ina_Bauers', elements: [FIGURE_SKATING_ELEMENTS[52]] },
  { id: 18, category: 'Hydroblading', elements: [FIGURE_SKATING_ELEMENTS[53]] },
  { id: 19, category: 'Knee_Slide', elements: [FIGURE_SKATING_ELEMENTS[54]] },
  { id: 20, category: 'NONE', elements: [FIGURE_SKATING_ELEMENTS[55]] },
];

// Utility functions
export function getElementById(id: ElementId): FigureSkatingElement | undefined {
  return FIGURE_SKATING_ELEMENTS[id];
}

export function getElementByName(name: ElementName): FigureSkatingElement | undefined {
  return Object.values(FIGURE_SKATING_ELEMENTS).find(element => element.name === name);
}

export function getElementsByCategory(category: ElementCategory): FigureSkatingElement[] {
  return Object.values(FIGURE_SKATING_ELEMENTS).filter(element => element.category === category);
}

// Array format for easier iteration
export const FIGURE_SKATING_ELEMENTS_ARRAY: FigureSkatingElement[] = Object.values(FIGURE_SKATING_ELEMENTS);

// Most common elements with hotkeys for quick access
export const QUICK_ACCESS_ELEMENTS: FigureSkatingElement[] = [
  FIGURE_SKATING_ELEMENTS[40], // Twizzle - 1
  FIGURE_SKATING_ELEMENTS[41], // Toe_Step - 2
  FIGURE_SKATING_ELEMENTS[42], // Chasse - 3
  FIGURE_SKATING_ELEMENTS[43], // Mohawk - 4
  FIGURE_SKATING_ELEMENTS[44], // Choctaw - 5
  FIGURE_SKATING_ELEMENTS[45], // Change_of_Edge - 6
  FIGURE_SKATING_ELEMENTS[46], // Cross_Roll - 7
  FIGURE_SKATING_ELEMENTS[47], // Swing_Roll - 8
  FIGURE_SKATING_ELEMENTS[48], // Cross_Over - 9
  FIGURE_SKATING_ELEMENTS[55], // NONE - 0
];

export function isTurnElement(element: FigureSkatingElement): boolean {
  return ['Three_Turn', 'Bracket_Turn', 'Rocker_Turn', 'Counter_Turn', 'Loop_Turn'].includes(element.category);
}

export function getElementColor(elementId: ElementId): string {
  return FIGURE_SKATING_ELEMENTS[elementId]?.color || ELEMENT_COLORS['NONE'];
}

export function getElementByHotkey(hotkey: string): FigureSkatingElement | undefined {
  return Object.values(FIGURE_SKATING_ELEMENTS).find(element => element.hotkey === hotkey);
}