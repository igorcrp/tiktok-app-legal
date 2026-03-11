import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

/**
 * Tracks SPA route changes as PageView events for Meta Pixel.
 * Skips the initial mount since index.html already fires PageView on load.
 */
export const useMetaPixel = () => {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render — index.html already fired PageView on initial load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [location.pathname]);

};
