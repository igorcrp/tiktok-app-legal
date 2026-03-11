// Premium Parameter Optimization Service
// Finds the best Entry% and Stop% for each asset to maximize Final Capital
// NOW SUPPORTS ALL STRATEGIES WITH IMPROVED GRID SEARCH

import { StockAnalysisParams, TradeHistoryItem } from '@/types';
import { StrategyParams, StrategyType, generateTradeHistoryForStrategy, STRATEGIES } from './strategyService';

export interface OptimizationResult {
  optimalEntryPercent: number;
  optimalStopPercent: number;
  optimalFinalCapital: number;
}

interface OptimizationConfig {
  minPercent: number;
  maxPercent: number;
  stepPercent: number;
}

// IMPROVED: Extended default range for Entry% optimization
const DEFAULT_ENTRY_CONFIG: OptimizationConfig = {
  minPercent: 0.25,
  maxPercent: 5.0,  // Extended from 3.0 to 5.0
  stepPercent: 0.05 // Finer step for better precision (was 0.1)
};

// IMPROVED: Extended stop range with finer steps
const DEFAULT_STOP_CONFIG: OptimizationConfig = {
  minPercent: 0.25,
  maxPercent: 5.0,  // Extended from 3.0 to 5.0
  stepPercent: 0.1  // Finer step for stops
};

/**
 * Generates all percentage values to test based on config
 */
function generatePercentageRange(config: OptimizationConfig): number[] {
  const values: number[] = [];
  for (let p = config.minPercent; p <= config.maxPercent + 0.001; p += config.stepPercent) {
    values.push(Math.round(p * 100) / 100); // Round to 2 decimal places
  }
  return values;
}

/**
 * Get the primary optimization parameter key for a strategy
 * Different strategies optimize different parameters
 */
function getOptimizationParamKey(strategy: StrategyType): string {
  switch (strategy) {
    case 'breakout':
      return 'breakoutBuffer';
    case 'gap-trading':
      return 'minGapPercent';
    case 'intraday-oversold':
      return 'oversoldThreshold';
    case 'range-compression':
      return 'compressionRatio';
    case 'volume-spike':
      return 'volumeMultiplier';
    case 'price-volume-divergence':
      return 'priceMoveThreshold';
    case 'entry-percentage':
    default:
      return 'entryPercentage';
  }
}

/**
 * IMPROVED: Get the optimization range for a specific strategy parameter
 * Now with extended ranges and finer steps for better optimization results
 */
function getOptimizationRange(strategy: StrategyType): OptimizationConfig {
  switch (strategy) {
    case 'breakout':
      // Buffer ranges from 0 to 2% with finer steps
      return { minPercent: 0, maxPercent: 2.0, stepPercent: 0.05 };
    case 'gap-trading':
      // Gap threshold from 0.25% to 6% with finer steps
      return { minPercent: 0.25, maxPercent: 6.0, stepPercent: 0.1 };
    case 'intraday-oversold':
      // Oversold threshold from 0.5% to 6% with finer steps
      return { minPercent: 0.5, maxPercent: 6.0, stepPercent: 0.1 };
    case 'range-compression':
      // Compression ratio from 0.1 to 0.9 with finer steps
      return { minPercent: 0.1, maxPercent: 0.9, stepPercent: 0.05 };
    case 'volume-spike':
      // Volume multiplier from 1.2x to 6x with finer steps
      return { minPercent: 1.2, maxPercent: 6.0, stepPercent: 0.2 };
    case 'price-volume-divergence':
      // Price move threshold from 0.5% to 6% with finer steps
      return { minPercent: 0.5, maxPercent: 6.0, stepPercent: 0.2 };
    case 'entry-percentage':
    default:
      return DEFAULT_ENTRY_CONFIG;
  }
}

/**
 * Simulates trades using the strategy-specific logic
 * Returns the final capital achieved
 */
