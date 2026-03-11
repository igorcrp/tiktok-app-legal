import { useState, useEffect, useRef } from "react";
import { firePurchase } from "@/utils/metaPixel";
import { useSearchParams, useNavigate } from "react-router-dom";
import { StockSetupForm } from "@/components/StockSetupForm";
import { ResultsTable } from "@/components/ResultsTable";
import { StockDetailView } from "@/components/StockDetailView";
import { PremiumUpgrade } from "@/components/PremiumUpgrade";

import { QueryLimitModal } from "@/components/QueryLimitModal";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDailyQueries } from "@/hooks/useDailyQueries";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisibilityPreservation, useScrollPreservation } from "@/hooks/useStatePreservation";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/services/api";
import { premiumAnalysisService } from "@/services/premiumAnalysisService";
import { AnalysisResult, DetailedResult, StockAnalysisParams } from "@/types";
import { toast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countBusinessDays, getStartDateForPeriod } from "@/utils/dateUtils";
import { getStrategy, StrategyType, STRATEGIES } from "@/services/strategyService";
import { ArrowLeft, Info, Loader2, Percent, TrendingUp, ArrowLeftRight, ArrowDownUp, Minimize2, BarChart3, GitBranch, RefreshCw } from "lucide-react";

// Map icon names to actual components
const strategyIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Percent': Percent,
  'TrendingUp': TrendingUp,
  'ArrowLeftRight': ArrowLeftRight,
  'ArrowDownUp': ArrowDownUp,
  'Minimize2': Minimize2,
  'BarChart3': BarChart3,
  'GitBranch': GitBranch
};

