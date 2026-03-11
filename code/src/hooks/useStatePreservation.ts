import { useEffect, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';

// Keys for state preservation
const STATE_KEYS = {
  PAGE_STATE: 'app-page-state',
  SCROLL_POSITION: 'app-scroll-position',
  FORM_STATE: 'app-form-state',
  SESSION_ACTIVE: 'app-session-active',
};

interface VisibilityEvent {
  timestamp: number;
  state: 'visible' | 'hidden';
  reason: string;
}

// Log visibility events for auditing
const logVisibilityEvent = (event: VisibilityEvent) => {
  logger.log(`[StatePreservation] Visibility event: ${event.state} - ${event.reason} at ${new Date(event.timestamp).toISOString()}`);
};

/**
 * Hook to preserve page state across tab/window switches
 * Prevents state loss and unwanted redirects
 */
export function useStatePreservation<T>(
  key: string,
  state: T,
  setState: (state: T) => void,
  options?: {
    debounceMs?: number;
    enabled?: boolean;
  }
) {
  const { debounceMs = 300, enabled = true } = options || {};
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');
  const isRestoringRef = useRef(false);

  // Debounced save to avoid storage pollution
  const saveState = useCallback((stateToSave: T) => {
    if (!enabled) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(stateToSave);
        // Only save if state actually changed
        if (serialized !== lastSavedRef.current) {
          sessionStorage.setItem(`${STATE_KEYS.PAGE_STATE}-${key}`, serialized);
          lastSavedRef.current = serialized;
          logger.log(`[StatePreservation] State saved for key: ${key}`);
        }
      } catch (error) {
        logger.error(`[StatePreservation] Failed to save state for ${key}:`, error);
      }
    }, debounceMs);
  }, [key, enabled, debounceMs]);

  // Restore state on mount
  const restoreState = useCallback(() => {
    if (!enabled || isRestoringRef.current) return null;
    
    try {
      const saved = sessionStorage.getItem(`${STATE_KEYS.PAGE_STATE}-${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        logger.log(`[StatePreservation] State restored for key: ${key}`);
        return parsed as T;
      }
    } catch (error) {
      logger.error(`[StatePreservation] Failed to restore state for ${key}:`, error);
    }
    return null;
  }, [key, enabled]);

  // Clear state (call when intentionally resetting)
  const clearState = useCallback(() => {
    sessionStorage.removeItem(`${STATE_KEYS.PAGE_STATE}-${key}`);
    lastSavedRef.current = '';
    logger.log(`[StatePreservation] State cleared for key: ${key}`);
  }, [key]);

  // Save state on changes
  useEffect(() => {
    if (enabled && state && !isRestoringRef.current) {
      saveState(state);
    }
  }, [state, saveState, enabled]);

  // Restore state on mount
  useEffect(() => {
    if (enabled) {
      isRestoringRef.current = true;
      const restored = restoreState();
      if (restored) {
        setState(restored);
      }
      // Allow normal saves after a small delay
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [key]); // Only run on key change/mount

  return { saveState, restoreState, clearState };
}

/**
 * Hook to handle visibility changes without causing redirects
 * NEVER triggers navigation - only logs and optionally executes safe callbacks
 */
export function useVisibilityPreservation(options?: {
  onVisible?: () => void;
  onHidden?: () => void;
  preventRefetch?: boolean;
}) {
  const { onVisible, onHidden, preventRefetch = true } = options || {};
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      
      logVisibilityEvent({
        timestamp: Date.now(),
        state: isVisible ? 'visible' : 'hidden',
        reason: `Tab ${isVisible ? 'became visible' : 'was hidden'} - NO REDIRECT triggered`,
      });

      if (isVisible && wasHiddenRef.current) {
        // User returned to tab - DO NOT redirect, DO NOT force refetch
        wasHiddenRef.current = false;
        logger.log('[StatePreservation] User returned to tab - preserving state, no redirect');
        
        if (onVisible && !preventRefetch) {
          // Only call if explicitly allowed
          onVisible();
        }
      } else if (!isVisible) {
        wasHiddenRef.current = true;
        logger.log('[StatePreservation] Tab hidden - state preserved');
        onHidden?.();
      }
    };

    const handleWindowFocus = () => {
      logVisibilityEvent({
        timestamp: Date.now(),
        state: 'visible',
        reason: 'Window gained focus - NO REDIRECT triggered',
      });
      logger.log('[StatePreservation] Window focus - preserving state');
    };

    const handleWindowBlur = () => {
      logVisibilityEvent({
        timestamp: Date.now(),
        state: 'hidden',
        reason: 'Window lost focus - state preserved',
      });
      logger.log('[StatePreservation] Window blur - state preserved');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [onVisible, onHidden, preventRefetch]);
}

/**
 * Hook to preserve scroll position
 */
export function useScrollPreservation(key: string) {
  const scrollKey = `${STATE_KEYS.SCROLL_POSITION}-${key}`;

  useEffect(() => {
    // Restore scroll position on mount
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      const { x, y } = JSON.parse(savedScroll);
      // Delay to ensure content is rendered
      requestAnimationFrame(() => {
        window.scrollTo(x, y);
      });
    }

    // Save scroll position on changes
    const handleScroll = () => {
      sessionStorage.setItem(scrollKey, JSON.stringify({
        x: window.scrollX,
        y: window.scrollY,
      }));
    };

    // Debounce scroll saves
    let scrollTimeout: NodeJS.Timeout;
    const debouncedScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 100);
    };

    window.addEventListener('scroll', debouncedScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', debouncedScroll);
      clearTimeout(scrollTimeout);
    };
  }, [scrollKey]);
}

/**
 * Mark session as active - used to detect if page reload should restore state
 */
export function markSessionActive() {
  sessionStorage.setItem(STATE_KEYS.SESSION_ACTIVE, 'true');
}

/**
 * Check if session was active (for reload detection)
 */
export function wasSessionActive(): boolean {
  return sessionStorage.getItem(STATE_KEYS.SESSION_ACTIVE) === 'true';
}

/**
 * Clear all preserved state (use on logout)
 */
export function clearAllPreservedState() {
  Object.values(STATE_KEYS).forEach(key => {
    // Clear items matching our prefix
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const storageKey = sessionStorage.key(i);
      if (storageKey?.startsWith(key) || storageKey?.startsWith('app-')) {
        sessionStorage.removeItem(storageKey);
      }
    }
  });
  logger.log('[StatePreservation] All preserved state cleared');
}