function simulateTradesForStrategy(
  stockData: any[],
  params: StrategyParams
): number {
  // Use the strategy dispatcher to generate trade history
  const tradeHistory = generateTradeHistoryForStrategy(stockData, params);
  
  if (!tradeHistory || tradeHistory.length === 0) {
    return params.initialCapital;
  }
  
  // Get the final capital from the last trade
  const lastTrade = tradeHistory[tradeHistory.length - 1];
  return lastTrade.currentCapital ?? params.initialCapital;
}

/**
 * IMPROVED: Finds the optimal Entry% (or strategy-specific param) and Stop% combination
 * that maximizes the Final Capital - NOW WITH BETTER GRID SEARCH
 * 
 * Key improvements:
 * 1. Extended parameter ranges (0.25% to 5% for Entry, 0.25% to 5% for Stop)
 * 2. Finer step sizes (0.05 for Entry, 0.1 for Stop) for better precision
 * 3. Optimizes BOTH entry and stop together, not just one
 * 4. Returns parameters that ACTUALLY produce the highest capital
 */
export function findOptimalParameters(
  stockData: any[],
  params: StockAnalysisParams,
  config?: OptimizationConfig
): OptimizationResult {
  const strategy = (params as StrategyParams).strategy || 'entry-percentage';
  const entryParamKey = getOptimizationParamKey(strategy);
  const entryRange = getOptimizationRange(strategy);
  const stopRange = DEFAULT_STOP_CONFIG;
  
  // Initialize with current parameters and their capital
  let bestEntryPercent = params.entryPercentage || entryRange.minPercent;
  let bestStopPercent = params.stopPercentage;
  
  const currentParams: StrategyParams = {
    ...params,
    strategy,
  } as StrategyParams;
  
  let bestFinalCapital = simulateTradesForStrategy(stockData, currentParams);
  
  // ===== PHASE 1: COARSE GRID SEARCH =====
  // Use larger steps to quickly identify the best region
  const coarseEntryStep = Math.max(entryRange.stepPercent * 5, 0.25);
  const coarseStopStep = Math.max(stopRange.stepPercent * 5, 0.5);
  
  const coarseEntryValues = generatePercentageRange({
    minPercent: entryRange.minPercent,
    maxPercent: entryRange.maxPercent,
    stepPercent: coarseEntryStep
  });
  const coarseStopValues = generatePercentageRange({
    minPercent: stopRange.minPercent,
    maxPercent: stopRange.maxPercent,
    stepPercent: coarseStopStep
  });
  
  console.log(`[OPTIMIZATION] Strategy: ${strategy}, Entry param: ${entryParamKey}`);
  console.log(`[OPTIMIZATION] Phase 1 (Coarse): ${coarseEntryValues.length} x ${coarseStopValues.length} = ${coarseEntryValues.length * coarseStopValues.length} combinations`);
  
  let coarseBestEntry = bestEntryPercent;
  let coarseBestStop = bestStopPercent;
  
  for (const entryValue of coarseEntryValues) {
    for (const stopPercent of coarseStopValues) {
      const testParams = buildTestParams(params, strategy, entryValue, stopPercent);
      const finalCapital = simulateTradesForStrategy(stockData, testParams);
      
      if (finalCapital > bestFinalCapital) {
        bestFinalCapital = finalCapital;
        coarseBestEntry = entryValue;
        coarseBestStop = stopPercent;
        bestEntryPercent = entryValue;
        bestStopPercent = stopPercent;
      }
    }
  }
  
  // ===== PHASE 2: FINE REFINEMENT around the best coarse region =====
  const refineEntryMin = Math.max(entryRange.minPercent, coarseBestEntry - coarseEntryStep);
  const refineEntryMax = Math.min(entryRange.maxPercent, coarseBestEntry + coarseEntryStep);
  const refineStopMin = Math.max(stopRange.minPercent, coarseBestStop - coarseStopStep);
  const refineStopMax = Math.min(stopRange.maxPercent, coarseBestStop + coarseStopStep);
  
  const fineEntryValues = generatePercentageRange({
    minPercent: refineEntryMin,
    maxPercent: refineEntryMax,
    stepPercent: entryRange.stepPercent
  });
  const fineStopValues = generatePercentageRange({
    minPercent: refineStopMin,
    maxPercent: refineStopMax,
    stepPercent: stopRange.stepPercent
  });
  
  console.log(`[OPTIMIZATION] Phase 2 (Fine): ${fineEntryValues.length} x ${fineStopValues.length} = ${fineEntryValues.length * fineStopValues.length} combinations`);
  
  for (const entryValue of fineEntryValues) {
    for (const stopPercent of fineStopValues) {
      const testParams = buildTestParams(params, strategy, entryValue, stopPercent);
      const finalCapital = simulateTradesForStrategy(stockData, testParams);
      
      if (finalCapital > bestFinalCapital) {
        bestFinalCapital = finalCapital;
        bestEntryPercent = entryValue;
        bestStopPercent = stopPercent;
      }
    }
  }
  
  const totalCombinations = (coarseEntryValues.length * coarseStopValues.length) + (fineEntryValues.length * fineStopValues.length);
  console.log(`[OPTIMIZATION] Total combinations tested: ${totalCombinations} (vs ~4600 exhaustive)`);
  
  if (bestEntryPercent === params.entryPercentage && bestStopPercent === params.stopPercentage) {
    console.log(`[OPTIMIZATION] Current parameters are already optimal or no improvement found`);
  } else {
    console.log(`[OPTIMIZATION] Found better parameters: Entry=${bestEntryPercent}, Stop=${bestStopPercent}`);
  }
  
  console.log(`[OPTIMIZATION] Best found: Entry=${bestEntryPercent}, Stop=${bestStopPercent}, Capital=$${bestFinalCapital.toFixed(2)}`);
  
  return {
    optimalEntryPercent: bestEntryPercent,
    optimalStopPercent: bestStopPercent,
    optimalFinalCapital: bestFinalCapital
  };
}