export default function DaytradePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const strategyId = searchParams.get('strategy') as StrategyType || 'entry-percentage';
  const currentStrategy = getStrategy(strategyId) || STRATEGIES[0];
  const {
    isSubscribed,
    incrementQueries,
    isQueryLimitReached,
    createCheckout,
    isLoading: isSubscriptionLoading
  } = useSubscription();
  const {
    user
  } = useAuth();
  const {
    queriesRemaining,
    isLimitReached
  } = useDailyQueries();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const isMobile = useIsMobile();

  // Block premium strategies for non-subscribers
  const isStrategyLocked = currentStrategy.isPremium && !isSubscribed;

  // Load state from localStorage (both mobile and desktop)
  // Also check if the strategy matches the current one
  const loadStateFromStorage = () => {
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('daytrade-page-state');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          // CRITICAL: Only restore state if it matches the current strategy
          if (parsed.savedStrategy === strategyId) {
            return parsed;
          }
          // Strategy changed - clear old state
          console.log('[DaytradePage] Strategy changed, clearing saved state');
          localStorage.removeItem('daytrade-page-state');
        }
        return {};
      } catch {
        return {};
      }
    }
    return {};
  };
  const savedState = loadStateFromStorage();
  const [analysisParams, setAnalysisParams] = useState<StockAnalysisParams | null>(savedState.analysisParams || null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>(savedState.analysisResults || []);
  const [detailedResult, setDetailedResult] = useState<DetailedResult | null>(savedState.detailedResult || null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(savedState.selectedAsset || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDetailView, setShowDetailView] = useState(savedState.showDetailView || false);
  
  
  const [sortConfig, setSortConfig] = useState<{
    field: string;
    direction: "asc" | "desc";
  }>(savedState.sortConfig || {
    field: "assetCode",
    direction: "asc"
  });
  const [currentPage, setCurrentPage] = useState(savedState.currentPage || 1);
  const [rowsPerPage, setRowsPerPage] = useState(savedState.rowsPerPage || 10);

  // AbortController for cancelling analysis
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track previous strategy to detect changes
  const previousStrategyRef = useRef<string>(strategyId);

  // Track the user ID to detect actual user changes (login/logout)
  const previousUserIdRef = useRef<string | undefined>(user?.id);

  // Use visibility preservation hook - prevents unwanted refetches
  useVisibilityPreservation({
    preventRefetch: true
  });

  // Preserve scroll position
  useScrollPreservation('daytrade-page');

  // Clear results ONLY when user actually changes (login as different user or logout)
  useEffect(() => {
    const currentUserId = user?.id;
    const previousUserId = previousUserIdRef.current;

    // Only clear if there was a previous user AND they're different
    // This prevents clearing on initial load or token refresh
    if (previousUserId && previousUserId !== currentUserId) {
      console.log('[DaytradePage] User changed, clearing analysis state');
      setAnalysisResults([]);
      setDetailedResult(null);
      setSelectedAsset(null);
      setShowDetailView(false);
      setAnalysisParams(null);
      // Clear localStorage state too
      localStorage.removeItem('daytrade-page-state');
    }

    // Update ref
    previousUserIdRef.current = currentUserId;
  }, [user?.id]);

  // CRITICAL: Clear results when strategy changes
  useEffect(() => {
    const previousStrategy = previousStrategyRef.current;

    // If strategy changed, clear all analysis state
    if (previousStrategy && previousStrategy !== strategyId) {
      console.log(`[DaytradePage] Strategy changed from ${previousStrategy} to ${strategyId}, clearing results`);
      setAnalysisResults([]);
      setDetailedResult(null);
      setSelectedAsset(null);
      setShowDetailView(false);
      setAnalysisParams(null);
      setProgress(0);
      setCurrentPage(1);
      setSortConfig({
        field: "assetCode",
        direction: "asc"
      });
      // Clear localStorage state
      localStorage.removeItem('daytrade-page-state');
    }

    // Update ref
    previousStrategyRef.current = strategyId;
  }, [strategyId]);

  // Auto-show tour for new users who haven't seen it yet
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('has_seen_tour, created_at')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        const isNewUser = new Date(data.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
        if (!data.has_seen_tour && isNewUser) {
          // Dispatch the same event so AppLayout handles it
          window.dispatchEvent(new CustomEvent('showTour'));
        }
      }
    })();
  }, [user?.id]);

  // Fire Meta Pixel Purchase event when returning from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      const currency = params.get('cur') || 'USD';
      const value = parseFloat(params.get('amt') || '39');
      firePurchase(value, currency);
      // Remove query params silently to prevent duplicate fires
      params.delete('success');
      params.delete('cur');
      params.delete('amt');
      const cleanSearch = params.toString();
      const cleanPath = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);


  // NOTE: Visibility/focus handlers moved to useVisibilityPreservation hook
  // No handlers here that could cause state loss or redirects

  // Save state to localStorage when key states change (both mobile and desktop now)
  // CRITICAL: Also save the current strategy to detect changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stateToSave = {
        savedStrategy: strategyId,
        // Track which strategy this state belongs to
        analysisParams,
        analysisResults,
        detailedResult,
        selectedAsset,
        showDetailView,
        sortConfig,
        currentPage,
        rowsPerPage
      };
      try {
        localStorage.setItem('daytrade-page-state', JSON.stringify(stateToSave));
      } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
      }
    }
  }, [strategyId, analysisParams, analysisResults, detailedResult, selectedAsset, showDetailView, sortConfig, currentPage, rowsPerPage]);

  // Cancel ongoing analysis
  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setProgress(0);
    toast({
      title: "Analysis cancelled",
      description: "The analysis has been stopped."
    });
  };
  const runAnalysis = async (params: StockAnalysisParams) => {
    // Create new AbortController for this analysis
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    try {
      // Check if free user has reached limit BEFORE incrementing
      if (!isSubscribed && isQueryLimitReached) {
        setShowLimitModal(true);
        return;
      }

      // Increment query count before starting analysis (for tracking purposes)
      incrementQueries();

      // Show modal after incrementing if this was the last free query
      if (!isSubscribed && isQueryLimitReached) {
        setShowLimitModal(true);
      }
      setIsLoading(true);
      setAnalysisResults([]);
      setAnalysisParams(params);
      setProgress(0);
      setShowDetailView(false);
      // Reset sorting to alphabetical when running new analysis
      setSortConfig({
        field: "assetCode",
        direction: "asc"
      });
      setCurrentPage(1);
      console.info('DEBUG DaytradePage: Running analysis with params:', params);
      console.info(`DEBUG DaytradePage: User subscription status: ${isSubscribed ? 'Premium' : 'Free'}`);
      console.info(`DEBUG DaytradePage: ComparisonStocks:`, params.comparisonStocks);

      // Check if cancelled
      if (signal.aborted) throw new Error('Analysis cancelled');
      setProgress(10);
      let dataTableName = params.dataTableName;
      if (!dataTableName) {
        console.info('DEBUG DaytradePage: Getting data table name...');
        dataTableName = await api.marketData.getDataTableName(params.country, params.stockMarket, params.assetClass);
        if (!dataTableName) {
          throw new Error("Failed to identify data source");
        }
        console.info(`DEBUG DaytradePage: Found data table: ${dataTableName}`);
      }

      // Check if cancelled
      if (signal.aborted) throw new Error('Analysis cancelled');
      setProgress(20);
      const paramsWithTable = {
        ...params,
        dataTableName
      };
      setAnalysisParams(paramsWithTable);
      const today = new Date();
      const startDate = getStartDateForPeriod(params.period);
      const tradingDaysCount = countBusinessDays(startDate, today);
      console.info(`DEBUG DaytradePage: Period: ${params.period}, Start date: ${startDate.toISOString()}, Calculated trading days: ${tradingDaysCount}`);
      let results: AnalysisResult[];

      // Use optimized analysis for Premium users, regular analysis for Free users
      if (isSubscribed) {
        console.info('DEBUG DaytradePage: Using PREMIUM optimized analysis service');
        results = await premiumAnalysisService.runOptimizedAnalysis(paramsWithTable, currentProgress => {
          if (signal.aborted) return;
          setProgress(20 + currentProgress * 0.7);
        });
      } else {
        console.info('DEBUG DaytradePage: Using standard analysis service for Free users');
        results = await api.analysis.runAnalysis(paramsWithTable, currentProgress => {
          if (signal.aborted) return;
          setProgress(20 + currentProgress * 0.7);
        });
      }

      // Check if cancelled
      if (signal.aborted) throw new Error('Analysis cancelled');
      console.info(`DEBUG DaytradePage: Analysis results received:`, results.map(r => ({
        assetCode: r.assetCode,
        finalCapital: r.finalCapital,
        trades: r.trades,
        hasData: true
      })));
      console.info(`DEBUG DaytradePage: Total results count: ${results.length}`);
      setAnalysisResults(results);
      setProgress(95);

      // Record this query in user_query_history for admin tracking
      try {
        await supabase.rpc('record_user_query', {
          p_query_type: 'simulation'
        });
        console.info('DEBUG DaytradePage: Query recorded successfully');
      } catch (queryError) {
        console.warn('Failed to record query:', queryError);
      }
      setProgress(100);
      toast({
        title: "Analysis completed",
        description: `Analysis was completed successfully${isSubscribed ? ' (Premium optimized)' : ''} - Found ${results.length} results`
      });
    } catch (error) {
      // Don't show error toast if it was cancelled
      if (error instanceof Error && error.message === 'Analysis cancelled') {
        console.info('DEBUG DaytradePage: Analysis was cancelled by user');
        return;
      }
      console.error("DEBUG DaytradePage: Analysis failed", error);
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
      setProgress(0);
    } finally {
      abortControllerRef.current = null;
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };
  const viewDetails = async (assetCode: string) => {
    if (!analysisParams) return;
    try {
      setIsLoadingDetails(true);
      setSelectedAsset(assetCode);

      // CRITICAL: Always include the current strategy from URL in params
      const paramsWithStrategy = {
        ...analysisParams,
        strategy: strategyId // Use strategyId from URL params
      };
      const paramsWithTable = paramsWithStrategy.dataTableName ? paramsWithStrategy : {
        ...paramsWithStrategy,
        dataTableName: await api.marketData.getDataTableName(paramsWithStrategy.country, paramsWithStrategy.stockMarket, paramsWithStrategy.assetClass)
      };
      if (!paramsWithTable.dataTableName) {
        throw new Error("Could not determine data table name");
      }
      console.info(`DEBUG: Fetching detailed analysis for ${assetCode} using strategy: ${strategyId}`);
      console.info(`DEBUG: Params being passed to detailed analysis:`, paramsWithTable);
      const detailedData = await api.analysis.getDetailedAnalysis(assetCode, paramsWithTable);
      console.info(`DEBUG: Detailed data received for ${assetCode}:`, {
        finalCapital: detailedData?.finalCapital,
        trades: detailedData?.trades,
        tradeHistoryLength: detailedData?.tradeHistory?.length,
        tradingDays: detailedData?.tradingDays,
        lastTradeCurrentCapital: detailedData?.tradeHistory?.[detailedData.tradeHistory.length - 1]?.currentCapital
      });
      if (detailedData && detailedData.tradeHistory && detailedData.tradeHistory.length > 0) {
        console.info(`Actual trading days in data: ${detailedData.tradingDays}`);
        console.info(`DEBUG: First trade current capital: ${detailedData.tradeHistory[0]?.currentCapital}`);
        console.info(`DEBUG: Last trade current capital: ${detailedData.tradeHistory[detailedData.tradeHistory.length - 1]?.currentCapital}`);
        console.info(`DEBUG: Final capital from metrics: ${detailedData.finalCapital}`);
      } else {
        console.info(`No trade history found`);
      }
      setDetailedResult(detailedData);
      setShowDetailView(true);
    } catch (error) {
      console.error("Failed to fetch detailed analysis", error);
      toast({
        variant: "destructive",
        title: "Failed to fetch details",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };
  const closeDetails = () => {
    setShowDetailView(false);
    setDetailedResult(null);
    setSelectedAsset(null);
  };
  const updateAnalysis = async (params: StockAnalysisParams) => {
    if (!selectedAsset || !detailedResult) return;
    try {
      setIsLoadingDetails(true);

      // CRITICAL: Always include the current strategy from URL in params
      const paramsWithStrategy = {
        ...params,
        strategy: strategyId // Ensure strategy from URL is used
      };
      console.info(`DEBUG: Updating analysis using strategy: ${strategyId}`);

      // Use optimized update method instead of full recalculation
      const updatedDetailedData = await api.analysis.updateDetailedAnalysisOptimized(detailedResult, paramsWithStrategy);

      // Update analysis params
      setAnalysisParams(params);

      // Update detailed result with optimized data
      setDetailedResult(updatedDetailedData);
      toast({
        title: "Analysis updated",
        description: "Analysis was updated successfully"
      });
    } catch (error) {
      console.error("Analysis update failed", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };
  // Get the icon component for current strategy
  const StrategyIcon = strategyIconMap[currentStrategy.icon] || Percent;
  
  return <div className="w-full max-w-full overflow-x-hidden">
      {/* Strategy Header - Compact and Clear */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-border/50">
        {/* Strategy info with gradient icon */}
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${currentStrategy.gradient} flex items-center justify-center shadow-sm`}>
            <StrategyIcon className={`h-5 w-5 ${currentStrategy.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold">{currentStrategy.name}</h1>
              {currentStrategy.isPremium && <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] px-1.5 py-0">
                  Premium
                </Badge>}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block max-w-md line-clamp-1">
              {currentStrategy.description}
            </p>
          </div>
        </div>
        
        {/* Change Strategy button - inline with name */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/app')} 
          className="border-violet-500/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 hover:border-violet-500 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Change Strategy
        </Button>
      </div>
      
      {/* Strategy locked message */}
      {isStrategyLocked ? <div className="bg-card p-8 rounded-lg border text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Info className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Premium Strategy</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            This advanced strategy is available exclusively for Premium subscribers. 
            Upgrade to unlock all trading algorithms and automatic parameter optimization.
          </p>
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" onClick={createCheckout} disabled={isSubscriptionLoading}>
            {isSubscriptionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Upgrade to Premium
          </Button>
        </div> : <>
          {!showDetailView ? <div className="bg-card p-6 rounded-lg border">
              <StockSetupForm onSubmit={runAnalysis} isLoading={isLoading} initialParams={analysisParams} strategy={strategyId} onCancel={cancelAnalysis} />
              
              {/* Show PremiumUpgrade only when limit is reached for free users */}
              <PremiumUpgrade />
              
              {isLoading && <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Processing analysis{isSubscribed ? ' (Premium optimized)' : ''}...</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>}
              
              {analysisResults.length > 0 && !isLoading && <div data-tour="results-table">
                  <ResultsTable results={analysisResults} onViewDetails={viewDetails} sortConfig={sortConfig} setSortConfig={setSortConfig} currentPage={currentPage} setCurrentPage={setCurrentPage} rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage} />
                </div>}
            </div> : detailedResult && analysisParams && <div className="bg-card p-6 rounded-lg border px-[10px] py-[15px] border-primary-foreground">
                <StockDetailView result={detailedResult} params={analysisParams} onClose={closeDetails} onUpdateParams={updateAnalysis} isLoading={isLoadingDetails} strategy={strategyId} />
              </div>}
        </>}


      {/* Query Limit Modal */}
      <QueryLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </div>;
}