
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchIndexDataViaScraping, fetchStocksForIndexViaScraping, type IndexData, type StockData } from '@/services/scrapingService';
import { fetchEconomicData } from '@/services/yahooFinanceService';

// Use WeakRef-like pattern to avoid stale data issues
const createCache = () => ({
  indices: [] as IndexData[],
  stocks: {} as Record<string, { gainers: StockData[], losers: StockData[] }>,
  lastUpdate: 0,
  isInitialized: false
});

let globalCache = createCache();

export const useDashboardData = () => {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('^GSPC');
  const [stocks, setStocks] = useState<{ gainers: StockData[], losers: StockData[] }>({ gainers: [], losers: [] });
  const [economicData] = useState(fetchEconomicData());
  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fixed order of indices to avoid reordering
  const FIXED_INDEX_ORDER = [
    '^GSPC', '^DJI', '^IXIC', '^BVSP', '^FTSE', 
    '^GDAXI', '^FCHI', '^N225', '^HSI', '000001.SS'
  ];

  const loadIndices = useCallback(async (showLoading = false, forceRefresh = false) => {
    console.log('Loading indices data via web scraping...');
    
    // Check if we should use cache (only if not forcing refresh and cache is recent - less than 1 minute)
    const cacheAge = Date.now() - globalCache.lastUpdate;
    if (!forceRefresh && globalCache.isInitialized && cacheAge < 60000 && globalCache.indices.length > 0) {
      console.log('Using cached indices data');
      if (isMountedRef.current) {
        setIndices(globalCache.indices);
        setLoading(false);
      }
      return;
    }
    
    if (showLoading && isMountedRef.current) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const data = await fetchIndexDataViaScraping();
      console.log('Indices loaded:', data.length, data);
      
      // Sort indices in fixed order
      const sortedIndices = FIXED_INDEX_ORDER.map(symbol => 
        data.find(idx => idx.symbol === symbol)
      ).filter(Boolean) as IndexData[];
      
      // Add any extra indices not in fixed order
      const extraIndices = data.filter(idx => !FIXED_INDEX_ORDER.includes(idx.symbol));
      const finalIndices = [...sortedIndices, ...extraIndices];
      
      // Update global cache
      globalCache.indices = finalIndices;
      globalCache.lastUpdate = Date.now();
      globalCache.isInitialized = true;
      
      if (isMountedRef.current) {
        setIndices(finalIndices);
      }
    } catch (error) {
      console.error('Error loading indices:', error);
      if (isMountedRef.current) {
        setError('Failed to load indices data');
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadStocks = useCallback(async (indexSymbol: string, showLoading = false, forceRefresh = false) => {
    console.log(`Loading stocks for index: ${indexSymbol} via web scraping...`);
    
    // Check cache
    const cacheAge = Date.now() - globalCache.lastUpdate;
    if (!forceRefresh && globalCache.stocks[indexSymbol] && cacheAge < 60000) {
      console.log(`Using cached stocks data for ${indexSymbol}`);
      if (isMountedRef.current) {
        setStocks(globalCache.stocks[indexSymbol]);
      }
      return;
    }
    
    if (showLoading && isMountedRef.current) {
      setStocksLoading(true);
    }
    
    try {
      const stockData = await fetchStocksForIndexViaScraping(indexSymbol);
      console.log('Stocks loaded:', stockData);
      
      // Sort stocks by percentage change
      const sortedGainers = stockData.gainers
        .sort((a, b) => {
          const aPercent = parseFloat(a.changePercent.replace(/[+%]/g, ''));
          const bPercent = parseFloat(b.changePercent.replace(/[+%]/g, ''));
          return bPercent - aPercent;
        })
        .slice(0, 5);

      const sortedLosers = stockData.losers
        .sort((a, b) => {
          const aPercent = parseFloat(a.changePercent.replace(/[+%-]/g, ''));
          const bPercent = parseFloat(b.changePercent.replace(/[+%-]/g, ''));
          const aIsNegative = a.changePercent.includes('-');
          const bIsNegative = b.changePercent.includes('-');
          
          if (aIsNegative && !bIsNegative) return -1;
          if (!aIsNegative && bIsNegative) return 1;
          if (aIsNegative && bIsNegative) return aPercent - bPercent;
          return aPercent - bPercent;
        })
        .slice(0, 5);

      const finalStockData = {
        gainers: sortedGainers,
        losers: sortedLosers
      };
      
      // Update global cache
      globalCache.stocks[indexSymbol] = finalStockData;
      
      if (isMountedRef.current) {
        setStocks(finalStockData);
      }
    } catch (error) {
      console.error('Error loading stocks:', error);
      if (isMountedRef.current) {
        setStocks({ gainers: [], losers: [] });
      }
    } finally {
      if (showLoading && isMountedRef.current) {
        setStocksLoading(false);
      }
    }
  }, []);

  // Force refresh function to clear cache and reload data
  const forceRefresh = useCallback(async () => {
    console.log('Force refreshing dashboard data...');
    globalCache = createCache();
    await Promise.all([
      loadIndices(true, true),
      loadStocks(selectedIndex, true, true)
    ]);
  }, [selectedIndex, loadIndices, loadStocks]);

  // Auto-update function
  const updateData = useCallback(async () => {
    console.log('Auto-updating data...');
    await Promise.all([
      loadIndices(false, true),
      loadStocks(selectedIndex, false, true)
    ]);
  }, [selectedIndex, loadIndices, loadStocks]);

  // Initialization and update interval setup
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial load
    loadIndices(true);
    loadStocks(selectedIndex, true);

    // Set up auto-update interval (every 2 minutes for fresher data)
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    
    updateIntervalRef.current = setInterval(updateData, 2 * 60 * 1000);
    
    return () => {
      isMountedRef.current = false;
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [updateData, loadIndices, loadStocks, selectedIndex]);

  // Load stocks when selected index changes
  useEffect(() => {
    if (selectedIndex) {
      // Always try to load, let the function decide if cache is valid
      loadStocks(selectedIndex, true);
    }
  }, [selectedIndex, loadStocks]);

  const handleIndexClick = useCallback((symbol: string) => {
    console.log(`Index clicked: ${symbol}`);
    if (symbol !== selectedIndex) {
      setSelectedIndex(symbol);
    }
  }, [selectedIndex]);

  return {
    indices,
    stocks,
    economicData,
    selectedIndex,
    loading,
    stocksLoading,
    error,
    handleIndexClick,
    forceRefresh
  };
};
