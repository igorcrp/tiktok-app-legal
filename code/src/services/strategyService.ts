/**
 * Strategy Service - Implements multiple daytrading strategies
 * 
 * Strategies:
 * 1. Entry Percentage (original) - Entry based on % variation from reference price
 * 2. Breakout - Entry when price breaks previous day's high/low
 * 3. Gap Trading - Entry based on opening gap (reversal or continuation)
 * 4. Volume Spike - Entry when volume exceeds N times the average
 * 5. Intraday Oversold - Entry when price drops significantly from open
 * 6. Range Compression - Entry after low volatility days
 * 7. Price-Volume Divergence - Entry when price moves without volume support
 */

import { StockAnalysisParams, TradeHistoryItem } from '@/types';

export type StrategyType = 
  | 'entry-percentage' 
  | 'breakout' 
  | 'gap-trading' 
  | 'intraday-oversold'
  | 'range-compression'
  | 'volume-spike'
  | 'price-volume-divergence';

export interface StrategyConfig {
  id: StrategyType;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  isPremium: boolean;
  parameters: StrategyParameter[];
}

export interface StrategyParameter {
  key: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  tooltip?: string;
}

// Strategy definitions with metadata
export const STRATEGIES: StrategyConfig[] = [
  {
    id: 'entry-percentage',
    name: 'Entry Percentage',
    description: 'Classic strategy: enter when price drops/rises by a set percentage from the reference price. Ideal for mean reversion.',
    icon: 'Percent',
    color: 'text-blue-500',
    gradient: 'from-blue-500/20 to-blue-600/10',
    isPremium: false,
    parameters: [
      { key: 'entryPercentage', label: 'Entry %', type: 'number', default: 1.0, min: 0.25, max: 5.0, step: 0.25, tooltip: 'Percentage drop/rise from reference price to trigger entry' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.0, min: 0.25, max: 5.0, step: 0.25, tooltip: 'Stop loss percentage from entry price' },
    ]
  },
  {
    id: 'breakout',
    name: 'Breakout',
    description: 'Enter when price breaks through the previous day\'s high (buy) or low (sell). Captures momentum moves.',
    icon: 'TrendingUp',
    color: 'text-green-500',
    gradient: 'from-green-500/20 to-emerald-600/10',
    isPremium: false,
    parameters: [
      { key: 'breakoutBuffer', label: 'Buffer %', type: 'number', default: 0.1, min: 0, max: 1.0, step: 0.05, tooltip: 'Additional % above/below previous high/low to confirm breakout' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.0, min: 0.25, max: 5.0, step: 0.25, tooltip: 'Stop loss percentage from entry price' },
    ]
  },
  {
    id: 'gap-trading',
    name: 'Gap Trading',
    description: 'Trade opening gaps. Enter on gap reversals (fade) or gap continuations based on gap size.',
    icon: 'ArrowLeftRight',
    color: 'text-purple-500',
    gradient: 'from-purple-500/20 to-violet-600/10',
    isPremium: true, // Moved to Premium
    parameters: [
      { key: 'minGapPercent', label: 'Min Gap %', type: 'number', default: 1.0, min: 0.5, max: 5.0, step: 0.25, tooltip: 'Minimum gap size to trigger a trade' },
      { key: 'gapMode', label: 'Gap Mode', type: 'select', default: 'fade', options: [{ value: 'fade', label: 'Fade (Reversal)' }, { value: 'continuation', label: 'Continuation' }], tooltip: 'Fade: bet gap closes. Continuation: bet gap extends.' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.5, min: 0.25, max: 5.0, step: 0.25, tooltip: 'Stop loss percentage from entry price' },
    ]
  },
  {
    id: 'intraday-oversold',
    name: 'Intraday Oversold',
    description: 'Enter when intraday price drops significantly from open. Catches mean reversion during the day.',
    icon: 'ArrowDownUp',
    color: 'text-orange-500',
    gradient: 'from-orange-500/20 to-amber-600/10',
    isPremium: false,
    parameters: [
      { key: 'oversoldThreshold', label: 'Drop %', type: 'number', default: 2.0, min: 1.0, max: 5.0, step: 0.25, tooltip: 'Minimum % drop from open to trigger entry' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.0, min: 0.25, max: 5.0, step: 0.25, tooltip: 'Stop loss percentage from entry price' },
    ]
  },
  {
    id: 'range-compression',
    name: 'Range Compression',
    description: 'Enter after low-volatility days. Expects volatility expansion following compression periods.',
    icon: 'Minimize2',
    color: 'text-cyan-500',
    gradient: 'from-cyan-500/20 to-teal-600/10',
    isPremium: true,
    parameters: [
      { key: 'lookbackDays', label: 'Lookback', type: 'number', default: 5, min: 3, max: 20, step: 1, tooltip: 'Days to calculate average range' },
      { key: 'compressionRatio', label: 'Compression', type: 'number', default: 0.5, min: 0.2, max: 0.8, step: 0.1, tooltip: 'Current range must be below this % of average range' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.5, min: 0.25, max: 5.0, step: 0.25 },
    ]
  },
  {
    id: 'volume-spike',
    name: 'Volume Spike',
    description: 'Enter when volume exceeds N times the average. Often indicates institutional activity.',
    icon: 'BarChart3',
    color: 'text-rose-500',
    gradient: 'from-rose-500/20 to-red-600/10',
    isPremium: true,
    parameters: [
      { key: 'volumeMultiplier', label: 'Volume X', type: 'number', default: 2.0, min: 1.5, max: 5.0, step: 0.5, tooltip: 'Volume must be X times the average to trigger' },
      { key: 'volumeLookback', label: 'Lookback', type: 'number', default: 20, min: 5, max: 50, step: 5, tooltip: 'Days to calculate average volume' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.5, min: 0.25, max: 5.0, step: 0.25 },
    ]
  },
  {
    id: 'price-volume-divergence',
    name: 'Price-Volume Divergence',
    description: 'Identify trend exhaustion when price moves without volume support. Anticipates reversals.',
    icon: 'GitBranch',
    color: 'text-indigo-500',
    gradient: 'from-indigo-500/20 to-blue-600/10',
    isPremium: true,
    parameters: [
      { key: 'priceMoveThreshold', label: 'Price Move %', type: 'number', default: 2.0, min: 1.0, max: 5.0, step: 0.5, tooltip: 'Minimum price move to check divergence' },
      { key: 'volumeDropRatio', label: 'Vol Drop', type: 'number', default: 0.7, min: 0.3, max: 0.9, step: 0.1, tooltip: 'Volume must be below this ratio of average' },
      { key: 'stopPercentage', label: 'Stop %', type: 'number', default: 1.5, min: 0.25, max: 5.0, step: 0.25 },
    ]
  }
];