/**
 * Builds strategy-specific test parameters for optimization
 */
function buildTestParams(
  params: StockAnalysisParams,
  strategy: string,
  entryValue: number,
  stopPercent: number
): StrategyParams {
  return {
    ...params,
    strategy: strategy as any,
    stopPercentage: stopPercent,
    entryPercentage: strategy === 'entry-percentage' ? entryValue : params.entryPercentage,
    breakoutBuffer: strategy === 'breakout' ? entryValue : (params as StrategyParams).breakoutBuffer,
    minGapPercent: strategy === 'gap-trading' ? entryValue : (params as StrategyParams).minGapPercent,
    oversoldThreshold: strategy === 'intraday-oversold' ? entryValue : (params as StrategyParams).oversoldThreshold,
    compressionRatio: strategy === 'range-compression' ? entryValue : (params as StrategyParams).compressionRatio,
    volumeMultiplier: strategy === 'volume-spike' ? entryValue : (params as StrategyParams).volumeMultiplier,
    priceMoveThreshold: strategy === 'price-volume-divergence' ? entryValue : (params as StrategyParams).priceMoveThreshold,
  };
}

/**
 * Batch optimization for multiple stocks
 * Uses parallel processing for better performance
 */
export async function optimizeMultipleStocks(
  stocksData: Map<string, any[]>,
  params: StockAnalysisParams,
  progressCallback?: (progress: number) => void
): Promise<Map<string, OptimizationResult>> {
  const results = new Map<string, OptimizationResult>();
  const stockCodes = Array.from(stocksData.keys());
  
  let processed = 0;
  const total = stockCodes.length;
  
  // Process in batches of 5 for parallel execution
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < stockCodes.length; i += BATCH_SIZE) {
    const batch = stockCodes.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (stockCode) => {
      const stockData = stocksData.get(stockCode);
      if (!stockData || stockData.length === 0) {
        return { stockCode, result: null };
      }
      
      const result = findOptimalParameters(stockData, params);
      return { stockCode, result };
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { stockCode, result } of batchResults) {
      if (result) {
        results.set(stockCode, result);
      }
      processed++;
    }
    
    if (progressCallback) {
      progressCallback((processed / total) * 100);
    }
  }
  
  return results;
}

export const optimizationService = {
  findOptimalParameters,
  optimizeMultipleStocks,
  DEFAULT_ENTRY_CONFIG,
  DEFAULT_STOP_CONFIG
};
