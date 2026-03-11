import { useState, useEffect, useCallback } from "react";
import { supabase, fromDynamic } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  market: string;
  country: string;
  asset_class: string;
  table_source?: string;
}

export interface MarketDataSource {
  id: number;
  country: string;
  stock_market: string;
  asset_class: string;
  stock_table: string;
}

export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [marketSources, setMarketSources] = useState<MarketDataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMarketSources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('market_data_sources')
        .select('*');

      if (error) {
        console.error("Error fetching market sources:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Failed to fetch market sources", error);
      return [];
    }
  }, []);

  const fetchAssetsFromTable = useCallback(async (tableName: string, source: MarketDataSource) => {
    try {
      console.log(`Fetching assets from table: ${tableName} (filtered by assets_control)`);
      
      // Get only active and visible assets from assets_control
      const { data: assetsControlData, error: assetsControlError } = await supabase
        .from('assets_control')
        .select('stock_code')
        .eq('table_source', tableName)
        .eq('is_active', true)
        .eq('is_visible', true);
      
      if (assetsControlError) {
        console.error(`Error fetching assets_control for ${tableName}:`, assetsControlError);
        // Fallback to unfiltered if assets_control fails
        return await fetchAssetsUnfiltered(tableName, source);
      }
      
      // If no assets configured in assets_control, return all
      if (!assetsControlData || assetsControlData.length === 0) {
        console.log(`No assets_control entries for ${tableName}, returning all stocks`);
        return await fetchAssetsUnfiltered(tableName, source);
      }
      
      console.log(`Found ${assetsControlData.length} active/visible assets in assets_control for ${tableName}`);

      return assetsControlData.map((item) => ({
        id: `${tableName}_${item.stock_code}`,
        name: item.stock_code,
        symbol: item.stock_code,
        market: source.stock_market,
        country: source.country,
        asset_class: source.asset_class,
        table_source: tableName
      }));
    } catch (error) {
      console.error(`Failed to fetch assets from ${tableName}:`, error);
      return [];
    }
  }, []);

  const fetchAssetsUnfiltered = async (tableName: string, source: MarketDataSource) => {
    try {
      const { data, error } = await supabase.rpc('get_unique_stock_codes', {
        p_table_name: tableName
      });

      if (error || !data || !Array.isArray(data) || data.length === 0) {
        const { data: fallbackData, error: fallbackError } = await fromDynamic(tableName)
          .select('stock_code')
          .limit(1000);
        
        if (fallbackError || !fallbackData) return [];
        
        const uniqueStockCodes = [...new Set((fallbackData as any[]).map((item: any) => item?.stock_code).filter(Boolean))];
        return uniqueStockCodes.map(stockCode => ({
          id: `${tableName}_${stockCode}`,
          name: stockCode,
          symbol: stockCode,
          market: source.stock_market,
          country: source.country,
          asset_class: source.asset_class,
          table_source: tableName
        }));
      }

      return data.map((stockCode: string) => ({
        id: `${tableName}_${stockCode}`,
        name: stockCode,
        symbol: stockCode,
        market: source.stock_market,
        country: source.country,
        asset_class: source.asset_class,
        table_source: tableName
      }));
    } catch (error) {
      console.error(`Failed to fetch unfiltered assets from ${tableName}:`, error);
      return [];
    }
  };

  const fetchAllAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // First, get all market data sources
      const sources = await fetchMarketSources();
      setMarketSources(sources);
      
      if (sources.length === 0) {
        console.log("No market data sources found");
        setAssets([]);
        return;
      }

      // Then, fetch assets from each table in parallel for better performance
      const assetPromises = sources.map(source => 
        fetchAssetsFromTable(source.stock_table, source)
      );
      
      const allAssetsArrays = await Promise.all(assetPromises);
      const allAssets = allAssetsArrays.flat();

      console.log(`Total assets fetched: ${allAssets.length}`);
      setAssets(allAssets);
    } catch (error) {
      console.error("Failed to fetch assets", error);
      toast.error("Failed to fetch assets");
    } finally {
      setIsLoading(false);
    }
  }, [fetchMarketSources, fetchAssetsFromTable]);

  const addAsset = async (assetData: {
    name: string;
    symbol: string;
    market: string;
    country: string;
    asset_class: string;
  }) => {
    const newAsset: Asset = {
      id: String(Date.now()),
      ...assetData,
      table_source: 'manual'
    };
    
    setAssets(prevAssets => [...prevAssets, newAsset]);
    toast.success("Asset added successfully");
    return newAsset;
  };

  const deleteAsset = async (assetId: string) => {
    setAssets(prevAssets => prevAssets.filter(asset => asset.id !== assetId));
    toast.success("Asset removed from view");
  };

  // Initial fetch only - no dependency on fetchAllAssets to prevent loops
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchAllAssets();
      }
    };
    
    loadData();

    // Set up realtime subscription for assets_control changes with unique channel name
    const channelName = `assets_control_investor_${Date.now()}`;
    const assetsControlChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assets_control'
        },
        (payload) => {
          if (isMounted) {
            console.log('Realtime INSERT for assets_control (investor):', payload);
            loadData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assets_control'
        },
        (payload) => {
          if (isMounted) {
            console.log('Realtime UPDATE for assets_control (investor):', payload);
            loadData();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'assets_control'
        },
        (payload) => {
          if (isMounted) {
            console.log('Realtime DELETE for assets_control (investor):', payload);
            loadData();
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status (investor):', status);
      });

    // Cleanup subscriptions on unmount
    return () => {
      isMounted = false;
      supabase.removeChannel(assetsControlChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    assets,
    marketSources,
    isLoading,
    addAsset,
    deleteAsset,
    refetch: fetchAllAssets
  };
}
