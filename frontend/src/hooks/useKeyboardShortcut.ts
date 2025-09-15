import { useCallback, useEffect, useRef } from 'react';

type KeyCombination = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

type ShortcutHandler = (event: KeyboardEvent) => void;

type ShortcutMap = Record<string, {
  handler: ShortcutHandler;
  description: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
}>;

const isMac = typeof window !== 'undefined' ? /Mac|iPod|iPhone|iPad/.test(navigator.platform) : false;

export function useKeyboardShortcut(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);
  
  // Update shortcuts ref when the shortcuts prop changes
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // Check if a keyboard event matches a key combination
  const matchesKeyCombination = useCallback((event: KeyboardEvent, combo: KeyCombination) => {
    return (
      event.key.toLowerCase() === combo.key.toLowerCase() &&
      (combo.ctrl ? event.ctrlKey : !event.ctrlKey) &&
      (combo.shift ? event.shiftKey : !event.shiftKey) &&
      (combo.alt ? event.altKey : !event.altKey) &&
      (combo.meta ? event.metaKey : !event.metaKey)
    );
  }, []);

  // Parse a shortcut string into a key combination
  const parseShortcut = useCallback((shortcut: string): KeyCombination => {
    const parts = shortcut.toLowerCase().split('+').map(part => part.trim());
    
    const combination: KeyCombination = { key: '' };
    
    for (const part of parts) {
      switch (part) {
        case 'ctrl':
          combination.ctrl = true;
          break;
        case 'shift':
          combination.shift = true;
          break;
        case 'alt':
          combination.alt = true;
          break;
        case 'cmd':
        case 'meta':
          combination.meta = true;
          break;
        default:
          combination.key = part;
      }
    }
    
    return combination;
  }, []);

  // Format a key combination into a display string
  const formatShortcut = useCallback((shortcut: string): string => {
    const parts = shortcut.split('+').map(part => part.trim());
    
    return parts
      .map(part => {
        switch (part.toLowerCase()) {
          case 'ctrl':
            return isMac ? '⌃' : 'Ctrl';
          case 'shift':
            return isMac ? '⇧' : 'Shift';
          case 'alt':
            return isMac ? '⌥' : 'Alt';
          case 'cmd':
            return '⌘';
          case 'meta':
            return isMac ? '⌘' : 'Win';
          case ' ':
            return 'Space';
          case 'escape':
            return 'Esc';
          case 'arrowup':
            return '↑';
          case 'arrowdown':
            return '↓';
          case 'arrowleft':
            return '←';
          case 'arrowright':
            return '→';
          default:
            return part.length === 1 ? part.toUpperCase() : part;
        }
      })
      .join(isMac ? '' : '+');
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields, textareas, or contenteditable elements
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // Check each registered shortcut
    for (const [shortcut, { handler, preventDefault = true, stopPropagation = false, enabled = true }] of Object.entries(shortcutsRef.current)) {
      if (!enabled) continue;
      
      const combination = parseShortcut(shortcut);
      
      if (matchesKeyCombination(event, combination)) {
        if (preventDefault) {
          event.preventDefault();
        }
        
        if (stopPropagation) {
          event.stopPropagation();
        }
        
        handler(event);
        break; // Only trigger one shortcut per key press
      }
    }
  }, [matchesKeyCombination, parseShortcut]);

  // Add and remove event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { formatShortcut };
}

// Common shortcuts
export const COMMON_SHORTCUTS = {
  // Navigation
  'g d': { description: 'Go to Dashboard' },
  'g a': { description: 'Go to Analytics' },
  'g o': { description: 'Go to Orders' },
  'g p': { description: 'Go to Products' },
  'g c': { description: 'Go to Customers' },
  'g s': { description: 'Go to Settings' },
  
  // Actions
  'n': { description: 'New item' },
  '/': { description: 'Focus search' },
  'f': { description: 'Open filters' },
  '?': { description: 'Show keyboard shortcuts' },
  'esc': { description: 'Close modal/dialog' },
  
  // Table navigation
  'j': { description: 'Next row' },
  'k': { description: 'Previous row' },
  'h': { description: 'Previous column' },
  'l': { description: 'Next column' },
  'enter': { description: 'Open selected item' },
  
  // Global
  'ctrl+s': { description: 'Save', preventDefault: true },
  'cmd+s': { description: 'Save', preventDefault: true },
  'ctrl+/': { description: 'Show help', preventDefault: true },
  'cmd+/': { description: 'Show help', preventDefault: true },
} as const;

// Hook to handle common shortcuts
export function useCommonShortcuts(customHandlers: Record<string, ShortcutHandler> = {}) {
  const shortcuts = Object.entries(COMMON_SHORTCUTS).reduce<ShortcutMap>((acc, [key, value]) => {
    if (key in customHandlers) {
      acc[key] = {
        ...value,
        handler: customHandlers[key],
      };
    }
    return acc;
  }, {});
  
  return useKeyboardShortcut(shortcuts);
}
