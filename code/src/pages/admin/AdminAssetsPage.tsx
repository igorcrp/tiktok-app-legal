import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Search, Eye, EyeOff, Power, PowerOff, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useAssetsControl, AssetWithMetadata } from "@/hooks/useAssetsControl";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MarketDataSource {
  id: number;
  country: string;
  stock_market: string;
  asset_class: string;
  stock_table: string;
}

export default function AdminAssetsPage() {
  const {
    assets,
    isLoading,
    deleteAssetEverywhere,
    activateAsset,
    deactivateAsset,
    showAsset,
    hideAsset,
    refetch,
  } = useAssetsControl();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof AssetWithMetadata | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const [showAddAssetDialog, setShowAddAssetDialog] = useState(false);
  const [newAsset, setNewAsset] = useState({
    stock_code: "",
    country: "",
    stock_market: "",
    asset_class: "",
  });
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [marketDataSources, setMarketDataSources] = useState<MarketDataSource[]>([]);

  const [isReconciling, setIsReconciling] = useState(false);
  const [didAutoReconcile, setDidAutoReconcile] = useState(false);

  const reconcileFromSupabase = async () => {
    setIsReconciling(true);
    try {
      const { error } = await supabase.rpc("admin_reconcile_assets_control");
      if (error) {
        console.error("Error reconciling assets_control:", error);
        toast.error(`Falha ao atualizar ativos: ${error.message}`);
        return;
      }
      toast.success("Ativos atualizados com base nas tabelas do Supabase");
      await refetch();
    } finally {
      setIsReconciling(false);
    }
  };

  // Atualiza automaticamente 1x ao abrir a página (resolve deletions feitas direto no Supabase)
  useEffect(() => {
    if (didAutoReconcile) return;
    setDidAutoReconcile(true);
    reconcileFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didAutoReconcile]);

  // Load market data sources
  useEffect(() => {
    const fetchMarketDataSources = async () => {
      const { data, error } = await supabase
        .from("market_data_sources")
        .select("*")
        .order("country, stock_market");

      if (error) {
        console.error("Error fetching market data sources:", error);
        return;
      }

      setMarketDataSources(data || []);
    };

    fetchMarketDataSources();
  }, []);

  // Get unique countries
  const availableCountries = useMemo(() => {
    const countries = [...new Set(marketDataSources.map(s => s.country))];
    return countries.sort();
  }, [marketDataSources]);

  // Get markets filtered by country
  const availableMarkets = useMemo(() => {
    if (!newAsset.country) return [];
    const markets = marketDataSources
      .filter(s => s.country === newAsset.country)
      .map(s => s.stock_market);
    return [...new Set(markets)].sort();
  }, [marketDataSources, newAsset.country]);

  // Get asset classes filtered by country and market
  const availableAssetClasses = useMemo(() => {
    if (!newAsset.country || !newAsset.stock_market) return [];
    const classes = marketDataSources
      .filter(s => s.country === newAsset.country && s.stock_market === newAsset.stock_market)
      .map(s => s.asset_class);
    return [...new Set(classes)].sort();
  }, [marketDataSources, newAsset.country, newAsset.stock_market]);

  // Get table source based on selections
  const tableSource = useMemo(() => {
    if (!newAsset.country || !newAsset.stock_market || !newAsset.asset_class) return "";
    
    const source = marketDataSources.find(
      s => s.country === newAsset.country && 
           s.stock_market === newAsset.stock_market && 
           s.asset_class === newAsset.asset_class
    );
    
    return source?.stock_table || "";
  }, [marketDataSources, newAsset.country, newAsset.stock_market, newAsset.asset_class]);

  // Handle stock code change - no suffix needed, store clean codes
  const handleStockCodeChange = (value: string) => {
    const cleanCode = value.toUpperCase();
    setNewAsset({ ...newAsset, stock_code: cleanCode });
  };

  // Reset dependent fields when parent field changes
  const handleCountryChange = (value: string) => {
    setNewAsset({
      ...newAsset,
      country: value,
      stock_market: "",
      asset_class: "",
      stock_code: ""
    });
  };

  const handleMarketChange = (value: string) => {
    setNewAsset({
      ...newAsset,
      stock_market: value,
      asset_class: "",
      stock_code: ""
    });
  };

  const handleAssetClassChange = (value: string) => {
    setNewAsset({
      ...newAsset,
      asset_class: value
    });
  };

  const sortedAndFilteredAssets = useMemo(() => {
    let filtered = assets.filter(asset =>
      asset.stock_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.market?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.table_source.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [assets, searchTerm, sortConfig]);

  const handleSort = (key: keyof AssetWithMetadata) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key: keyof AssetWithMetadata) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-1 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4" />
      : <ArrowDown className="ml-1 h-4 w-4" />;
  };

  const handleDeleteAsset = async (asset: AssetWithMetadata) => {
    await deleteAssetEverywhere(asset.stock_code, asset.table_source);
  };

  const handleToggleActive = async (asset: any) => {
    if (asset.is_active) {
      await deactivateAsset(asset.id);
    } else {
      await activateAsset(asset.id);
    }
  };

  const handleToggleVisible = async (asset: any) => {
    if (asset.is_visible) {
      await hideAsset(asset.id);
    } else {
      await showAsset(asset.id);
    }
  };


  const handleAddAsset = async () => {
    if (!newAsset.stock_code || !newAsset.country || !newAsset.stock_market || !newAsset.asset_class) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!tableSource) {
      toast.error("Invalid combination of country, market, and asset class");
      return;
    }

    setIsAddingAsset(true);
    try {
      // Store stock code without suffix (matches original table format)
      const finalStockCode = newAsset.stock_code.toUpperCase();

      const { error } = await supabase
        .from('assets_control')
        .insert([{
          stock_code: finalStockCode,
          table_source: tableSource,
          is_active: true,
          is_visible: true
        }]);

      if (error) {
        console.error("Error adding asset:", error);
        toast.error(`Failed to add asset: ${error.message}`);
        return;
      }

      toast.success("Asset added successfully");
      setShowAddAssetDialog(false);
      setNewAsset({
        stock_code: "",
        country: "",
        stock_market: "",
        asset_class: ""
      });
      await refetch();
    } catch (error) {
      console.error("Failed to add asset:", error);
      toast.error("Failed to add asset");
    } finally {
      setIsAddingAsset(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Asset Management</h1>
        <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={reconcileFromSupabase}
            disabled={isReconciling}
            className="w-full sm:w-auto"
          >
            {isReconciling ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando…
              </span>
            ) : (
              "Atualizar do Supabase"
            )}
          </Button>
          <Button onClick={() => setShowAddAssetDialog(true)} className="w-full sm:w-auto">
            Add New Asset
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {sortedAndFilteredAssets.length} of {assets.length} assets
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption>
              Assets control table with visibility and activity management. 
              Total: {assets.length} assets from multiple exchanges.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">
                  <button
                    className="flex items-center hover:bg-muted/50 p-1 rounded"
                    onClick={() => handleSort('stock_code')}
                  >
                    Stock Code
                    {getSortIcon('stock_code')}
                  </button>
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button
                    className="flex items-center hover:bg-muted/50 p-1 rounded"
                    onClick={() => handleSort('market')}
                  >
                    Market
                    {getSortIcon('market')}
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    className="flex items-center hover:bg-muted/50 p-1 rounded"
                    onClick={() => handleSort('country')}
                  >
                    Country
                    {getSortIcon('country')}
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button
                    className="flex items-center hover:bg-muted/50 p-1 rounded"
                    onClick={() => handleSort('asset_class')}
                  >
                    Asset Class
                    {getSortIcon('asset_class')}
                  </button>
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  <button
                    className="flex items-center hover:bg-muted/50 p-1 rounded"
                    onClick={() => handleSort('table_source')}
                  >
                    Source Table
                    {getSortIcon('table_source')}
                  </button>
                </TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Visible</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Loading assets...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedAndFilteredAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No assets found matching your search" : "No assets found"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{asset.stock_code}</div>
                        <div className="sm:hidden space-y-1">
                          <div className="text-xs text-muted-foreground">{asset.market || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{asset.country || 'Unknown'}</div>
                          <Badge variant="outline" className="text-xs">
                            {asset.table_source}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{asset.market || 'Unknown'}</TableCell>
                    <TableCell className="hidden md:table-cell">{asset.country || 'Unknown'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{asset.asset_class || 'Unknown'}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {asset.table_source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={asset.is_active}
                          onCheckedChange={() => handleToggleActive(asset)}
                        />
                        {asset.is_active ? (
                          <Power className="ml-2 h-4 w-4 text-green-500" />
                        ) : (
                          <PowerOff className="ml-2 h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={asset.is_visible}
                          onCheckedChange={() => handleToggleVisible(asset)}
                        />
                        {asset.is_visible ? (
                          <Eye className="ml-2 h-4 w-4 text-green-500" />
                        ) : (
                          <EyeOff className="ml-2 h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete the asset "{asset.stock_code}" from the control table. 
                              This action cannot be undone. The asset will no longer be available to users.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteAsset(asset)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-sm">{sortedAndFilteredAssets.length} assets displayed</span>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm">
                      <span>Active: {assets.filter(a => a.is_active).length}</span>
                      <span>Visible: {assets.filter(a => a.is_visible).length}</span>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      {/* Add New Asset Dialog */}
      <Dialog open={showAddAssetDialog} onOpenChange={setShowAddAssetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Select
                value={newAsset.country}
                onValueChange={handleCountryChange}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableCountries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_market">Stock Market *</Label>
              <Select
                value={newAsset.stock_market}
                onValueChange={handleMarketChange}
                disabled={!newAsset.country}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select market" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableMarkets.map((market) => (
                    <SelectItem key={market} value={market}>
                      {market}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset_class">Asset Class *</Label>
              <Select
                value={newAsset.asset_class}
                onValueChange={handleAssetClassChange}
                disabled={!newAsset.stock_market}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select asset class" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableAssetClasses.map((assetClass) => (
                    <SelectItem key={assetClass} value={assetClass}>
                      {assetClass}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_code">Stock Code *</Label>
              <Input
                id="stock_code"
                value={newAsset.stock_code}
                onChange={(e) => handleStockCodeChange(e.target.value)}
                placeholder={`e.g., ${newAsset.country === "Brazil" ? "PETR4" : "AAPL"}`}
                disabled={!newAsset.asset_class}
              />
              {newAsset.stock_code && newAsset.country && newAsset.stock_market && (
                <p className="text-xs text-muted-foreground">
                  Will be saved as: {newAsset.stock_code.toUpperCase()}
                </p>
              )}
            </div>

            {tableSource && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium">Table Source:</span> {tableSource}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAssetDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAsset} 
              disabled={isAddingAsset || !newAsset.stock_code || !newAsset.country || !newAsset.stock_market || !newAsset.asset_class}
            >
              {isAddingAsset ? "Adding..." : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}