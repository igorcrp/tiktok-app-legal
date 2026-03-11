import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Info, X, Square } from "lucide-react";
import { StockAnalysisParams, StockInfo } from "@/types";
import { api } from "@/services/api";
import { toast } from "@/components/ui/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StrategyType } from "@/services/strategyService";
import { StrategyParameterFields } from "./StrategyParameterFields";

interface StockSetupFormProps {
  onSubmit: (params: StockAnalysisParams) => void;
  isLoading?: boolean;
  initialParams?: StockAnalysisParams | null;
  strategy?: StrategyType;
  onCancel?: () => void;
}

export function StockSetupForm({
  onSubmit,
  isLoading = false,
  initialParams = null,
  strategy = 'entry-percentage',
  onCancel
}: StockSetupFormProps) {
  // State for options loaded from Supabase
  // State for options loaded from Supabase
  const [countries, setCountries] = useState<string[]>([]);
  const [stockMarkets, setStockMarkets] = useState<string[]>([]);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<StockInfo[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [dataTableName, setDataTableName] = useState<string | null>(null);
  const [isTableValid, setIsTableValid] = useState<boolean | null>(null);
  const [loadingState, setLoadingState] = useState<{
    countries: boolean;
    stockMarkets: boolean;
    assetClasses: boolean;
    assets: boolean;
  }>({
    countries: false,
    stockMarkets: false,
    assetClasses: false,
    assets: false
  });

  // Estados para o autocomplete
  const [comparisonStockInput, setComparisonStockInput] = useState("");
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form setup with react-hook-form
  const form = useForm<StockAnalysisParams>({
    defaultValues: initialParams || {
      operation: "buy",
      country: "",
      stockMarket: "",
      assetClass: "",
      referencePrice: "close",
      period: "1m",
      entryPercentage: 1.00,
      stopPercentage: 1.00,
      initialCapital: 10000.00,
      initialInvestment: 10000.00,
      stopLoss: 1.00,
      profitTarget: 1.00,
      riskFactor: 1.00,
      comparisonStocks: []
    }
  });

  // Load countries from API on component mount and reload dependent data if initial params exist
  useEffect(() => {
    async function loadCountries() {
      setLoadingState(prev => ({ ...prev, countries: true }));
      try {
        const fetchedCountries = await api.marketData.getCountries();
        if (fetchedCountries && fetchedCountries.length > 0) {
          setCountries(fetchedCountries);
          console.log("Loaded countries:", fetchedCountries);
          
          // If we have initial params, load dependent data
          if (initialParams?.country) {
            await loadDependentData();
          }
        } else {
          console.error("No countries returned from API");
          toast({
            variant: "destructive",
            title: "Failed to load countries",
            description: "No countries found in the database."
          });
        }
      } catch (error) {
        console.error("Error loading countries:", error);
        toast({
          variant: "destructive",
          title: "Failed to load countries",
          description: "There was an error loading the available countries."
        });
      } finally {
        setLoadingState(prev => ({ ...prev, countries: false }));
      }
    }

    async function loadDependentData() {
      if (!initialParams) return;
      
      // Load stock markets if country exists
      if (initialParams.country) {
        try {
          setLoadingState(prev => ({ ...prev, stockMarkets: true }));
          const fetchedMarkets = await api.marketData.getStockMarkets(initialParams.country);
          if (fetchedMarkets && fetchedMarkets.length > 0) {
            setStockMarkets(fetchedMarkets);
          }
        } catch (error) {
          console.error("Error loading stock markets for initial params:", error);
        } finally {
          setLoadingState(prev => ({ ...prev, stockMarkets: false }));
        }
      }
      
      // Load asset classes if stock market exists
      if (initialParams.country && initialParams.stockMarket) {
        try {
          setLoadingState(prev => ({ ...prev, assetClasses: true }));
          const fetchedAssetClasses = await api.marketData.getAssetClasses(initialParams.country, initialParams.stockMarket);
          if (fetchedAssetClasses && fetchedAssetClasses.length > 0) {
            setAssetClasses(fetchedAssetClasses);
          }
        } catch (error) {
          console.error("Error loading asset classes for initial params:", error);
        } finally {
          setLoadingState(prev => ({ ...prev, assetClasses: false }));
        }
      }
      
      // Load assets if all criteria exist
      if (initialParams.country && initialParams.stockMarket && initialParams.assetClass) {
        try {
          setLoadingState(prev => ({ ...prev, assets: true }));
          const tableName = await api.marketData.getDataTableName(initialParams.country, initialParams.stockMarket, initialParams.assetClass);
          if (tableName) {
            setDataTableName(tableName);
            const tableExists = await api.marketData.checkTableExists(tableName);
            if (tableExists) {
              const stocksData = await api.analysis.getAvailableStocks(tableName);
              setAvailableAssets(stocksData);
              setIsTableValid(true);
            } else {
              setIsTableValid(false);
            }
          }
        } catch (error) {
          console.error("Error loading assets for initial params:", error);
          setIsTableValid(false);
        } finally {
          setLoadingState(prev => ({ ...prev, assets: false }));
        }
      }
    }

    loadCountries();
  }, [initialParams]);

  // Load stock markets when country changes
  useEffect(() => {
    const country = form.watch("country");
    if (!country) {
      setStockMarkets([]);
      return;
    }
    
    async function loadStockMarkets() {
      setLoadingState(prev => ({ ...prev, stockMarkets: true }));
      try {
        const fetchedMarkets = await api.marketData.getStockMarkets(country);
        
        if (fetchedMarkets && fetchedMarkets.length > 0) {
          setStockMarkets(fetchedMarkets);
          console.log("Loaded stock markets:", fetchedMarkets);
        } else {
          console.error("No stock markets returned for country:", country);
          toast({
            variant: "destructive",
            title: "No stock markets found",
            description: `No stock markets found for ${country}.`
          });
        }

        // Only reset dependent fields if not loading initial params
        if (!initialParams || country !== initialParams.country) {
          form.setValue("stockMarket", "");
          form.setValue("assetClass", "");
          setDataTableName(null);
          setIsTableValid(null);
          setAssetClasses([]);
          setAvailableAssets([]);
        }
      } catch (error) {
        console.error("Error loading stock markets:", error);
        toast({
          variant: "destructive",
          title: "Failed to load stock markets",
          description: "There was an error loading the available stock markets."
        });
      } finally {
        setLoadingState(prev => ({ ...prev, stockMarkets: false }));
      }
    }
    loadStockMarkets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("country")]);

  // Load asset classes when stock market changes
  useEffect(() => {
    const country = form.watch("country");
    const stockMarket = form.watch("stockMarket");
    if (!country || !stockMarket) {
      setAssetClasses([]);
      return;
    }
    
    async function loadAssetClasses() {
      setLoadingState(prev => ({ ...prev, assetClasses: true }));
      try {
        const fetchedAssetClasses = await api.marketData.getAssetClasses(country, stockMarket);
        
        if (fetchedAssetClasses && fetchedAssetClasses.length > 0) {
          setAssetClasses(fetchedAssetClasses);
          console.log("Loaded asset classes:", fetchedAssetClasses);
        } else {
          console.error("No asset classes returned for:", country, stockMarket);
          toast({
            variant: "destructive",
            title: "No asset classes found",
            description: `No asset classes found for ${stockMarket} in ${country}.`
          });
        }

        // Only reset asset class if not loading initial params  
        if (!initialParams || stockMarket !== initialParams.stockMarket) {
          form.setValue("assetClass", "");
          setDataTableName(null);
          setIsTableValid(null);
          setAvailableAssets([]);
        }
      } catch (error) {
        console.error("Error loading asset classes:", error);
        toast({
          variant: "destructive",
          title: "Failed to load asset classes",
          description: "There was an error loading the available asset classes."
        });
      } finally {
        setLoadingState(prev => ({ ...prev, assetClasses: false }));
      }
    }
    loadAssetClasses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("country"), form.watch("stockMarket")]);

  // Load assets when asset class changes
  useEffect(() => {
    const country = form.watch("country");
    const stockMarket = form.watch("stockMarket");
    const assetClass = form.watch("assetClass");
    if (!country || !stockMarket || !assetClass) {
      setAvailableAssets([]);
      return;
    }
    
    async function loadAssets() {
      setLoadingState(prev => ({ ...prev, assets: true }));
      try {
        // Get the data table name
        const tableName = await api.marketData.getDataTableName(country, stockMarket, assetClass);
        
        if (!tableName) {
          console.error("No data table found for the selected criteria");
          toast({
            variant: "destructive",
            title: "Data source not found",
            description: "No data source found for the selected criteria."
          });
          setDataTableName(null);
          setIsTableValid(false);
          setAvailableAssets([]);
          return;
        }
        
        // Save table name for later use
        setDataTableName(tableName);
        console.log(`Found data table: ${tableName}`);
        
        // Check if the table exists before trying to access it
        const tableExists = await api.marketData.checkTableExists(tableName);
        
        if (!tableExists) {
          console.error(`The table ${tableName} does not exist`);
          toast({
            variant: "destructive",
            title: "Table not found",
            description: `The data table ${tableName} does not exist in the database.`
          });
          setIsTableValid(false);
          setAvailableAssets([]);
          return;
        }
        
        try {
          // Fetch assets directly from the dynamic table
          const stocksData = await api.analysis.getAvailableStocks(tableName);
          setAvailableAssets(stocksData);
          setIsTableValid(true);
        } catch (stockError) {
          console.error(`Error accessing table ${tableName}:`, stockError);
          toast({
            variant: "destructive",
            title: "Data access error",
            description: `Could not access ${tableName} data. Please contact support.`
          });
          setIsTableValid(false);
          setAvailableAssets([]);
        }
      } catch (error) {
        console.error("Error in asset loading process:", error);
        toast({
          variant: "destructive",
          title: "Failed to load assets",
          description: "There was an error loading the available assets."
        });
        setAvailableAssets([]);
        setIsTableValid(false);
      } finally {
        setLoadingState(prev => ({ ...prev, assets: false }));
      }
    }
    loadAssets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("country"), form.watch("stockMarket"), form.watch("assetClass")]);

  // Handle form submission
  const handleSubmit = form.handleSubmit(data => {
    // Helper function to map form fields to strategy-specific params
    const mapStrategyParams = (formData: StockAnalysisParams) => {
      const params = { ...formData };
      params.strategy = strategy;
      
      // Ensure numeric values
      params.entryPercentage = Number(params.entryPercentage) || 0;
      params.stopPercentage = Number(params.stopPercentage) || 0;
      params.initialCapital = Number(params.initialCapital) || 0;
      params.initialInvestment = Number(params.initialInvestment) || 0;
      params.stopLoss = Number(params.stopLoss) || 0;
      params.profitTarget = Number(params.profitTarget) || 0;
      params.riskFactor = Number(params.riskFactor) || 0;
      
      // Map form fields to strategy-specific parameters based on strategy type
      switch (strategy) {
        case 'breakout':
          // For breakout, entryPercentage is used as breakoutBuffer
          params.breakoutBuffer = params.entryPercentage;
          break;
        case 'gap-trading':
          // For gap trading, entryPercentage is minGapPercent
          params.minGapPercent = params.entryPercentage;
          // referencePrice field is reused for gapMode (close = fade, open = continuation)
          params.gapMode = params.referencePrice === 'open' ? 'continuation' : 'fade';
          break;
        case 'intraday-oversold':
          // For intraday-oversold, entryPercentage is oversoldThreshold
          params.oversoldThreshold = params.entryPercentage;
          break;
        case 'range-compression':
          // For range-compression, initialInvestment is lookbackDays, entryPercentage is compressionRatio
          params.lookbackDays = Math.round(params.initialInvestment) || 5;
          params.compressionRatio = params.entryPercentage;
          break;
        case 'volume-spike':
          // For volume-spike, initialInvestment is volumeLookback, entryPercentage is volumeMultiplier
          params.volumeLookback = Math.round(params.initialInvestment) || 20;
          params.volumeMultiplier = params.entryPercentage;
          break;
        case 'price-volume-divergence':
          // For divergence, entryPercentage is priceMoveThreshold, stopPercentage used for volumeDropRatio
          params.priceMoveThreshold = params.entryPercentage;
          params.volumeDropRatio = params.stopLoss / 100 || 0.7; // Convert from % to ratio
          break;
        case 'entry-percentage':
        default:
          // Entry-percentage uses entryPercentage and stopPercentage directly
          break;
      }
      
      console.info(`[StockSetupForm] Submitting with strategy: ${strategy}`, params);
      return params;
    };
    
    if (dataTableName) {
      data.dataTableName = dataTableName;
      onSubmit(mapStrategyParams(data));
    } else {
      // If we don't have the table name, try to get it again
      (async () => {
        const tableName = await api.marketData.getDataTableName(
          data.country,
          data.stockMarket,
          data.assetClass
        );
        
        if (tableName) {
          data.dataTableName = tableName;
          onSubmit(mapStrategyParams(data));
        } else {
          toast({
            variant: "destructive",
            title: "Missing data source",
            description: "Could not determine the data source. Please try again."
          });
        }
      })();
    }
  });

  // Format stock name display
  const formatStockDisplay = (stock: StockInfo) => {
    return stock.fullName ? `${stock.code} - ${stock.fullName}` : stock.code;
  };

  // Adicionar um stock ao estado de comparação
  const addComparisonStock = (stockCode: string) => {
    if (!selectedStocks.includes(stockCode)) {
      const newSelectedStocks = [...selectedStocks, stockCode];
      setSelectedStocks(newSelectedStocks);
      form.setValue("comparisonStocks", newSelectedStocks);
      setComparisonStockInput("");
      setShowSuggestions(false);
    }
  };

  // Remover um stock da comparação
  const removeComparisonStock = (stockCode: string) => {
    const newSelectedStocks = selectedStocks.filter(code => code !== stockCode);
    setSelectedStocks(newSelectedStocks);
    form.setValue("comparisonStocks", newSelectedStocks);
  };

  // Filtrar stocks disponíveis com base no input (somente ativos que começam com as letras digitadas)
  const filteredStocks = comparisonStockInput === ""
    ? []
    : availableAssets.filter((stock) =>
        !selectedStocks.includes(stock.code) &&
        (stock.code.toLowerCase().startsWith(comparisonStockInput.toLowerCase()) ||
        (stock.fullName && stock.fullName.toLowerCase().startsWith(comparisonStockInput.toLowerCase())))
      );

  // Atualizar os stocks selecionados quando os comparisonStocks mudarem no form
  useEffect(() => {
    const stocks = form.watch("comparisonStocks");
    if (stocks && Array.isArray(stocks)) {
      setSelectedStocks(stocks);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("comparisonStocks")]);
  
  // Check if any options are loading
  const isOptionsLoading = loadingState.countries || 
                           loadingState.stockMarkets || 
                           loadingState.assetClasses || 
                           loadingState.assets;
  // Função específica para Initial Capital com separador de milhares
  const handleInitialCapitalChange = (value: string, onChange: (val: number) => void) => {
    if (value === "") {
      onChange(0);
      return;
    }

    // Remove pontos existentes para validação
    const cleanValue = value.replace(/\./g, '');

    // Impede números negativos
    if (cleanValue.startsWith('-')) {
      return;
    }

    // Permite apenas números inteiros
    const regex = /^\d*$/;

    if (regex.test(cleanValue)) {
      const numValue = parseInt(cleanValue) || 0;
      onChange(numValue);
    }
  };

  // Função para formatar com separador de milhares
  const formatWithThousandsSeparator = (value: number): string => {
    if (!value || value === 0) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, '.');
  };

  
  
  return (
    <div className="w-full space-y-6">
      <TooltipProvider delayDuration={300}>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
        {/* First row - Operation, Country, Stock Market, Asset Class */}
        {/* Desktop: 4 columns, Mobile: 2 columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-tour="basic-config">
          {/* First row fields */}
          <FormField
            control={form.control}
            name="operation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operation</FormLabel>
                 <Select 
                   disabled={isLoading || isOptionsLoading} 
                   onValueChange={field.onChange}
                   defaultValue={field.value}
                 >
                   <FormControl>
                     <SelectTrigger className="h-9 text-sm">
                       <SelectValue placeholder="Select operation" />
                     </SelectTrigger>
                   </FormControl>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <Select 
                  disabled={isLoading || loadingState.countries || countries.length === 0} 
                  onValueChange={field.onChange}
                  value={field.value}
                >
                   <FormControl>
                     <SelectTrigger className="h-9 text-sm">
                       {loadingState.countries ? (
                         <div className="flex items-center">
                           <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                           <span className="text-sm">Loading...</span>
                         </div>
                       ) : (
                         <SelectValue placeholder="Select country" />
                       )}
                     </SelectTrigger>
                   </FormControl>
                  <SelectContent>
                    {countries.map(country => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stockMarket"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Market</FormLabel>
                <Select 
                  disabled={isLoading || loadingState.stockMarkets || stockMarkets.length === 0 || !form.watch("country")} 
                  onValueChange={field.onChange}
                  value={field.value}
                >
                   <FormControl>
                     <SelectTrigger className="h-9 text-sm">
                       {loadingState.stockMarkets ? (
                         <div className="flex items-center">
                           <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                           <span className="text-sm">Loading...</span>
                         </div>
                       ) : (
                         <SelectValue placeholder="Select stock..." />
                       )}
                     </SelectTrigger>
                   </FormControl>
                  <SelectContent>
                    {stockMarkets.map(market => (
                      <SelectItem key={market} value={market}>
                        {market}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="assetClass"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset Class</FormLabel>
                <Select 
                  disabled={isLoading || loadingState.assetClasses || assetClasses.length === 0 || !form.watch("stockMarket")} 
                  onValueChange={field.onChange}
                  value={field.value}
                >
                   <FormControl>
                     <SelectTrigger className="h-9 text-sm">
                       {loadingState.assetClasses ? (
                         <div className="flex items-center">
                           <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                           <span className="text-sm">Loading...</span>
                         </div>
                       ) : (
                         <SelectValue placeholder="Select asset..." />
                       )}
                     </SelectTrigger>
                   </FormControl>
                  <SelectContent>
                    {assetClasses.map(assetClass => (
                      <SelectItem key={assetClass} value={assetClass}>
                        {assetClass}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Strategy-specific parameters */}
        <StrategyParameterFields
          form={form}
          strategy={strategy}
          isLoading={isLoading}
          isOptionsLoading={isOptionsLoading}
        />

        {/* Third row - Initial Capital, Comparison Stocks */}
        {/* Desktop: 2 columns, Mobile: 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start" data-tour="capital-config">
          <FormField
            control={form.control}
            name="initialCapital"
            render={({ field }) => (
               <FormItem className="flex flex-col">
                 <div className="flex items-center gap-2">
                   <FormLabel>Initial Capital</FormLabel>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                     </TooltipTrigger>
                     <TooltipContent>
                       <p>Starting capital amount for trading simulation</p>
                     </TooltipContent>
                   </Tooltip>
                 </div>
                <FormControl>
                  <Input
                    type="text"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-9 text-sm"
                    disabled={isLoading || isOptionsLoading || !isTableValid}
                    value={field.value ? formatWithThousandsSeparator(field.value) : ''}
                    onChange={(e) => handleInitialCapitalChange(e.target.value, field.onChange)}
                    onBlur={() => {
                      // No-op - o valor já foi atualizado no onChange
                    }}
                  />
                </FormControl>
                {field.value > 50000 && (
                  <div className="text-[11px] text-amber-500 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    The asset may not have enough liquidity to absorb the entire capital. Please verify the asset's liquidity before proceeding.
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="comparisonStocks"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Compare assets (opt.)</FormLabel>
                <div className="relative">
                  <FormControl>
                    <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-9 bg-background items-center text-sm">
                      {selectedStocks.map(stock => (
                        <Badge key={stock} variant="secondary" className="flex items-center gap-1">
                          {stock}
                          <button 
                            type="button" 
                            className="rounded-full hover:bg-muted p-0.5"
                            onClick={() => removeComparisonStock(stock)}
                            aria-label={`Remove ${stock}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <input
                        className={cn(
                          "flex-1 bg-transparent outline-none min-w-20 h-full",
                          selectedStocks.length > 0 && "ml-1"
                        )}
                        disabled={isLoading || loadingState.assets || !isTableValid}
                        value={comparisonStockInput}
                        onChange={(e) => {
                          setComparisonStockInput(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => {
                          setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        placeholder={selectedStocks.length === 0 ? "E.g. AAPL, MSFT" : ""}
                      />
                    </div>
                  </FormControl>
                  
                  {showSuggestions && filteredStocks.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg">
                      <Command>
                        <CommandList>
                          <CommandEmpty>No stocks found.</CommandEmpty>
                          <CommandGroup>
                            {filteredStocks.slice(0, 10).map((stock) => (
                              <CommandItem
                                key={stock.code}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addComparisonStock(stock.code);
                                }}
                                className="cursor-pointer"
                              >
                                {formatStockDisplay(stock)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit/Cancel button with query limit check */}
        {isLoading ? (
          <Button 
            type="button"
            variant="default"
            className="w-full bg-primary hover:bg-primary/90"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onCancel) {
                onCancel();
              }
            }}
          >
            <Square className="mr-2 h-4 w-4 fill-current" />
            <span>Stop Analysis</span>
          </Button>
        ) : (
          <Button 
            type="submit" 
            className="w-full"
            data-tour="show-results"
            disabled={
              isOptionsLoading || 
              !form.watch("country") || 
              !form.watch("stockMarket") || 
              !form.watch("assetClass") || 
              isTableValid === false
            }
          >
            Show Results
          </Button>
        )}
        
        {isTableValid === false && (
          <div className="text-sm text-destructive">
            The selected data source could not be accessed. Please select a different combination or contact support.
          </div>
         )}
       </form>
     </Form>
     </TooltipProvider>
     </div>
   );
 }
