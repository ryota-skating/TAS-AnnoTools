/**
 * Figure Skating Hotkeys Hook
 * Provides keyboard shortcuts for quick annotation of figure skating elements
 * Requirements: FR-2 (keyboard controls), element hotkeys from label set
 */

import { useEffect, useCallback } from 'react';
import type { LabelSet, AnnotationSegment } from '../types/api';
import { FIGURE_SKATING_ELEMENTS } from '@shared/types/figure-skating';

interface FigureSkatingHotkeysHandlers {
  onQuickAnnotate: (elementId: number) => void;
  onDeleteCurrentSegment?: () => void;
  onSaveAnnotations?: () => void;
  onClearSelection?: () => void;
}

interface UseFigureSkatingHotkeysOptions {
  enabled?: boolean;
  labelSet?: LabelSet | null;
  selectedSegment?: AnnotationSegment | null;
  selectionRange?: { start: number; end: number } | null;
}

export function useFigureSkatingHotkeys(
  handlers: FigureSkatingHotkeysHandlers,
  options: UseFigureSkatingHotkeysOptions = {}
) {
  const { enabled = true, labelSet, selectedSegment, selectionRange } = options;

  // Handle hotkey events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is typing in input elements
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const { key, ctrlKey, metaKey, altKey, shiftKey } = event;

    // Handle modifier + key combinations for annotation actions
    if (ctrlKey || metaKey) {
      switch (key.toLowerCase()) {
        case 's':
          event.preventDefault();
          // Ctrl+S: Save annotations
          if (handlers.onSaveAnnotations) {
            handlers.onSaveAnnotations();
          }
          break;

        case 'd':
          event.preventDefault();
          // Ctrl+D: Delete current segment
          if (selectedSegment && handlers.onDeleteCurrentSegment) {
            handlers.onDeleteCurrentSegment();
          }
          break;

        default:
          // Check for element hotkeys with Ctrl
          handleElementHotkey(key, event);
          break;
      }
      return;
    }

    // Handle single key presses for element hotkeys
    if (!altKey && !shiftKey && !ctrlKey && !metaKey) {
      switch (key) {
        case 'Escape':
          event.preventDefault();
          // Escape: Clear selection
          if (handlers.onClearSelection) {
            handlers.onClearSelection();
          }
          break;

        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          // Delete: Remove current segment
          if (selectedSegment && handlers.onDeleteCurrentSegment) {
            handlers.onDeleteCurrentSegment();
          }
          break;

        default:
          // Check for element hotkeys
          handleElementHotkey(key, event);
          break;
      }
    }
  }, [enabled, labelSet, selectedSegment, selectionRange, handlers]);

  // Handle element hotkey mappings
  const handleElementHotkey = useCallback((key: string, event: KeyboardEvent) => {
    if (!labelSet || (!selectedSegment && !selectionRange)) return;

    // Find element ID by hotkey
    const labelItem = labelSet.items.find(item => 
      item.hotkey?.toLowerCase() === key.toLowerCase()
    );

    if (labelItem) {
      event.preventDefault();
      handlers.onQuickAnnotate(labelItem.elementId);
    } else {
      // Handle numeric keys for common elements (1-9, 0)
      const numericKey = parseInt(key);
      if (!isNaN(numericKey)) {
        const commonElements = getCommonElementMappings();
        const elementId = commonElements[numericKey];
        
        if (elementId !== undefined) {
          event.preventDefault();
          handlers.onQuickAnnotate(elementId);
        }
      }
    }
  }, [labelSet, selectedSegment, selectionRange, handlers]);

  // Set up event listener
  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  // Get commonly used element mappings for numeric keys
  const getCommonElementMappings = useCallback((): Record<number, number> => {
    return {
      1: 0,  // RFI_Three_Turn
      2: 1,  // RFO_Three_Turn
      3: 2,  // LFI_Three_Turn
      4: 3,  // LFO_Three_Turn
      5: 4,  // RBI_Three_Turn
      6: 20, // RFI_Mohawk
      7: 24, // RFI_Bracket
      8: 32, // Forward_Crossover
      9: 40, // Standing
      0: 55, // NONE
    };
  }, []);

  // Generate help text for hotkeys
  const getHotkeyHelp = useCallback(() => {
    const shortcuts: Array<{ keys: string; description: string; category: string }> = [];

    // System shortcuts
    shortcuts.push(
      { keys: 'Ctrl+S', description: 'Save annotations', category: 'System' },
      { keys: 'Ctrl+D', description: 'Delete current segment', category: 'System' },
      { keys: 'Escape', description: 'Clear selection', category: 'System' },
      { keys: 'Delete/Backspace', description: 'Delete selected segment', category: 'System' }
    );

    // Element shortcuts from label set
    if (labelSet) {
      labelSet.items.forEach(item => {
        if (item.hotkey) {
          const element = FIGURE_SKATING_ELEMENTS[item.elementId];
          if (element) {
            shortcuts.push({
              keys: item.hotkey,
              description: element.name.replace(/_/g, ' '),
              category: element.category.replace(/_/g, ' ')
            });
          }
        }
      });
    }

    // Common numeric shortcuts
    const commonMappings = getCommonElementMappings();
    Object.entries(commonMappings).forEach(([key, elementId]) => {
      const element = FIGURE_SKATING_ELEMENTS[elementId];
      if (element) {
        shortcuts.push({
          keys: key === '0' ? '0' : key,
          description: element.name.replace(/_/g, ' '),
          category: 'Quick Access'
        });
      }
    });

    return shortcuts;
  }, [labelSet, getCommonElementMappings]);

  return {
    getHotkeyHelp,
    isEnabled: enabled
  };
}