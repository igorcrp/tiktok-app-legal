import React, { useEffect, useCallback, useRef, useState } from "react";
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

/**
 * Custom CSS overrides for driver.js to match Alpha Quant dark/financial aesthetic.
 */
const TOUR_STYLES = `
  /* ── Spotlight: make highlighted element fully visible above overlay ── */
  .driver-active-element {
    z-index: 100000 !important;
    position: relative !important;
  }

  /* Overlay: semi-transparent — platform visible but dimmed */
  .driver-overlay {
    background: rgba(0, 0, 0, 0.45) !important;
  }

  /* ── Popover card ── */
  .driver-popover {
    background: hsl(var(--card)) !important;
    color: hsl(var(--card-foreground)) !important;
    border: 1px solid hsl(var(--border)) !important;
    border-radius: 0.75rem !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
    max-width: 380px !important;
    padding: 0 !important;
    z-index: 100001 !important;
  }
  .driver-popover * {
    font-family: inherit !important;
  }
  .driver-popover .driver-popover-title {
    font-size: 1rem !important;
    font-weight: 700 !important;
    color: hsl(var(--foreground)) !important;
    padding: 1.25rem 1.25rem 0.25rem !important;
    line-height: 1.4 !important;
  }
  .driver-popover .driver-popover-description {
    font-size: 0.8125rem !important;
    color: hsl(var(--muted-foreground)) !important;
    padding: 0.25rem 1.25rem 0 !important;
    line-height: 1.6 !important;
  }
  .driver-popover .driver-popover-progress-text {
    font-size: 0.6875rem !important;
    color: hsl(var(--muted-foreground)) !important;
    padding: 0.75rem 1.25rem 0 !important;
  }
  .driver-popover-footer {
    padding: 0.75rem 1.25rem 1.25rem !important;
    gap: 0.5rem !important;
  }
  .driver-popover-footer button {
    border-radius: 0.5rem !important;
    font-size: 0.8125rem !important;
    font-weight: 500 !important;
    padding: 0.5rem 1rem !important;
    transition: all 150ms ease !important;
    cursor: pointer !important;
    text-decoration: none !important;
    text-shadow: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .driver-popover-prev-btn {
    background: transparent !important;
    color: hsl(var(--muted-foreground)) !important;
    border: 1px solid hsl(var(--border)) !important;
    text-decoration: none !important;
    text-shadow: none !important;
  }
  .driver-popover-prev-btn:hover {
    background: hsl(var(--accent)) !important;
    color: hsl(var(--accent-foreground)) !important;
    text-decoration: none !important;
  }
  .driver-popover-next-btn {
    background: hsl(var(--primary)) !important;
    color: hsl(var(--primary-foreground)) !important;
    border: none !important;
    text-shadow: none !important;
    text-decoration: none !important;
  }
  .driver-popover-next-btn:hover {
    opacity: 0.9 !important;
    text-decoration: none !important;
  }
  .driver-popover-arrow-side-left.driver-popover-arrow,
  .driver-popover-arrow-side-right.driver-popover-arrow,
  .driver-popover-arrow-side-top.driver-popover-arrow,
  .driver-popover-arrow-side-bottom.driver-popover-arrow {
    border-color: hsl(var(--card)) !important;
  }
  .driver-popover .driver-popover-close-btn {
    color: hsl(var(--muted-foreground)) !important;
    font-size: 1.25rem !important;
    top: 0.75rem !important;
    right: 0.75rem !important;
  }
  .driver-popover .driver-popover-close-btn:hover {
    color: hsl(var(--foreground)) !important;
  }
`;

function getDesktopSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "👋 Welcome to Alpha Quant",
        description:
          "This quick tour will show you how to use AI-driven backtesting to find high-probability trading setups. It takes less than 60 seconds.",
        side: "over",
        align: "center",
      },
    },
    {
      element: "[data-tour='basic-config']",
      popover: {
        title: "📊 Market Selection",
        description:
          "Start by choosing your market. Each combination of Country → Exchange → Asset Class loads real OHLCV data so your simulations reflect actual market conditions.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='strategy-config']",
      popover: {
        title: "⚙️ Strategy Parameters",
        description:
          "Fine-tune your entry and exit rules. The Reference Price, Period, Entry %, and Stop % define when the algorithm opens and closes positions — directly impacting your win rate.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='capital-config']",
      popover: {
        title: "💰 Capital & Comparison",
        description:
          "Set your starting capital for the simulation. You can also add comparison assets to benchmark your strategy across multiple stocks simultaneously.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='show-results']",
      popover: {
        title: "🚀 Run Your Backtest",
        description:
          "Once configured, click here to run the simulation. The engine processes thousands of trading days and returns a statistical probability of profit for each asset.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-tour='results-table']",
      popover: {
        title: "📈 Statistical Results",
        description:
          "This table shows the probability of profit, win rate, stop triggers, and final capital for every asset. Click the 🔍 icon on any row to see detailed charts with entry/exit signals.",
        side: "top",
        align: "start",
      },
    },
  ];
}

function getMobileSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: "👋 Welcome to Alpha Quant",
        description:
          "This quick tour will show you how to find high-probability trading setups. Let's get started!",
        side: "over",
        align: "center",
      },
    },
    {
      element: "[data-tour='basic-config']",
      popover: {
        title: "📊 Market Selection",
        description:
          "Choose your Country, Exchange, and Asset Class. These load real market data for accurate backtesting.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "[data-tour='strategy-config']",
      popover: {
        title: "⚙️ Strategy Setup",
        description:
          "Set your entry and exit rules. These parameters define your trading algorithm's behavior.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "[data-tour='show-results']",
      popover: {
        title: "🚀 Run Backtest",
        description:
          "Tap here to simulate thousands of trading days and get a statistical probability of profit.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "[data-tour='results-table']",
      popover: {
        title: "📈 Results & Details",
        description:
          "View win rate, stops, and final capital. Tap 🔍 to see detailed charts with entry/exit signals.",
        side: "top",
        align: "center",
      },
    },
  ];
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const { markTourAsCompleted } = useAuth();
  const isMobile = useIsMobile();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject custom styles once
  useEffect(() => {
    if (!styleRef.current) {
      const style = document.createElement("style");
      style.textContent = TOUR_STYLES;
      document.head.appendChild(style);
      styleRef.current = style;
    }
    return () => {
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }
    };
  }, []);

  const handleComplete = useCallback(async () => {
    await markTourAsCompleted();
    onClose();
  }, [markTourAsCompleted, onClose]);

  useEffect(() => {
    if (!isOpen) {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      return;
    }

    const steps = isMobile ? getMobileSteps() : getDesktopSteps();

    // Filter out steps whose target elements don't exist yet
    const availableSteps = steps.filter((step) => {
      if (!step.element) return true;
      return !!document.querySelector(step.element as string);
    });

    const config: Config = {
      showProgress: true,
      steps: availableSteps,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Finish ✓",
      allowClose: true,
      overlayClickBehavior: "nextStep",
      stagePadding: 6,
      stageRadius: 8,
      popoverOffset: 14,
      smoothScroll: true,
      animate: true,
      onDestroyStarted: () => {
        handleComplete();
      },
    };

    const timeoutId = setTimeout(() => {
      driverRef.current = driver(config);
      driverRef.current.drive();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, [isOpen, isMobile, handleComplete]);

  return null;
}
