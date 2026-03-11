import { useState, useEffect, useCallback } from "react";
import { supabase, fromDynamic } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AssetControl {
  id: string;
  stock_code: string;
  table_source: string;
  is_active: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface AssetWithMetadata extends AssetControl {
  market?: string;
  country?: string;
  asset_class?: string;
}

export function useAssetsControl() {
  const [assets, setAssets] = useState<AssetWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch ALL assets from assets_control with pagination to bypass 1000 row limit
      let allAssets: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: assetsData, error: assetsError } = await fromDynamic('assets_control')
          .select('*')
          .order('stock_code')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (assetsError) {
          console.error("Error fetching assets control:", assetsError);
          toast.error("Failed to fetch assets");
          return;
        }

        if (assetsData && assetsData.length > 0) {
          allAssets = [...allAssets, ...assetsData];
          hasMore = assetsData.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Fetch market data sources for mapping
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('market_data_sources')
        .select('*');

      if (sourcesError) {
        console.error("Error fetching market data sources:", sourcesError);
        toast.error("Failed to fetch market data sources");
        return;
      }

      // Transform the data to include market information
      const sourcesMap = new Map(sourcesData?.map(source => [source.stock_table, source]) || []);
      
      const enhancedAssets = allAssets.map((asset: any) => {
        const source = sourcesMap.get(asset.table_source);
        return {
          id: asset.id,
          stock_code: asset.stock_code,
          table_source: asset.table_source,
          is_active: asset.is_active,
          is_visible: asset.is_visible,
          created_at: asset.created_at,
          updated_at: asset.updated_at,
          created_by: asset.created_by,
          updated_by: asset.updated_by,
          market: source?.stock_market || 'Unknown',
          country: source?.country || 'Unknown',
          asset_class: source?.asset_class || 'Unknown',
        };
      });

      setAssets(enhancedAssets);
      console.log(`Loaded ${enhancedAssets.length} assets from assets_control`);
    } catch (error) {
      console.error("Failed to fetch assets control", error);
      toast.error("Failed to fetch assets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateAssetStatus = async (assetId: string, updates: { is_active?: boolean; is_visible?: boolean }) => {
    try {
      const { error } = await fromDynamic('assets_control')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId);

      if (error) {
        console.error("Error updating asset:", error);
        toast.error("Failed to update asset");
        return false;
      }

      toast.success("Asset updated successfully");
      return true;
    } catch (error) {
      console.error("Failed to update asset", error);
      toast.error("Failed to update asset");
      return false;
    }
  };

  const deleteAssetEverywhere = async (stockCode: string, tableSource: string) => {
    try {
      const { error } = await supabase.rpc('admin_delete_asset_everywhere', {
        p_stock_code: stockCode,
        p_table_source: tableSource
      });

      if (error) {
        console.error("Error deleting asset everywhere:", error);
        toast.error(`Failed to delete asset: ${error.message}`);
        return false;
      }

      toast.success("Asset deleted from all tables");
      return true;
    } catch (error) {
      console.error("Failed to delete asset everywhere", error);
      toast.error("Failed to delete asset");
      return false;
    }
  };

  const activateAsset = async (assetId: string) => {
    return updateAssetStatus(assetId, { is_active: true });
  };

  const deactivateAsset = async (assetId: string) => {
    return updateAssetStatus(assetId, { is_active: false });
  };

  const showAsset = async (assetId: string) => {
    return updateAssetStatus(assetId, { is_visible: true });
  };

  const hideAsset = async (assetId: string) => {
    return updateAssetStatus(assetId, { is_visible: false });
  };

  const populateAssetsControl = async () => {
    try {
      setIsLoading(true);
      
      // Call the RPC function to populate assets_control
      const { error } = await supabase.rpc('populate_assets_control');
      
      if (error) {
        console.error("Error populating assets control:", error);
        toast.error("Failed to populate assets control");
        return false;
      }

      toast.success("Assets control populated successfully");
      // Refresh will be handled by realtime subscription
      await fetchAssets();
      return true;
    } catch (error) {
      console.error("Failed to populate assets control", error);
      toast.error("Failed to populate assets control");
      return false;
    }
  };

  // Initial fetch and realtime subscription - no fetchAssets in deps to prevent loops
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchAssets();
      }
    };
    
    loadData();

    // Set up realtime subscription for assets_control table with unique channel name
    const channelName = `assets_control_admin_${Date.now()}`;
    const channel = supabase
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
            console.log('Realtime INSERT for assets_control (admin):', payload);
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
            console.log('Realtime UPDATE for assets_control (admin):', payload);
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
            console.log('Realtime DELETE for assets_control (admin):', payload);
            loadData();
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status (admin):', status);
      });

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    assets,
    isLoading,
    updateAssetStatus,
    deleteAssetEverywhere,
    activateAsset,
    deactivateAsset,
    showAsset,
    hideAsset,
    populateAssetsControl,
    refetch: fetchAssets
  };
}