// Get strategy by ID
export function getStrategy(id: StrategyType): StrategyConfig | undefined {
  return STRATEGIES.find(s => s.id === id);
}

// Get all available strategies
export function getAllStrategies(): StrategyConfig[] {
  return STRATEGIES;
}

// Get free strategies only
export function getFreeStrategies(): StrategyConfig[] {
  return STRATEGIES.filter(s => !s.isPremium);
}

// Get premium strategies only
export function getPremiumStrategies(): StrategyConfig[] {
  return STRATEGIES.filter(s => s.isPremium);
}

// Extended params type with strategy-specific fields
export interface StrategyParams extends StockAnalysisParams {
  strategy: StrategyType;
  // Breakout params
  breakoutBuffer?: number;
  // Gap Trading params
  minGapPercent?: number;
  gapMode?: 'fade' | 'continuation';
  // Intraday Oversold params
  oversoldThreshold?: number;
  // Range Compression params
  lookbackDays?: number;
  compressionRatio?: number;
  // Volume Spike params
  volumeMultiplier?: number;
  volumeLookback?: number;
  // Price-Volume Divergence params
  priceMoveThreshold?: number;
  volumeDropRatio?: number;
}

/**
 * Generate trade history using the Entry Percentage strategy (original)
 */
export function generateEntryPercentageTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    const previousData = i > 0 ? sortedData[i - 1] : null;
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    const referencePrice = previousData ? previousData[params.referencePrice] : currentData[params.referencePrice];
    let suggestedEntryPrice: number;
    
    if (params.operation === 'buy') {
      suggestedEntryPrice = referencePrice - (referencePrice * params.entryPercentage / 100);
    } else {
      suggestedEntryPrice = referencePrice + (referencePrice * params.entryPercentage / 100);
    }
    
    let actualPrice: number | string;
    if (params.operation === 'buy') {
      if (Number(currentData.open) <= suggestedEntryPrice) {
        actualPrice = Number(currentData.open);
      } else if (Number(currentData.open) > suggestedEntryPrice && suggestedEntryPrice >= Number(currentData.low)) {
        actualPrice = suggestedEntryPrice;
      } else {
        actualPrice = '-';
      }
    } else {
      if (Number(currentData.open) >= suggestedEntryPrice) {
        actualPrice = Number(currentData.open);
      } else if (Number(currentData.open) < suggestedEntryPrice && suggestedEntryPrice <= Number(currentData.high)) {
        actualPrice = suggestedEntryPrice;
      } else {
        actualPrice = '-';
      }
    }
    
    let trade: string = "-";
    if (params.operation === 'buy') {
      trade = (actualPrice !== '-' && (Number(actualPrice) <= suggestedEntryPrice || Number(currentData.low) <= suggestedEntryPrice)) ? "Buy" : "-";
    } else {
      trade = (actualPrice !== '-' && (Number(actualPrice) >= suggestedEntryPrice || Number(currentData.high) >= suggestedEntryPrice)) ? "Sell" : "-";
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = Number(currentData.low) <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = Number(currentData.high) >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: Number(currentData.high),
      low: Number(currentData.low),
      volume: Number(currentData.volume),
      suggestedEntryPrice,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Generate trade history using the Breakout strategy
 * Buy: Enter when price breaks above previous day's high
 * Sell: Enter when price breaks below previous day's low
 */
export function generateBreakoutTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  const breakoutBuffer = params.breakoutBuffer ?? 0.1;
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    const previousData = i > 0 ? sortedData[i - 1] : null;
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    let suggestedEntryPrice: number;
    let actualPrice: number | string = '-';
    let trade: string = "-";
    
    if (previousData) {
      if (params.operation === 'buy') {
        // Breakout buy: previous high + buffer
        const breakoutLevel = Number(previousData.high) * (1 + breakoutBuffer / 100);
        suggestedEntryPrice = breakoutLevel;
        
        // Check if current day breaks above
        if (Number(currentData.high) >= breakoutLevel) {
          if (Number(currentData.open) >= breakoutLevel) {
            actualPrice = Number(currentData.open);
          } else {
            actualPrice = breakoutLevel;
          }
          trade = "Buy";
        }
      } else {
        // Breakout sell: previous low - buffer
        const breakoutLevel = Number(previousData.low) * (1 - breakoutBuffer / 100);
        suggestedEntryPrice = breakoutLevel;
        
        // Check if current day breaks below
        if (Number(currentData.low) <= breakoutLevel) {
          if (Number(currentData.open) <= breakoutLevel) {
            actualPrice = Number(currentData.open);
          } else {
            actualPrice = breakoutLevel;
          }
          trade = "Sell";
        }
      }
    } else {
      suggestedEntryPrice = Number(currentData.open);
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = Number(currentData.low) <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = Number(currentData.high) >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: Number(currentData.high),
      low: Number(currentData.low),
      volume: Number(currentData.volume),
      suggestedEntryPrice: suggestedEntryPrice!,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Generate trade history using the Gap Trading strategy
 * Fade mode: Bet that gap will close (reversal)
 * Continuation mode: Bet that gap will extend
 */
export function generateGapTradingTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  const minGapPercent = params.minGapPercent ?? 1.0;
  const gapMode = params.gapMode ?? 'fade';
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    const previousData = i > 0 ? sortedData[i - 1] : null;
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    let suggestedEntryPrice = Number(currentData.open);
    let actualPrice: number | string = '-';
    let trade: string = "-";
    
    if (previousData) {
      const previousClose = Number(previousData.close);
      const currentOpen = Number(currentData.open);
      const gapPercent = ((currentOpen - previousClose) / previousClose) * 100;
      
      // Check if gap is significant
      if (Math.abs(gapPercent) >= minGapPercent) {
        const isGapUp = gapPercent > 0;
        
        if (gapMode === 'fade') {
          // Fade mode: bet gap closes
          if (isGapUp && params.operation === 'sell') {
            // Gap up + Sell: Short expecting gap to close
            actualPrice = currentOpen;
            suggestedEntryPrice = currentOpen;
            trade = "Sell";
          } else if (!isGapUp && params.operation === 'buy') {
            // Gap down + Buy: Long expecting gap to close
            actualPrice = currentOpen;
            suggestedEntryPrice = currentOpen;
            trade = "Buy";
          }
        } else {
          // Continuation mode: bet gap extends
          if (isGapUp && params.operation === 'buy') {
            // Gap up + Buy: Long expecting continuation
            actualPrice = currentOpen;
            suggestedEntryPrice = currentOpen;
            trade = "Buy";
          } else if (!isGapUp && params.operation === 'sell') {
            // Gap down + Sell: Short expecting continuation
            actualPrice = currentOpen;
            suggestedEntryPrice = currentOpen;
            trade = "Sell";
          }
        }
      }
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = Number(currentData.low) <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = Number(currentData.high) >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: Number(currentData.high),
      low: Number(currentData.low),
      volume: Number(currentData.volume),
      suggestedEntryPrice,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Generate trade history using the Intraday Oversold strategy
 * Buy: Enter when price drops significantly from open during the day (mean reversion up)
 * Sell: Enter when price rises significantly from open during the day (mean reversion down)
 * 
 * LOGIC: 
 * - For BUY: We want to catch oversold conditions - price dropped X% from open, then we buy expecting reversion
 * - For SELL: We want to catch overbought conditions - price rose X% from open, then we sell expecting reversion
 */
export function generateIntradayOversoldTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  const oversoldThreshold = params.oversoldThreshold ?? 2.0;
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    const currentOpen = Number(currentData.open);
    const currentLow = Number(currentData.low);
    const currentHigh = Number(currentData.high);
    
    // Calculate intraday movement from open
    const intradayDropPercent = ((currentOpen - currentLow) / currentOpen) * 100;
    const intradayRisePercent = ((currentHigh - currentOpen) / currentOpen) * 100;
    
    let suggestedEntryPrice: number;
    let actualPrice: number | string = '-';
    let trade: string = "-";
    
    if (params.operation === 'buy') {
      // BUY strategy: Enter when price drops significantly from open (oversold)
      // Entry at the oversold level (open - threshold%)
      suggestedEntryPrice = currentOpen * (1 - oversoldThreshold / 100);
      
      // Check if intraday low reached the oversold level
      if (currentLow <= suggestedEntryPrice) {
        // Price touched the oversold level - we enter at suggestedEntryPrice
        actualPrice = suggestedEntryPrice;
        trade = "Buy";
      }
    } else {
      // SELL strategy: Enter when price rises significantly from open (overbought)
      // Entry at the overbought level (open + threshold%)
      suggestedEntryPrice = currentOpen * (1 + oversoldThreshold / 100);
      
      // Check if intraday high reached the overbought level
      if (currentHigh >= suggestedEntryPrice) {
        // Price touched the overbought level - we enter at suggestedEntryPrice
        actualPrice = suggestedEntryPrice;
        trade = "Sell";
      }
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = currentLow <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = currentHigh >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: currentHigh,
      low: currentLow,
      volume: Number(currentData.volume),
      suggestedEntryPrice,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Generate trade history using the Range Compression strategy
 * Enter after low-volatility days expecting volatility expansion
 */
export function generateRangeCompressionTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  const lookbackDays = params.lookbackDays ?? 5;
  const compressionRatio = params.compressionRatio ?? 0.5;
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    const previousData = i > 0 ? sortedData[i - 1] : null;
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    let suggestedEntryPrice = Number(currentData.open);
    let actualPrice: number | string = '-';
    let trade: string = "-";
    
    if (i >= lookbackDays && previousData) {
      // Calculate average range over lookback period
      let avgRange = 0;
      for (let j = i - lookbackDays; j < i; j++) {
        avgRange += (Number(sortedData[j].high) - Number(sortedData[j].low));
      }
      avgRange /= lookbackDays;
      
      // Current day range
      const previousRange = Number(previousData.high) - Number(previousData.low);
      
      // Check for compression
      if (previousRange < avgRange * compressionRatio) {
        // Compression detected - enter at open expecting expansion
        actualPrice = Number(currentData.open);
        suggestedEntryPrice = Number(currentData.open);
        trade = params.operation === 'buy' ? "Buy" : "Sell";
      }
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = Number(currentData.low) <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = Number(currentData.high) >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: Number(currentData.high),
      low: Number(currentData.low),
      volume: Number(currentData.volume),
      suggestedEntryPrice,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Generate trade history using the Volume Spike strategy
 * Enter when volume exceeds N times the average
 * 
 * LOGIC:
 * - BUY: When volume spike is detected AND (candle is bullish OR we're at support levels)
 * - SELL: When volume spike is detected AND (candle is bearish OR we're at resistance levels)
 * 
 * Volume spikes often indicate institutional activity, so we trade in the direction of the move
 */
export function generateVolumeSpikeTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  const volumeMultiplier = params.volumeMultiplier ?? 2.0;
  const volumeLookback = params.volumeLookback ?? 20;
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    let suggestedEntryPrice = Number(currentData.open);
    let actualPrice: number | string = '-';
    let trade: string = "-";
    
    if (i >= volumeLookback) {
      // Calculate average volume over lookback period (excluding current day)
      let avgVolume = 0;
      for (let j = i - volumeLookback; j < i; j++) {
        avgVolume += Number(sortedData[j].volume) || 0;
      }
      avgVolume /= volumeLookback;
      
      const currentVolume = Number(currentData.volume) || 0;
      
      // Check for volume spike
      if (avgVolume > 0 && currentVolume >= avgVolume * volumeMultiplier) {
        // Volume spike detected
        // Determine market direction from the candle
        const candleBody = Number(currentData.close) - Number(currentData.open);
        const isBullishCandle = candleBody > 0;
        const isBearishCandle = candleBody < 0;
        
        // For BUY operation: Enter on volume spike with bullish confirmation
        // For SELL operation: Enter on volume spike with bearish confirmation
        if (params.operation === 'buy') {
          // Buy on volume spike when candle is bullish OR when price closes above open
          if (isBullishCandle || Number(currentData.close) > Number(currentData.open)) {
            actualPrice = Number(currentData.open);
            suggestedEntryPrice = Number(currentData.open);
            trade = "Buy";
          }
        } else {
          // Sell on volume spike when candle is bearish OR when price closes below open
          if (isBearishCandle || Number(currentData.close) < Number(currentData.open)) {
            actualPrice = Number(currentData.open);
            suggestedEntryPrice = Number(currentData.open);
            trade = "Sell";
          }
        }
      }
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = Number(currentData.low) <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = Number(currentData.high) >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: Number(currentData.high),
      low: Number(currentData.low),
      volume: Number(currentData.volume),
      suggestedEntryPrice,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Generate trade history using the Price-Volume Divergence strategy
 * Enter when price moves but volume doesn't support it (trend exhaustion)
 * 
 * LOGIC:
 * - Analyze PREVIOUS day's price move vs volume
 * - If previous day had big price move with low volume = exhaustion signal
 * - BUY: If previous day went DOWN with low volume, expect reversal UP
 * - SELL: If previous day went UP with low volume, expect reversal DOWN
 * 
 * This is a contrarian/reversal strategy
 */
export function generatePriceVolumeDivergenceTradeHistory(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const tradeHistory: TradeHistoryItem[] = [];
  let capital = params.initialCapital;
  const priceMoveThreshold = params.priceMoveThreshold ?? 2.0;
  const volumeDropRatio = params.volumeDropRatio ?? 0.7;
  const volumeLookback = 20;
  
  const sortedData = [...stockData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 0; i < sortedData.length; i++) {
    const currentData = sortedData[i];
    const previousData = i > 0 ? sortedData[i - 1] : null;
    const twoDaysAgo = i > 1 ? sortedData[i - 2] : null;
    
    const previousCapital = i > 0 
      ? (tradeHistory[i-1]?.currentCapital ?? params.initialCapital)
      : params.initialCapital;
    
    let suggestedEntryPrice = Number(currentData.open);
    let actualPrice: number | string = '-';
    let trade: string = "-";
    
    // Need at least volumeLookback + 1 days of data
    if (i >= volumeLookback + 1 && previousData && twoDaysAgo) {
      // Calculate average volume over lookback period (before previous day)
      let avgVolume = 0;
      for (let j = i - volumeLookback - 1; j < i - 1; j++) {
        avgVolume += Number(sortedData[j].volume) || 0;
      }
      avgVolume /= volumeLookback;
      
      // Analyze PREVIOUS day's divergence
      const previousVolume = Number(previousData.volume) || 0;
      const twoDaysAgoClose = Number(twoDaysAgo.close);
      const previousClose = Number(previousData.close);
      const previousPriceChangePercent = Math.abs((previousClose - twoDaysAgoClose) / twoDaysAgoClose * 100);
      
      // Check for divergence: PREVIOUS day had big price move with low volume
      if (previousPriceChangePercent >= priceMoveThreshold && previousVolume < avgVolume * volumeDropRatio) {
        // Divergence detected on previous day - trade reversal today
        const wasUpMove = previousClose > twoDaysAgoClose;
        
        // Trade against the previous divergence (expect reversal)
        if (wasUpMove && params.operation === 'sell') {
          // Previous day went UP with low volume - expect reversal DOWN
          actualPrice = Number(currentData.open);
          suggestedEntryPrice = Number(currentData.open);
          trade = "Sell";
        } else if (!wasUpMove && params.operation === 'buy') {
          // Previous day went DOWN with low volume - expect reversal UP
          actualPrice = Number(currentData.open);
          suggestedEntryPrice = Number(currentData.open);
          trade = "Buy";
        }
      }
    }
    
    // Calculate lot size based on capital divided by entry price
    let lotSize = 0;
    if ((trade === "Buy" || trade === "Sell") && actualPrice !== '-' && Number(actualPrice) > 0) {
      lotSize = Math.floor(previousCapital / Number(actualPrice));
      if (lotSize < 1) {
        lotSize = 0;
      }
    }
    
    const stopPrice = actualPrice !== '-' ? (params.operation === 'buy'
      ? Number(actualPrice) - (Number(actualPrice) * params.stopPercentage / 100)
      : Number(actualPrice) + (Number(actualPrice) * params.stopPercentage / 100)) : '-';
    
    let stopTrigger: string = '-';
    if (trade !== "-" && stopPrice !== '-') {
      if (params.operation === 'buy') {
        stopTrigger = Number(currentData.low) <= Number(stopPrice) ? "Executed" : "-";
      } else {
        stopTrigger = Number(currentData.high) >= Number(stopPrice) ? "Executed" : "-";
      }
    }
    
    let profitLoss = 0;
    if (trade !== "-" && actualPrice !== '-') {
      if (stopTrigger === "Executed" && stopPrice !== '-') {
        profitLoss = params.operation === 'buy'
          ? (Number(stopPrice) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(stopPrice)) * lotSize;
      } else {
        profitLoss = params.operation === 'buy'
          ? (Number(currentData.close) - Number(actualPrice)) * lotSize
          : (Number(actualPrice) - Number(currentData.close)) * lotSize;
      }
    }
    
    capital = Math.max(0, previousCapital + profitLoss);
    
    tradeHistory.push({
      date: currentData.date,
      entryPrice: Number(currentData.open),
      exitPrice: Number(currentData.close),
      high: Number(currentData.high),
      low: Number(currentData.low),
      volume: Number(currentData.volume),
      suggestedEntryPrice,
      actualPrice,
      trade,
      lotSize,
      stopPrice,
      stopTrigger,
      profitLoss,
      currentCapital: capital
    });
  }
  
  return tradeHistory;
}

/**
 * Main dispatcher function - generates trade history based on strategy type
 */
export function generateTradeHistoryForStrategy(
  stockData: any[],
  params: StrategyParams
): TradeHistoryItem[] {
  const strategy = params.strategy || 'entry-percentage';
  
  switch (strategy) {
    case 'breakout':
      return generateBreakoutTradeHistory(stockData, params);
    case 'gap-trading':
      return generateGapTradingTradeHistory(stockData, params);
    case 'intraday-oversold':
      return generateIntradayOversoldTradeHistory(stockData, params);
    case 'range-compression':
      return generateRangeCompressionTradeHistory(stockData, params);
    case 'volume-spike':
      return generateVolumeSpikeTradeHistory(stockData, params);
    case 'price-volume-divergence':
      return generatePriceVolumeDivergenceTradeHistory(stockData, params);
    case 'entry-percentage':
    default:
      return generateEntryPercentageTradeHistory(stockData, params);
  }
}
