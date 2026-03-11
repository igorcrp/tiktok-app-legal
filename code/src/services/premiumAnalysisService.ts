// Premium Analysis Service - Optimized processing for Premium users
import { supabase, fromDynamic } from '@/integrations/supabase/client';
import { AnalysisResult, DetailedResult, StockAnalysisParams, StockInfo, TradeHistoryItem } from '@/types';
import { getDateRangeForPeriod } from '@/utils/dateUtils';
import { findOptimalParameters } from '@/services/optimizationService';
import { generateTradeHistoryForStrategy, StrategyParams } from '@/services/strategyService';

export const premiumAnalysisService = {
  async runOptimizedAnalysis(
    params: StockAnalysisParams,
    progressCallback?: (progress: number) => void
  ): Promise<AnalysisResult[]> {
    try {
      console.info(`Running PREMIUM optimized analysis with parameters:`, params);
      console.info(`DEBUG PREMIUM: ComparisonStocks received:`, params.comparisonStocks);
      
      let progress = 0;
      const updateProgress = (increment: number) => {
        progress += increment;
        if (progressCallback) {
          progressCallback(Math.min(progress, 100));
        }
      };

      if (!params.dataTableName) {
        const tableName = await this.getDataTableName(
          params.country,
          params.stockMarket,
          params.assetClass
        );
        if (!tableName) {
          throw new Error('Could not determine data table name');
        }
        params.dataTableName = tableName;
      }

      updateProgress(10);
      
      const stocks = await this.getAvailableStocksOptimized(params.dataTableName);
      console.info(`Found ${stocks.length} stocks for PREMIUM analysis`);
      
      if (!stocks || stocks.length === 0) {
        console.warn('No stocks found for the selected criteria');
        return [];
      }
      
      updateProgress(15);
      
      const stocksToProcess = params.comparisonStocks && params.comparisonStocks.length > 0
        ? stocks.filter(s => params.comparisonStocks!.includes(s.code))
        : stocks;
      
      console.info(`DEBUG PREMIUM: Processing ${stocksToProcess.length} stocks (filtered from ${stocks.length})`);
      console.info(`DEBUG PREMIUM: Stocks to process:`, stocksToProcess.map(s => s.code));
      
      const batchSize = 15;
      const results: AnalysisResult[] = [];
      
      for (let i = 0; i < stocksToProcess.length; i += batchSize) {
        const batch = stocksToProcess.slice(i, i + batchSize);
        console.info(`Processing PREMIUM batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(stocksToProcess.length/batchSize)}`);
        
        const batchPromises = batch.map(stock => this.processStockOptimized(stock, params));
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
            console.info(`DEBUG PREMIUM: Successfully processed ${batch[index].code}`);
          } else if (result.status === 'rejected') {
            console.error(`DEBUG PREMIUM: Error processing stock ${batch[index].code}:`, result.reason);
          }
        });
        
        const progressIncrement = (60 / Math.ceil(stocksToProcess.length / batchSize));
        updateProgress(progressIncrement);
      }
      
      results.sort((a, b) => b.profitPercentage - a.profitPercentage);
      
      // Calculate probability for all results in parallel batches (OPTIMIZED FOR PREMIUM)
      const PROB_BATCH_SIZE = 20; // Process 20 probability calculations at once
      
      for (let i = 0; i < results.length; i += PROB_BATCH_SIZE) {
        const batch = results.slice(i, i + PROB_BATCH_SIZE);
        
        const probabilityPromises = batch.map(async (result) => {
          try {
            const { data: probData, error: probError } = await (supabase.rpc as any)('calculate_today_probability', {
              p_asset_code: result.assetCode,
              p_operation: params.operation,
              p_reference_price: params.referencePrice,
              p_entry_percent: params.entryPercentage,
              p_stop_percent: params.stopPercentage,
              p_asset_class: params.assetClass,
              p_exchange: params.stockMarket
            });
            
            if (!probError && probData && probData.length > 0) {
              result.probabilityToday = probData[0].probability_today;
              result.probabilityRaw = probData[0].probability_raw;
              
              // Calculate confidence score based on number of trades
              if (probData[0].probability_raw && result.trades > 0) {
                const p = probData[0].probability_raw / 100;
                const n = result.trades;
                const standardError = Math.sqrt((p * (1 - p)) / n);
                // Confidence decreases with higher standard error
                const confidenceScore = Math.max(0, Math.min(100, (1 - standardError * 2) * 100));
                result.confidence95 = confidenceScore.toFixed(1);
              } else {
                result.confidence95 = probData[0].confidence_95;
              }
            }
          } catch (error) {
            console.error(`Error calculating probability for ${result.assetCode}:`, error);
          }
        });
        
        await Promise.all(probabilityPromises);
        
        // Smooth progress update across probability batches
        const progressIncrement = 15 / Math.ceil(results.length / PROB_BATCH_SIZE);
        updateProgress(progressIncrement);
      }
      console.info(`PREMIUM analysis completed. Processed ${results.length} stocks successfully.`);
      return results;
    } catch (error) {
      console.error('Failed to run PREMIUM optimized analysis:', error);
      throw error;
    }
  },

  async processStockOptimized(stock: StockInfo, params: StockAnalysisParams): Promise<AnalysisResult | null> {
    try {
      console.log(`[DEBUG] Processing ${stock.code} from table ${params.dataTableName}`);
      
      const stockData = await this.getStockDataOptimized(
        params.dataTableName!, 
        stock.code,
        params.period
      );
      
      console.log(`[DEBUG] ${stock.code}: Retrieved ${stockData?.length || 0} data points`);
      
      if (!stockData || stockData.length === 0) {
        console.warn(`[DEBUG] No data found for stock ${stock.code}, skipping`);
        return null;
      }
      
      const tradeHistory = await this.generateTradeHistoryOptimized(stockData, params);
      
      console.log(`[DEBUG] ${stock.code}: Generated ${tradeHistory?.length || 0} trade history entries`);
      
      if (!tradeHistory || tradeHistory.length === 0) {
        console.warn(`[DEBUG] No trade history generated for ${stock.code}, skipping`);
        return null;
      }
      
      const { capitalEvolution, metrics } = this.calculateMetricsOptimized(
        stockData, 
        tradeHistory, 
        params.initialCapital
      );
      
      // Get the most recent Current Capital from trade history
      const sortedTradeHistory = [...tradeHistory].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const lastTrade = sortedTradeHistory[sortedTradeHistory.length - 1];
      const lastCurrentCapital = lastTrade.currentCapital ?? params.initialCapital;
      
      // Debug log para verificar se a correção está funcionando no premium service
      console.log(`[DEBUG PREMIUM ${stock.code}] CORRECTED Final Capital:`, {
        totalTrades: sortedTradeHistory.length,
        lastTradeDate: lastTrade.date,
        lastCurrentCapital: lastTrade.currentCapital,
        finalCapital: lastCurrentCapital,
        initialCapital: params.initialCapital
      });
      
      // Calcular o profit correto baseado no lastCurrentCapital
      const correctProfit = lastCurrentCapital - params.initialCapital;
      
      // *** PREMIUM FEATURE: Find optimal Entry% and Stop% ***
      // This tests all combinations from 0.25% to 3.0% (step 0.1%) to find the best parameters
      let optimalResult = { 
        optimalEntryPercent: params.entryPercentage, 
        optimalStopPercent: params.stopPercentage, 
        optimalFinalCapital: lastCurrentCapital 
      };
      
      try {
        console.log(`[PREMIUM OPTIMIZATION] Finding optimal parameters for ${stock.code}...`);
        optimalResult = findOptimalParameters(stockData, params);
        console.log(`[PREMIUM OPTIMIZATION] ${stock.code}: Best Entry=${optimalResult.optimalEntryPercent}%, Best Stop=${optimalResult.optimalStopPercent}%, Optimized Capital=$${optimalResult.optimalFinalCapital.toFixed(2)}`);
      } catch (optError) {
        console.warn(`[PREMIUM OPTIMIZATION] Failed to optimize ${stock.code}:`, optError);
      }
      
      // Fire-and-forget: UPSERT backtest_stats without blocking main flow
      try {
        let wins = 0;
        let losses = 0;
        tradeHistory.forEach(trade => {
          if (trade.trade === 'Buy' || trade.trade === 'Sell') {
            wins++;
          } else if (trade.trade === 'Stop') {
            losses++;
          }
        });
        
        if (wins > 0 || losses > 0) {
          // Non-blocking: don't await this RPC call
          (supabase.rpc as any)('upsert_backtest_stats', {
            p_asset_code: stock.code,
            p_operation: params.operation,
            p_reference_price: params.referencePrice,
            p_entry_percent: params.entryPercentage,
            p_stop_percent: params.stopPercentage,
            p_asset_class: params.assetClass,
            p_exchange: params.stockMarket,
            p_wins: wins,
            p_losses: losses
          }).then(({ error }: any) => {
            if (error) console.error(`Error upserting backtest stats for ${stock.code}:`, error);
          }).catch((err: any) => console.error(`Failed backtest stats for ${stock.code}:`, err));
        }
      } catch (backtestError) {
        console.error(`Failed to save backtest stats for ${stock.code}:`, backtestError);
      }
      
      return {
        assetCode: stock.code,
        assetName: stock.code,
        lastCurrentCapital: lastCurrentCapital,
        ...metrics,
        // Garantir que finalCapital e profit estão corretos (override após spread)
        finalCapital: lastCurrentCapital,
        profit: correctProfit,
        // Include optimal parameters from Premium optimization
        optimalEntryPercent: optimalResult.optimalEntryPercent,
        optimalStopPercent: optimalResult.optimalStopPercent,
        optimalFinalCapital: optimalResult.optimalFinalCapital
      };
    } catch (error) {
      console.error(`[DEBUG ERROR] Error in optimized processing for stock ${stock.code}:`, error);
      return null;
    }
  },

  async getStockDataOptimized(
    tableName: string, 
    stockCode: string, 
    period: string | undefined = undefined
  ): Promise<any[]> {
    try {
      if (!tableName || !stockCode) {
        throw new Error('Table name and stock code are required');
      }
      
      console.log(`[DEBUG] Getting stock data for ${stockCode} from ${tableName} with period ${period || 'no period (300 limit)'}`);
      
      // Get date range based on period
      if (period) {
        const dateRange = getDateRangeForPeriod(period);
        console.info(`[DEBUG] Date range: ${dateRange.startDate} to ${dateRange.endDate}`);
        
        // Use the period-filtered method
        const result = await this.getStockDataDirectWithPeriod(tableName, stockCode, dateRange.startDate, dateRange.endDate);
        console.log(`[DEBUG] Period-filtered query returned ${result.length} records`);
        return result;
      } else {
        // If no period, use the limit-based method
        const result = await this.getStockDataDirect(tableName, stockCode, 300);
        console.log(`[DEBUG] Limit-based query returned ${result.length} records`);
        return result;
      }
    } catch (error) {
      console.error(`[DEBUG ERROR] Failed to get optimized stock data for ${stockCode}:`, error);
      return [];
    }
  },

  /**
   * Fallback method to get stock data directly from the table (limit based)
   */
  async getStockDataDirect(tableName: string, stockCode: string, limit: number = 300): Promise<any[]> {
    try {
      console.log(`Trying direct optimized query to get stock data for ${stockCode} from ${tableName} with limit ${limit}`);
      
      const { data, error } = await fromDynamic(tableName)
        .select('*')
        .eq('stock_code', stockCode)
        .order('date', { ascending: false }) // Get latest data first
        .limit(limit);

      if (error) {
        console.error('Error in direct optimized stock data query (limit):', error);
        throw error;
      }

      if (!data || !Array.isArray(data)) {
        console.warn(`No data found for ${stockCode} in table ${tableName}`);
        return [];
      }
      // Reverse the data to have it in ascending order for processing
      return (data as any[]).reverse(); 
    } catch (error) {
      console.error(`Failed in direct optimized stock data query (limit) for ${stockCode}:`, error);
      return [];
    }
  },
  
  /**
   * Get stock data with period filtering
   */
  async getStockDataDirectWithPeriod(
    tableName: string, 
    stockCode: string, 
    startDate: string, 
    endDate: string
  ): Promise<any[]> {
    try {
      console.info(`Fetching optimized stock data for ${stockCode} from ${tableName} between ${startDate} and ${endDate}`);
      
      const { data, error } = await fromDynamic(tableName)
        .select('*')
        .eq('stock_code', stockCode)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true }); // Ascending order for chronological processing
      
      if (error) {
        console.error('Error in period-filtered optimized stock data query:', error);
        throw error;
      }
      
      if (!data || !Array.isArray(data)) {
        console.warn(`No data found for ${stockCode} in table ${tableName} for the specified period`);
        return [];
      }
      
      console.info(`Found ${data.length} records for ${stockCode} in the specified period`);
      return data as any[];

    } catch (error) {
      console.error(`Failed to fetch period-filtered optimized data for ${stockCode}:`, error);
      return [];
    }
  },

  async getAvailableStocksOptimized(tableName: string): Promise<StockInfo[]> {
    try {
      console.log(`[DEBUG PREMIUM] Getting available stocks from table: ${tableName} (filtered by assets_control)`);
      
      // First, get the allowed stock codes from assets_control (active AND visible only)
      const { data: assetsControlData, error: assetsControlError } = await supabase
        .from('assets_control')
        .select('stock_code')
        .eq('table_source', tableName)
        .eq('is_active', true)
        .eq('is_visible', true);
      
      if (assetsControlError) {
        console.error('[DEBUG PREMIUM] Error fetching assets_control:', assetsControlError);
        // Fallback to unfiltered if assets_control fails
        return await this.getAvailableStocksFallback(tableName);
      }
      
      // If no assets are configured in assets_control for this table, 
      // return all stocks from the table (backwards compatibility)
      if (!assetsControlData || assetsControlData.length === 0) {
        console.log(`[DEBUG PREMIUM] No assets_control entries for ${tableName}, returning all stocks`);
        return await this.getAvailableStocksFallback(tableName);
      }
      
      console.info(`[DEBUG PREMIUM] Found ${assetsControlData.length} active/visible assets in assets_control for ${tableName}`);
      
      // Transform the data into StockInfo objects
      const stocks: StockInfo[] = assetsControlData.map(item => ({
        code: item.stock_code,
      }));
      
      return stocks;
    } catch (error) {
      console.error('[DEBUG PREMIUM] Failed to get optimized available stocks:', error);
      return await this.getAvailableStocksFallback(tableName);
    }
  },

  async getAvailableStocksFallback(tableName: string): Promise<StockInfo[]> {
    try {
      const { data, error } = await fromDynamic(tableName)
        .select('stock_code')
        .limit(2000);
      
      if (error) throw error;
      if (!data) return [];
      
      const uniqueCodes = new Set<string>();
      (data as any[])
        .filter(item => item && typeof item === 'object' && 'stock_code' in item && item.stock_code)
        .forEach(item => uniqueCodes.add(String(item.stock_code)));
      
      return Array.from(uniqueCodes).map(code => ({
        code: code,
      }));
    } catch (error) {
      console.error(`Failed in fallback stock query for ${tableName}:`, error);
      return [];
    }
  },

  async generateTradeHistoryOptimized(stockData: any[], params: StockAnalysisParams): Promise<TradeHistoryItem[]> {
    // Convert StockAnalysisParams to StrategyParams for the strategy service
    const strategyParams: StrategyParams = {
      ...params,
      strategy: params.strategy || 'entry-percentage',
      // Include strategy-specific params
      breakoutBuffer: params.breakoutBuffer,
      minGapPercent: params.minGapPercent,
      gapMode: params.gapMode,
      oversoldThreshold: params.oversoldThreshold,
      lookbackDays: params.lookbackDays,
      compressionRatio: params.compressionRatio,
      volumeMultiplier: params.volumeMultiplier,
      volumeLookback: params.volumeLookback,
      priceMoveThreshold: params.priceMoveThreshold,
      volumeDropRatio: params.volumeDropRatio,
    };

    console.info(`[premiumAnalysisService.generateTradeHistoryOptimized] Using strategy: ${strategyParams.strategy} for ${stockData.length} days of data`);
    
    // Use the strategy-specific trade history generator
    const tradeHistory = generateTradeHistoryForStrategy(stockData, strategyParams);
    
    console.info(`[premiumAnalysisService] Generated ${tradeHistory.length} trade history entries using ${strategyParams.strategy} strategy`);
    return tradeHistory;
  },

  calculateMetricsOptimized(stockData: any[], tradeHistory: TradeHistoryItem[], initialCapital: number) {
    const capitalEvolution: { date: string; capital: number }[] = [];
    capitalEvolution.push({ date: tradeHistory[0]?.date || new Date().toISOString().split('T')[0], capital: initialCapital });

    for (const trade of tradeHistory) {
      if (trade.profitLoss !== 0) {
        capitalEvolution.push({
          date: trade.date,
          capital: trade.currentCapital ?? initialCapital
        });
      }
    }

    const lastTrade = tradeHistory[tradeHistory.length - 1];
    if (lastTrade && capitalEvolution[capitalEvolution.length - 1]?.date !== lastTrade.date) {
      capitalEvolution.push({ date: lastTrade.date, capital: lastTrade.currentCapital ?? initialCapital });
    }

    const uniqueCapitalEvolution = Array.from(new Map(capitalEvolution.map(item => [item.date, item])).values());

    const tradingDays = new Set(stockData.map(item => item.date)).size;
    const executedTrades = tradeHistory.filter(trade => trade.trade === 'Buy' || trade.trade === 'Sell');
    const trades = executedTrades.length;
    
    let profits = 0;
    let losses = 0;
    let stops = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    for (const trade of executedTrades) {
      if (trade.profitLoss > 0) {
        profits++;
        totalProfit += trade.profitLoss;
      } else if (trade.profitLoss < 0) {
        if (trade.stopTrigger === 'Executed') {
          stops++;
        } else {
          losses++;
        }
        totalLoss += trade.profitLoss;
      }
    }
    
    const tradePercentage = tradingDays > 0 ? (trades / tradingDays) * 100 : 0;
    const profitRate = trades > 0 ? (profits / trades) * 100 : 0;
    const lossRate = trades > 0 ? (losses / trades) * 100 : 0;
    const stopRate = trades > 0 ? (stops / trades) * 100 : 0;
    
    const sortedTradeHistory = [...tradeHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const lastTradeItem = sortedTradeHistory[sortedTradeHistory.length - 1];
    const finalCapital = lastTradeItem.currentCapital || initialCapital;
      
    const profit = finalCapital - initialCapital;
    const overallProfitPercentage = initialCapital > 0 ? (profit / initialCapital) * 100 : 0;
    
    const averageGain = profits > 0 ? totalProfit / profits : 0;
    const averageLoss = (losses + stops) > 0 ? Math.abs(totalLoss) / (losses + stops) : 0;
    
    let maxDrawdown = 0;
    let peak = initialCapital;
    
    for (const point of uniqueCapitalEvolution) {
      const currentCapitalPoint = Number(point.capital);
      if (isNaN(currentCapitalPoint)) continue;

      if (currentCapitalPoint > peak) {
        peak = currentCapitalPoint;
      }
      
      const drawdown = peak > 0 ? (peak - currentCapitalPoint) / peak : 0;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    maxDrawdown = maxDrawdown * 100;
    
    // Calculate daily returns from capital evolution
    const dailyReturns: number[] = [];
    for (let i = 1; i < uniqueCapitalEvolution.length; i++) {
      const prevCapital = uniqueCapitalEvolution[i - 1].capital;
      const currentCapital = uniqueCapitalEvolution[i].capital;
      if (prevCapital > 0) {
        const dailyReturn = (currentCapital - prevCapital) / prevCapital;
        dailyReturns.push(dailyReturn);
      }
    }
    
    // Calculate Sharpe Ratio and Sortino Ratio
    let sharpeRatio = 0;
    let sortinoRatio = 0;
    
    if (dailyReturns.length > 1) {
      const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      const riskFreeRate = 0.02 / 252; // 2% annual risk-free rate divided by 252 trading days
      
      // Sharpe Ratio: (avg return - risk free) / standard deviation of all returns
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        sharpeRatio = (avgReturn - riskFreeRate) / stdDev * Math.sqrt(252); // Annualized
      }
      
      // Sortino Ratio: (avg return - risk free) / downside deviation (only negative returns)
      const negativeReturns = dailyReturns.filter(r => r < 0);
      if (negativeReturns.length > 0) {
        const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
        const downsideDev = Math.sqrt(downsideVariance);
        
        if (downsideDev > 0) {
          sortinoRatio = (avgReturn - riskFreeRate) / downsideDev * Math.sqrt(252); // Annualized
        }
      }
    }
    
    const recoveryFactor = maxDrawdown > 0 ? Math.abs(profit / (maxDrawdown / 100 * initialCapital)) : 0;
    const successRate = trades > 0 ? (profits / trades) * 100 : 0;
    
    const metrics = {
      tradingDays,
      trades,
      tradePercentage,
      profits,
      profitPercentage: profitRate,
      losses,
      lossPercentage: lossRate,
      stops,
      stopPercentage: stopRate,
      // finalCapital removido - será definido no método principal
      profit,
      averageGain,
      averageLoss,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio,
      recoveryFactor,
      successRate
    };

    return {
      capitalEvolution: uniqueCapitalEvolution,
      metrics
    };
  },

  async getDataTableName(country: string, stockMarket: string, assetClass: string): Promise<string | null> {
    try {
      const { data, error } = await fromDynamic('market_data_sources')
        .select('stock_table')
        .eq('country', country)
        .eq('stock_market', stockMarket)
        .eq('asset_class', assetClass)
        .maybeSingle();

      if (error) {
        console.error('Error fetching data table name:', error);
        return null;
      }

      return data ? (data as any).stock_table : null;
    } catch (error) {
      console.error('Failed to fetch data table name:', error);
      return null;
    }
  }
};
