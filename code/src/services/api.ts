// This is a service layer to interact with Supabase and process data

import { supabase, fromDynamic, MarketDataSource, StockRecord } from '@/integrations/supabase/client';
import { AnalysisResult, Asset, DetailedResult, StockAnalysisParams, StockInfo, User, TradeHistoryItem } from '@/types';
import { formatDateToYYYYMMDD, getDateRangeForPeriod } from '@/utils/dateUtils';
import { logger } from '@/utils/logger';
import { isValidEmail, sanitizeSqlInput, isValidStockCode } from '@/utils/security';
import { generateTradeHistoryForStrategy, StrategyParams, StrategyType } from '@/services/strategyService';

/**
 * Authentication API service
 */
export const auth = {
  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<any> {
    try {
      // Validate inputs
      if (!isValidEmail(email)) {
        throw new Error("Invalid email format");
      }
      
      logger.log(`Attempting to login with email: ${email}`);

      // Autentica com Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error("Login error:", error);
        // Verifica se o erro é por email não confirmado
        if (error.message.includes("Email not confirmed")) {
          throw new Error("PENDING_CONFIRMATION"); // Lança erro específico para tratamento no AuthContext
        }
        throw error; // Lança outros erros de autenticação
      }

      logger.log("Supabase Auth Login successful:", data);
      
      // Retorna no formato esperado pelo AuthContext
      return {
        data: {
          user: data.user,
          session: data.session
        }
      };
    } catch (error) {
      logger.error("Login failed:", error);
      throw error;
    }
  },

  /**
   * Register a new user
   */
  async register(email: string, password: string, fullName: string): Promise<any> {
    try {
      logger.log(`Registering new user: ${email}`);
      
      // Register user with Supabase Auth
      // The trigger handle_new_auth_user will automatically create the user in public.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?confirmation=true`,
          data: {
            full_name: fullName,
          }
        }
      });

      if (authError) {
        logger.error("Registration auth error:", authError);
        throw authError;
      }

      logger.log("User registered successfully, confirmation email sent:", authData.user?.email);

      // The trigger will handle user creation in public.users table
      // No need to insert manually - it will cause conflicts
      
      // Create Stripe customer asynchronously (don't block registration)
      if (authData.user) {
        setTimeout(() => {
          supabase.functions.invoke('create-stripe-customer', {
            body: {
              email: email,
              name: fullName,
              userId: authData.user!.id
            }
          }).catch(error => {
            logger.error("Failed to create Stripe customer:", error);
          });
        }, 1000);
      }

      return {
        user: authData.user,
        session: authData.session,
        success: true
      };
    } catch (error) {
      logger.error("Registration failed:", error);
      throw error;
    }
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      console.log(`Sending password reset email to: ${email}`);
      
      // Use Supabase native password reset
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("Password reset error:", error);
        throw error;
      }

      console.log("Password reset email sent successfully");
    } catch (error) {
      console.error("Password reset failed:", error);
      throw error;
    }
  },

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<void> {
    try {
      console.log("Updating user password");
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Password update error:", error);
        throw error;
      }

      console.log("Password updated successfully");
    } catch (error) {
      console.error("Password update failed:", error);
      throw error;
    }
  },

  /**
   * Resend confirmation email
   */
  async resendConfirmationEmail(email: string): Promise<void> {
    try {
      console.log(`Resending confirmation email to: ${email}`);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/login?confirmation=true`,
        }
      });

      if (error) {
        console.error("Resend confirmation email error:", error);
        throw error;
      }

      console.log("Confirmation email resent successfully");
    } catch (error) {
      console.error("Resend confirmation email failed:", error);
      throw error;
    }
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      console.log("Attempting to logout");
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout error:", error);
        throw error;
      }

      console.log("Logout successful");
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  },

  /**
   * Get current user data from public.users table
   */
  async getUserData(userId: string): Promise<User | null> {
    try {
      console.log(`Getting user data for ID: ${userId}`);
      
      // Get user data directly from the users table using the user ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Get user data error:", error);
        throw error;
      }

      console.log("User data retrieved:", data);
      
      // Convert the result to the type User
      if (data) {
        return {
          id: data.id,
          email: data.email,
          full_name: data.name,
          level_id: data.level_id,
          status: data.status_users as any,
          email_verified: data.email_verified,
          account_type: 'free', // Valor padrão
          created_at: data.created_at,
          last_login: null
        } as User;
      }
      
      return null;
    } catch (error) {
      console.error("Get user data failed:", error);
      return null;
    }
  },

  /**
   * Update user status to active after email confirmation
   */
  async confirmUserEmail(userId: string): Promise<void> {
    try {
      console.log(`Confirming email for user ID: ${userId}`);
      const { error } = await supabase
        .from('users')
        .update({ status_users: 'active' })
        .eq('id', userId);

      if (error) {
        console.error("Email confirmation error:", error);
        throw error;
      }

      console.log("Email confirmed successfully");
    } catch (error) {
      console.error("Email confirmation failed:", error);
      throw error;
    }
  }
};

/**
 * Market Data API service for fetching market data
 */
const marketData = {
  /**
   * Get available countries with market data
   */
  async getCountries(): Promise<string[]> {
    try {
      const { data, error } = await fromDynamic('market_data_sources')
        .select('country')
        .order('country');

      if (error) throw error;

      // Check if data exists before accessing properties
      if (!data || !Array.isArray(data)) return [];

      // Extract unique country names using a safer approach with type assertion
      const countries = [...new Set(data.map(item => (item as any).country).filter(Boolean))];
      return countries;
    } catch (error) {
      console.error('Failed to fetch countries:', error);
      return [];
    }
  },

  /**
   * Get available stock markets for a given country
   */
  async getStockMarkets(country: string): Promise<string[]> {
    try {
      // Use fromDynamic to query the market_data_sources table
      const { data, error } = await fromDynamic('market_data_sources')
        .select('stock_market')
        .eq('country', country)
        .order('stock_market');

      if (error) throw error;

      // Check if data exists before accessing properties
      if (!data || !Array.isArray(data)) return [];

      // Extract unique stock markets using a safer approach with type assertion
      const markets = [...new Set(data.map(item => (item as any).stock_market).filter(Boolean))];
      return markets;
    } catch (error) {
      console.error('Failed to fetch stock markets:', error);
      return [];
    }
  },

  /**
   * Get available asset classes for a given country and stock market
   */
  async getAssetClasses(country: string, stockMarket: string): Promise<string[]> {
    try {
      // Use fromDynamic to query the market_data_sources table
      const { data, error } = await fromDynamic('market_data_sources')
        .select('asset_class')
        .eq('country', country)
        .eq('stock_market', stockMarket)
        .order('asset_class');

      if (error) throw error;

      // Check if data exists before accessing properties
      if (!data || !Array.isArray(data)) return [];

      // Extract unique asset classes using a safer approach with type assertion
      const classes = [...new Set(data.map(item => (item as any).asset_class).filter(Boolean))];
      return classes;
    } catch (error) {
      console.error('Failed to fetch asset classes:', error);
      return [];
    }
  },

  /**
   * Get the data table name for a specific market data source
   */
  async getDataTableName(
    country: string,
    stockMarket: string,
    assetClass: string
  ): Promise<string | null> {
    try {
      // Use fromDynamic to query the market_data_sources table
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

      // Return the table name using safer access with type assertion
      return data ? (data as any).stock_table : null;
    } catch (error) {
      console.error('Failed to fetch data table name:', error);
      return null;
    }
  },
  
  /**
   * Check if the given table exists in the database
   */
  async checkTableExists(tableName: string): Promise<boolean> {
    try {
      if (!tableName) return false;
      
      // Try to query the table with limit 1 to check if it exists
      const { error } = await fromDynamic(tableName)
        .select('*')
        .limit(1);
      
      // If there's no error, the table exists
      return !error;
    } catch (error) {
      console.error('Error checking table existence:', error);
      return false;
    }
  },
  
  /**
   * Get market status by ID
   */
  async getMarketStatus(marketId: string): Promise<any> {
    try {
      const { data, error } = await fromDynamic('market_status')
        .select('*')
        .eq('id', marketId)
        .single();
        
      if (error) {
        console.error('Error fetching market status:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to fetch market status:', error);
      return null;
    }
  },
  
  /**
   * Get all market data sources
   */
  async getAllMarketDataSources(): Promise<MarketDataSource[]> {
    try {
      const { data, error } = await fromDynamic('market_data_sources')
        .select('*')
        .order('country');
        
      if (error) {
        console.error('Error fetching market data sources:', error);
        return [];
      }

      return (data || []) as any as MarketDataSource[];
    } catch (error) {
      console.error('Failed to fetch market data sources:', error);
      return [];
    }
  },
  
  /**
   * Get market data sources by country
   */
  async getMarketDataSourcesByCountry(country: string): Promise<MarketDataSource[]> {
    try {
      const { data, error } = await fromDynamic('market_data_sources')
        .select('*')
        .eq('country', country)
        .order('stock_market');
        
      if (error) {
        console.error(`Error fetching market data sources for country ${country}:`, error);
        return [];
      }
      
      return (data || []) as any as MarketDataSource[];
    } catch (error) {
      console.error(`Failed to fetch market data sources for country ${country}:`, error);
      return [];
    }
  },
  
  /**
   * Get market data sources by country and stock market
   */
  async getMarketDataSourcesByCountryAndStockMarket(
    country: string, 
    stockMarket: string
  ): Promise<MarketDataSource[]> {
    try {
      const { data, error } = await fromDynamic('market_data_sources')
        .select('*')
        .eq('country', country)
        .eq('stock_market', stockMarket)
        .order('asset_class');
        
      if (error) {
        console.error(`Error fetching market data sources for country ${country} and stock market ${stockMarket}:`, error);
        return [];
      }
      
      return (data || []) as any as MarketDataSource[];
    } catch (error) {
      console.error(`Failed to fetch market data sources for country ${country} and stock market ${stockMarket}:`, error);
      return [];
    }
  }
};

/**
 * Stock Analysis API service
 */
const analysisService = {
  /**
   * Get a list of available stocks for a specific data table
   * Only returns stocks that are active AND visible in assets_control
   */
  async getAvailableStocks(tableName: string): Promise<StockInfo[]> {
    try {
      if (!tableName) {
        throw new Error('Table name is required');
      }
      
      console.log(`Getting available stocks from table: ${tableName} (filtered by assets_control)`);
      
      // First, get the allowed stock codes from assets_control
      const { data: assetsControlData, error: assetsControlError } = await supabase
        .from('assets_control')
        .select('stock_code')
        .eq('table_source', tableName)
        .eq('is_active', true)
        .eq('is_visible', true);
      
      if (assetsControlError) {
        console.error('Error fetching assets_control:', assetsControlError);
        // Fallback to unfiltered if assets_control fails
        return await this.getAvailableStocksUnfiltered(tableName);
      }
      
      // If no assets are configured in assets_control for this table, 
      // return all stocks from the table (backwards compatibility)
      if (!assetsControlData || assetsControlData.length === 0) {
        console.log(`No assets_control entries for ${tableName}, returning all stocks`);
        return await this.getAvailableStocksUnfiltered(tableName);
      }
      
      // Create a set of allowed stock codes for quick lookup
      const allowedStockCodes = new Set(assetsControlData.map(item => item.stock_code));
      console.log(`Found ${allowedStockCodes.size} active/visible assets in assets_control for ${tableName}`);
      
      // Transform the data into StockInfo objects
      const stocks: StockInfo[] = Array.from(allowedStockCodes).map(stockCode => ({
        code: stockCode,
        name: stockCode,
      }));
      
      return stocks;
    } catch (error) {
      console.error('Failed to get available stocks:', error);
      return await this.getAvailableStocksUnfiltered(tableName);
    }
  },
  
  /**
   * Get all stocks from a table without filtering by assets_control
   * Used as fallback when assets_control is not available
   */
  async getAvailableStocksUnfiltered(tableName: string): Promise<StockInfo[]> {
    try {
      console.log(`Getting unfiltered stocks from table: ${tableName}`);
      
      // Use database function to get unique stock codes
      const { data, error } = await supabase.rpc('get_unique_stock_codes', {
        p_table_name: tableName
      });

      if (error) {
        console.error('Error getting unique stock codes:', error);
        return await this.getAvailableStocksDirect(tableName);
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn('No stock codes returned from function, trying direct query');
        return await this.getAvailableStocksDirect(tableName);
      }
      
      console.log(`Found ${data.length} unique stock codes (unfiltered)`);
      
      const stocks: StockInfo[] = data.map(item => {
        const stockCode = typeof item === 'string' ? item : String(item);
        return {
          code: stockCode,
          name: stockCode,
        };
      });
      
      return stocks;
    } catch (error) {
      console.error('Failed to get unfiltered stocks:', error);
      return await this.getAvailableStocksDirect(tableName);
    }
  },
  
  /**
   * Fallback method to get stocks directly from the table
   */
  async getAvailableStocksDirect(tableName: string): Promise<StockInfo[]> {
    try {
      console.log(`Trying direct query to get stock codes from ${tableName}`);
      
      const { data, error } = await fromDynamic(tableName)
        .select('stock_code')
        .limit(1000);
      
      if (error) {
        console.error('Error in direct stock code query:', error);
        throw error;
      }

      if (!data) {
        console.warn(`No stock codes found in table ${tableName}`);
        return [];
      }
      
      const uniqueCodes = new Set<string>();
      (data as any[])
        .filter(item => item && typeof item === 'object' && 'stock_code' in item && item.stock_code)
        .forEach(item => uniqueCodes.add(String(item.stock_code)));
      
      const stocks: StockInfo[] = Array.from(uniqueCodes).map(code => ({
        code: code,
        name: code
      }));
      
      console.log(`Direct query found ${stocks.length} stock codes`);
      return stocks;
    } catch (error) {
      console.error(`Failed in direct stock query for ${tableName}:`, error);
      return [];
    }
  },
  
  /**
   * Get stock data from a specific table and stock code
   */
  async getStockData(tableName: string, stockCode: string, period: string | undefined = undefined, limit: number = 300): Promise<any[]> {
    try {
      if (!tableName || !stockCode) {
        throw new Error('Table name and stock code are required');
      }
      
      // Get date range based on period
      if (period) {
        const dateRange = getDateRangeForPeriod(period);
        console.info(`Getting stock data for ${stockCode} from ${tableName} with period ${period}`);
        console.info(`Date range: ${dateRange.startDate} to ${dateRange.endDate}`);
        
        // Use the period-filtered method
        return await this.getStockDataDirectWithPeriod(tableName, stockCode, dateRange.startDate, dateRange.endDate);
      } else {
        console.info(`Getting stock data for ${stockCode} from ${tableName} without period filtering (using limit: ${limit})`);
        // If no period, use the limit-based method
        return await this.getStockDataDirect(tableName, stockCode, limit);
      }
    } catch (error) {
      console.error('Failed to get stock data:', error);
      return [];
    }
  },
  
  /**
   * Fallback method to get stock data directly from the table (limit based)
   */
  async getStockDataDirect(tableName: string, stockCode: string, limit: number = 300): Promise<any[]> {
    try {
      console.log(`Trying direct query to get stock data for ${stockCode} from ${tableName} with limit ${limit}`);
      
      const { data, error } = await fromDynamic(tableName)
        .select('*')
        .eq('stock_code', stockCode)
        .order('date', { ascending: false }) // Get latest data first
        .limit(limit);

      if (error) {
        console.error('Error in direct stock data query (limit):', error);
        throw error;
      }

      if (!data || !Array.isArray(data)) {
        console.warn(`No data found for ${stockCode} in table ${tableName}`);
        return [];
      }
      // Reverse the data to have it in ascending order for processing
      return (data as any[]).reverse(); 
    } catch (error) {
      console.error(`Failed in direct stock data query (limit) for ${stockCode}:`, error);
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
      console.info(`Fetching stock data for ${stockCode} from ${tableName} between ${startDate} and ${endDate}`);
      
      const { data, error } = await fromDynamic(tableName)
        .select('*')
        .eq('stock_code', stockCode)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true }); // Ascending order for chronological processing
      
      if (error) {
        console.error('Error in period-filtered stock data query:', error);
        throw error;
      }
      
      if (!data || !Array.isArray(data)) {
        console.warn(`No data found for ${stockCode} in table ${tableName} for the specified period`);
        return [];
      }
      
      console.info(`Found ${data.length} records for ${stockCode} in the specified period`);
      return data as any[];

    } catch (error) {
      console.error(`Failed to fetch period-filtered data for ${stockCode}:`, error);
      return [];
    }
  },

  // --- Start: Functions copied from api-18.ts ---

  /**
   * Run stock analysis with given parameters
   */
  async runAnalysis(
    params: StockAnalysisParams,
    progressCallback?: (progress: number) => void
  ): Promise<AnalysisResult[]> {
    try {
      console.info('Running analysis with parameters:', params);
      console.info(`DEBUG: ComparisonStocks received:`, params.comparisonStocks);
      
      // Set up progress tracking
      let progress = 0;
      const updateProgress = (increment: number) => {
        progress += increment;
        if (progressCallback) {
          progressCallback(Math.min(progress, 100));
        }
      };

      if (!params.dataTableName) {
        const tableName = await marketData.getDataTableName(
          params.country,
          params.stockMarket,
          params.assetClass
        );
        if (!tableName) {
          throw new Error('Could not determine data table name');
        }
        params.dataTableName = tableName;
      }

      console.info(`DEBUG: Using data table: ${params.dataTableName}`);

      // Get all available stocks for the given asset class
      updateProgress(10);
      const stocks = await this.getAvailableStocks(params.dataTableName);
      
      console.info(`DEBUG: Found ${stocks.length} stocks for analysis`);
      console.info(`DEBUG: First 10 stocks:`, stocks.slice(0, 10).map(s => s.code));
      
      if (!stocks || stocks.length === 0) {
        console.warn('No stocks found for the selected criteria');
        return []; 
      }
      
      updateProgress(10);
      
      // Process each stock based on the selection criteria
      const results: AnalysisResult[] = [];
      
      const stocksToProcess = params.comparisonStocks && params.comparisonStocks.length > 0
        ? stocks.filter(s => params.comparisonStocks!.includes(s.code))
        : stocks;
        
      console.info(`DEBUG: Processing ${stocksToProcess.length} stocks (filtered from ${stocks.length})`);
      console.info(`DEBUG: Stocks to process:`, stocksToProcess.map(s => s.code));
      
      // Process in batches for better parallelism
      const FREE_BATCH_SIZE = 10;
      
      for (let i = 0; i < stocksToProcess.length; i += FREE_BATCH_SIZE) {
        const batch = stocksToProcess.slice(i, i + FREE_BATCH_SIZE);
        
        const batchPromises = batch.map(async (stock) => {
          try {
            const stockData = await this.getStockData(
              params.dataTableName!, 
              stock.code,
              params.period
            );
            
            if (!stockData || stockData.length === 0) {
              return {
                assetCode: stock.code,
                assetName: stock.name || stock.code,
                tradingDays: 0, trades: 0, tradePercentage: 0,
                profits: 0, profitPercentage: 0, losses: 0, lossPercentage: 0,
                stops: 0, stopPercentage: 0,
                finalBalance: params.initialCapital, finalCapital: params.initialCapital,
                totalTrades: 0, profitableTrades: 0, winRate: 0,
                maxDrawdown: 0, averageReturn: 0, profit: 0,
                lastCurrentCapital: params.initialCapital
              } as AnalysisResult;
            }
            
            const tradeHistory = await this.generateTradeHistory(stockData, params);
            
            if (!tradeHistory || tradeHistory.length === 0) {
              return {
                assetCode: stock.code,
                assetName: stock.name || stock.code,
                tradingDays: stockData.length, trades: 0, tradePercentage: 0,
                profits: 0, profitPercentage: 0, losses: 0, lossPercentage: 0,
                stops: 0, stopPercentage: 0,
                finalBalance: params.initialCapital, finalCapital: params.initialCapital,
                totalTrades: 0, profitableTrades: 0, winRate: 0,
                maxDrawdown: 0, averageReturn: 0, profit: 0,
                lastCurrentCapital: params.initialCapital
              } as AnalysisResult;
            }
            
            const capitalEvolution = this.calculateCapitalEvolution(tradeHistory, params.initialCapital);
            const metrics = this.calculateDetailedMetrics(stockData, tradeHistory, capitalEvolution, params, stock.code);
            
            let lastCurrentCapital = params.initialCapital;
            if (tradeHistory.length > 0) {
              const sortedTradeHistory = [...tradeHistory].sort((a, b) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              lastCurrentCapital = sortedTradeHistory[sortedTradeHistory.length - 1].currentCapital || params.initialCapital;
            }
            
            const correctProfit = lastCurrentCapital - params.initialCapital;
            
            // Fire-and-forget backtest stats upsert
            try {
              let wins = 0;
              let losses = 0;
              tradeHistory.forEach(trade => {
                if (trade.trade === 'Buy' || trade.trade === 'Sell') wins++;
                else if (trade.trade === 'Stop') losses++;
              });
              
              if (wins > 0 || losses > 0) {
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
              assetName: stock.name || stock.code,
              tradingDays: metrics.tradingDays,
              trades: metrics.trades,
              tradePercentage: metrics.tradePercentage,
              profits: metrics.profits,
              profitPercentage: metrics.profitPercentage,
              losses: metrics.losses,
              lossPercentage: metrics.lossPercentage,
              stops: metrics.stops,
              stopPercentage: metrics.stopPercentage,
              finalBalance: lastCurrentCapital,
              finalCapital: lastCurrentCapital,
              totalTrades: metrics.trades,
              profitableTrades: metrics.profits,
              winRate: metrics.successRate || 0,
              maxDrawdown: metrics.maxDrawdown,
              averageReturn: 0,
              profit: correctProfit,
              lastCurrentCapital: lastCurrentCapital
            } as AnalysisResult;
          } catch (e) {
            console.error(`Error analyzing stock ${stock.code}:`, e);
            return null;
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          }
        });
        
        const progressIncrement = (70 / Math.ceil(stocksToProcess.length / FREE_BATCH_SIZE));
        updateProgress(progressIncrement);
      }
      
      // Sort results by profit percentage (descending)
      results.sort((a, b) => b.profitPercentage - a.profitPercentage);
      
      // Calculate probability for all results in parallel batches
      const PROB_BATCH_SIZE = 15;
      for (let i = 0; i < results.length; i += PROB_BATCH_SIZE) {
        const batch = results.slice(i, i + PROB_BATCH_SIZE);
        
        await Promise.all(batch.map(async (result) => {
          try {
            const { data: probData, error: probError } = await supabase
              .rpc('calculate_today_probability', {
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
              
              if (probData[0].probability_raw && result.trades > 0) {
                const p = probData[0].probability_raw / 100;
                const n = result.trades;
                const standardError = Math.sqrt((p * (1 - p)) / n);
                const confidenceScore = Math.max(0, Math.min(100, (1 - standardError * 2) * 100));
                result.confidence95 = confidenceScore.toFixed(1);
              } else {
                result.confidence95 = probData[0].confidence_95;
              }
            }
          } catch (e) {
            console.error(`Failed to calculate probability for ${result.assetCode}:`, e);
          }
        }));
      }
      
      updateProgress(10); // Final progress update
      return results;
    } catch (error) {
      console.error('Failed to run analysis:', error);
      throw error;
    }
  },
  
  /**
   * Generate trade history for a stock using strategy-specific logic
   * FIXED: Now uses the strategy-specific generator from strategyService
   */
  async generateTradeHistory(stockData: any[], params: StockAnalysisParams): Promise<TradeHistoryItem[]> {
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

    console.info(`[api.generateTradeHistory] Using strategy: ${strategyParams.strategy} for ${stockData.length} days of data`);
    
    // Use the strategy-specific trade history generator
    const tradeHistory = generateTradeHistoryForStrategy(stockData, strategyParams);
    
    console.info(`[api.generateTradeHistory] Generated ${tradeHistory.length} trade history entries using ${strategyParams.strategy} strategy`);
    return tradeHistory;
  },
  
  /**
   * Calculate capital evolution based on trade history
   */
  calculateCapitalEvolution(tradeHistory: TradeHistoryItem[], initialCapital: number): { date: string; capital: number }[] {
    if (!tradeHistory || tradeHistory.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], capital: initialCapital }];
    }

    const capitalEvolution: { date: string; capital: number }[] = [];
    
    // Add initial capital point if the first trade isn't the very first day possible
    // This might need adjustment based on how the date range is handled
    capitalEvolution.push({ date: tradeHistory[0].date, capital: initialCapital }); 

    for (const trade of tradeHistory) {
      // Only add points where capital changes (i.e., a trade happened or stop triggered)
      if (trade.profitLoss !== 0) { 
        capitalEvolution.push({
          date: trade.date,
          // Use currentCapital which reflects the capital AFTER the day's P/L
          capital: trade.currentCapital ?? initialCapital 
        });
      }
    }
    
    // Ensure the last day's capital is included if no trade happened
    const lastTrade = tradeHistory[tradeHistory.length - 1];
    if (capitalEvolution[capitalEvolution.length - 1]?.date !== lastTrade.date) {
         capitalEvolution.push({ date: lastTrade.date, capital: lastTrade.currentCapital ?? initialCapital });
    }

    // Remove duplicates based on date, keeping the last entry for that date
    const uniqueCapitalEvolution = Array.from(new Map(capitalEvolution.map(item => [item.date, item])).values());

    return uniqueCapitalEvolution;
  },
  
  /**
   * Calculate detailed metrics based on trade history
   */
  calculateDetailedMetrics(stockData: any[], tradeHistory: TradeHistoryItem[], capitalEvolution: any[], params: StockAnalysisParams, stockCode?: string) {
    // Count the exact number of unique days in the Stock Details table
    const tradingDays = new Set(stockData.map(item => item.date)).size;
    
    // Filter for days where a trade was initiated (Buy or Sell)
    const executedTrades = tradeHistory.filter(trade => trade.trade === 'Buy' || trade.trade === 'Sell');
    const trades = executedTrades.length;
    
    // Count profits, losses, and stops based on the profitLoss and stopTrigger fields
    const profits = executedTrades.filter(trade => trade.profitLoss > 0).length;
    const losses = executedTrades.filter(trade => trade.profitLoss < 0 && trade.stopTrigger !== 'Executed').length;
    const stops = executedTrades.filter(trade => trade.stopTrigger === 'Executed').length;
    
    // Sum the profit/loss values
    let totalProfit = 0;
    let totalLoss = 0;
    
    // Calculate total profits and losses from executed trades
    for (const trade of executedTrades) {
      if (trade.profitLoss > 0) {
        totalProfit += trade.profitLoss;
      } else if (trade.profitLoss < 0) {
        // Accumulate all negative P/L as total loss
        totalLoss += trade.profitLoss; 
      }
    }
      
    // Calculate percentages with safety checks to avoid division by zero
    const tradePercentage = tradingDays > 0 ? (trades / tradingDays) * 100 : 0;
    const profitRate = trades > 0 ? (profits / trades) * 100 : 0;
    const lossRate = trades > 0 ? (losses / trades) * 100 : 0;
    const stopRate = trades > 0 ? (stops / trades) * 100 : 0;
    
    // REMOVIDO: Final Capital calculation moved to main function to avoid override
    // O Final Capital agora é calculado apenas no método principal usando lastCurrentCapital
    
    // Para calcular profit, vamos usar o valor correto do último Current Capital
    let finalCapitalForProfit = params.initialCapital;
    if (tradeHistory.length > 0) {
      const sortedTradeHistory = [...tradeHistory].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const lastTrade = sortedTradeHistory[sortedTradeHistory.length - 1];
      finalCapitalForProfit = lastTrade.currentCapital || params.initialCapital;
    }
      
    const profit = finalCapitalForProfit - params.initialCapital;
    const overallProfitPercentage = params.initialCapital > 0 ? (profit / params.initialCapital) * 100 : 0;
    
    // Calculate average gain and loss
    const averageGain = profits > 0 
      ? totalProfit / profits 
      : 0;
      
    // Use absolute value for average loss calculation
    const averageLoss = (losses + stops) > 0
      ? Math.abs(executedTrades.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0)) / (losses + stops) 
      : 0;
    
    // Calculate max drawdown from capital evolution
    let maxDrawdown = 0;
    let peak = params.initialCapital;
    
    for (const point of capitalEvolution) {
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
    for (let i = 1; i < capitalEvolution.length; i++) {
      const prevCapital = capitalEvolution[i - 1].capital;
      const currentCapital = capitalEvolution[i].capital;
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
    
    const recoveryFactor = maxDrawdown > 0 ? Math.abs(profit / (maxDrawdown / 100 * params.initialCapital)) : 0;
    
    const successRate = trades > 0 ? (profits / trades) * 100 : 0;
    
    return {
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
  },

  /**
   * Get detailed analysis for a specific stock
   */
  async getDetailedAnalysis(
    stockCode: string,
    params: StockAnalysisParams
  ): Promise<DetailedResult> {
    try {
      console.info(`Getting detailed analysis for ${stockCode} with params:`, params);
      
      if (!params.dataTableName) {
        const tableName = await marketData.getDataTableName(
          params.country, 
          params.stockMarket, 
          params.assetClass
        );
        if (!tableName) {
          throw new Error('Could not determine data table name');
        }
        params.dataTableName = tableName;
      }
      
      // Get the stock data from the database with period filtering
      const stockData = await this.getStockData(
        params.dataTableName, 
        stockCode,
        params.period
      );
      
      if (!stockData || stockData.length === 0) {
        console.warn(`No data found for stock ${stockCode} in table ${params.dataTableName} for the selected period`);
        return {
          assetCode: stockCode,
          tradeHistory: [],
          capitalEvolution: [{ date: new Date().toISOString().split('T')[0], capital: params.initialCapital }],
          tradingDays: 0,
          trades: 0,
          tradePercentage: 0,
          profits: 0,
          profitPercentage: 0,
          losses: 0,
          lossPercentage: 0,
          stops: 0,
          stopPercentage: 0,
          finalCapital: params.initialCapital,
          profit: 0,
          averageGain: 0,
          averageLoss: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          sortinoRatio: 0,
          recoveryFactor: 0,
          successRate: 0,
          initialBalance: params.initialCapital,
          finalBalance: params.initialCapital,
          totalTrades: 0,
          profitableTrades: 0,
          winRate: 0,
          averageReturn: 0
        };
      }
      
      console.info(`Retrieved ${stockData.length} data points for ${stockCode} in the selected period`);
      
      // Generate trade history
      const tradeHistory = await this.generateTradeHistory(stockData, params);
      
      // Calculate capital evolution
      const capitalEvolution = this.calculateCapitalEvolution(tradeHistory, params.initialCapital);
      
      // Calculate metrics
      const metrics = this.calculateDetailedMetrics(stockData, tradeHistory, capitalEvolution, params, stockCode);
      
      // Ensure finalCapital is taken from the last currentCapital in trade history
      let finalCapitalFromLastTrade = params.initialCapital;
      if (tradeHistory.length > 0) {
        const sortedTradeHistory = [...tradeHistory].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const lastTrade = sortedTradeHistory[sortedTradeHistory.length - 1];
        finalCapitalFromLastTrade = lastTrade.currentCapital || params.initialCapital;
      }
      
      console.info(`DEBUG getDetailedAnalysis for ${stockCode}:`, {
        tradeHistoryLength: tradeHistory.length,
        finalCapitalFromLastTrade: finalCapitalFromLastTrade,
        metricsProfit: metrics.profit,
        firstTradeCurrentCapital: tradeHistory[0]?.currentCapital,
        lastTradeCurrentCapital: tradeHistory[tradeHistory.length - 1]?.currentCapital
      });
      
      // Return detailed result - ALWAYS use finalCapitalFromLastTrade
      const detailedResult = {
        assetCode: stockCode,
        tradeHistory,
        capitalEvolution,
        initialBalance: params.initialCapital,
        finalBalance: finalCapitalFromLastTrade,
        totalTrades: metrics.trades,
        profitableTrades: metrics.profits,
        winRate: metrics.successRate,
        averageReturn: 0,
        ...metrics,
        // Override any incorrect finalCapital from metrics
        finalCapital: finalCapitalFromLastTrade,
        profit: finalCapitalFromLastTrade - params.initialCapital
      };
      
      console.info(`DEBUG final detailedResult for ${stockCode}:`, {
        finalCapital: detailedResult.finalCapital,
        finalBalance: detailedResult.finalBalance,
        profit: detailedResult.profit
      });
      
      return detailedResult;
    } catch (error) {
      console.error(`Failed to get detailed analysis for ${stockCode}:`, error);
      throw error; 
    }
  },

  // New optimized method for updating only specific columns
  // FIXED: Now uses strategy-specific logic
  async updateDetailedAnalysisOptimized(
    existingResult: DetailedResult,
    params: StockAnalysisParams
  ): Promise<DetailedResult> {
    try {
      const strategy = params.strategy || 'entry-percentage';
      console.info(`[updateDetailedAnalysisOptimized] Using strategy: ${strategy}`);
      
      // Convert existing trade history back to stock data format for recalculation
      const stockData = existingResult.tradeHistory.map(trade => ({
        date: trade.date,
        open: trade.entryPrice,
        high: trade.high,
        low: trade.low,
        close: trade.exitPrice,
        volume: trade.volume
      }));
      
      // Convert params to StrategyParams
      const strategyParams: StrategyParams = {
        ...params,
        strategy: strategy,
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
      
      // Use the strategy-specific generator to recalculate trade history
      const updatedTradeHistory = generateTradeHistoryForStrategy(stockData, strategyParams);

      // Calculate the correct final capital from the last current capital in trade history
      let finalCapital = params.initialCapital;
      if (updatedTradeHistory.length > 0) {
        const sortedTradeHistory = [...updatedTradeHistory].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        finalCapital = sortedTradeHistory[sortedTradeHistory.length - 1].currentCapital || params.initialCapital;
      }

      console.info(`[updateDetailedAnalysisOptimized] Final capital: ${finalCapital} using ${strategy} strategy`);

      // Return updated result with correct final capital calculation
      return {
        ...existingResult,
        tradeHistory: updatedTradeHistory,
        initialBalance: params.initialCapital,
        finalBalance: finalCapital,
        finalCapital: finalCapital,
        profit: finalCapital - params.initialCapital
      };
    } catch (error) {
      console.error('Error in updateDetailedAnalysisOptimized:', error);
      throw error;
    }
  },

  // Helper method to get reference price
  getReferencePrice(item: TradeHistoryItem, referencePrice: string): number {
    switch (referencePrice.toLowerCase()) {
      case 'open':
        return item.entryPrice;
      case 'high':
        return item.high;
      case 'low':
        return item.low;
      case 'close':
        return item.exitPrice;
      default:
        return item.entryPrice;
    }
  }
};

// Export the API services
export const api = {
  auth,
  marketData,
  analysis: analysisService
};
