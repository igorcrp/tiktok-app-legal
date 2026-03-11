import { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StockAnalysisParams } from "@/types";
import { StrategyType } from "@/services/strategyService";
import { useIsMobile } from "@/hooks/use-mobile";

interface StrategySetupPanelProps {
  params: StockAnalysisParams;
  strategy: StrategyType;
  isLoading: boolean;
  onUpdateParams: (params: StockAnalysisParams) => void;
  panelRef?: React.RefObject<HTMLDivElement>;
}

export function StrategySetupPanel({
  params,
  strategy,
  isLoading,
  onUpdateParams,
  panelRef
}: StrategySetupPanelProps) {
  const isMobile = useIsMobile();
  const localPanelRef = useRef<HTMLDivElement>(null);
  const ref = panelRef || localPanelRef;

  // Estados para inputs (valores temporários) - comuns a todas estratégias
  const [stopPercentage, setStopPercentage] = useState<number | string | null>(params.stopPercentage ?? null);
  const [initialCapital, setInitialCapital] = useState<number | null>(params.initialCapital ?? null);
  
  // Entry Percentage específicos
  const [refPrice, setRefPrice] = useState(params.referencePrice);
  const [entryPercentage, setEntryPercentage] = useState<number | string | null>(params.entryPercentage ?? null);
  
  // Breakout específicos
  const [bufferPercentage, setBufferPercentage] = useState<number | string | null>(params.entryPercentage ?? null);
  
  // Gap Trading específicos
  const [minGapPercent, setMinGapPercent] = useState<number | string | null>(params.entryPercentage ?? null);
  const [gapMode, setGapMode] = useState(params.referencePrice || 'close');
  
  // Intraday Oversold específicos
  const [dropPercentage, setDropPercentage] = useState<number | string | null>(params.entryPercentage ?? null);
  
  // Range Compression específicos (Premium)
  const [lookbackDays, setLookbackDays] = useState<number>(params.initialInvestment || 5);
  const [compressionRatio, setCompressionRatio] = useState<number | string | null>(params.entryPercentage ?? null);
  
  // Volume Spike específicos (Premium)
  const [volumeMultiplier, setVolumeMultiplier] = useState<number | string | null>(params.entryPercentage ?? null);
  const [volumeLookback, setVolumeLookback] = useState<number>(params.initialInvestment || 20);
  
  // Price-Volume Divergence específicos (Premium)
  const [priceMoveThreshold, setPriceMoveThreshold] = useState<number | string | null>(params.entryPercentage ?? null);
  const [volumeDropRatio, setVolumeDropRatio] = useState<number | string | null>(params.stopPercentage ?? null);

  const [isEntryPriceFocused, setIsEntryPriceFocused] = useState(false);
  const [isStopPriceFocused, setIsStopPriceFocused] = useState(false);

  // Sincronizar estados quando params mudam
  useEffect(() => {
    setStopPercentage(params.stopPercentage ?? null);
    setInitialCapital(params.initialCapital ?? null);
    setRefPrice(params.referencePrice);
    setEntryPercentage(params.entryPercentage ?? null);
    setBufferPercentage(params.entryPercentage ?? null);
    setMinGapPercent(params.entryPercentage ?? null);
    setGapMode(params.referencePrice || 'close');
    setDropPercentage(params.entryPercentage ?? null);
    setLookbackDays(params.initialInvestment || 5);
    setCompressionRatio(params.entryPercentage ?? null);
    setVolumeMultiplier(params.entryPercentage ?? null);
    setVolumeLookback(params.initialInvestment || 20);
    setPriceMoveThreshold(params.entryPercentage ?? null);
    setVolumeDropRatio(params.stopPercentage ?? null);
  }, [params]);

  const handleDecimalInputChange = (value: string, onChange: (val: number | string | null) => void) => {
    if (value === "") {
      onChange(null);
      return;
    }
    const regex = /^(?:\d+)?(?:\.\d{0,2})?$/;
    if (regex.test(value)) {
      if (value === "." || value.endsWith(".")) {
        onChange(value);
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
          onChange(numValue);
        }
      }
    }
  };

  const handleBlurFormatting = (value: number | string | null | undefined, onChange: (val: number | null) => void) => {
    let numValue = 0;
    if (typeof value === "string") {
      numValue = value === "." ? 0 : (parseFloat(value) || 0);
    } else if (typeof value === "number") {
      numValue = value;
    } else {
      onChange(null);
      return;
    }
    onChange(Math.max(0, parseFloat(numValue.toFixed(2))));
  };

  const handleUpdateResults = () => {
    // CRITICAL: Always include the current strategy in params
    const baseParams = {
      ...params,
      strategy: strategy, // Ensure strategy is ALWAYS included
      stopPercentage: typeof stopPercentage === 'number' ? Number(stopPercentage.toFixed(2)) : Number(stopPercentage) || 0,
      initialCapital: initialCapital !== null ? Number(initialCapital) : 0
    };

    console.info(`[StrategySetupPanel] Updating with strategy: ${strategy}`);

    switch (strategy) {
      case 'entry-percentage':
        onUpdateParams({
          ...baseParams,
          referencePrice: refPrice,
          entryPercentage: typeof entryPercentage === 'number' ? Number(entryPercentage.toFixed(2)) : Number(entryPercentage) || 0,
        });
        break;
      case 'breakout':
        onUpdateParams({
          ...baseParams,
          entryPercentage: typeof bufferPercentage === 'number' ? Number(bufferPercentage.toFixed(2)) : Number(bufferPercentage) || 0,
          breakoutBuffer: typeof bufferPercentage === 'number' ? Number(bufferPercentage.toFixed(2)) : Number(bufferPercentage) || 0,
        });
        break;
      case 'gap-trading':
        onUpdateParams({
          ...baseParams,
          referencePrice: gapMode,
          entryPercentage: typeof minGapPercent === 'number' ? Number(minGapPercent.toFixed(2)) : Number(minGapPercent) || 0,
          minGapPercent: typeof minGapPercent === 'number' ? Number(minGapPercent.toFixed(2)) : Number(minGapPercent) || 0,
          gapMode: gapMode === 'open' ? 'continuation' : 'fade',
        });
        break;
      case 'intraday-oversold':
        onUpdateParams({
          ...baseParams,
          entryPercentage: typeof dropPercentage === 'number' ? Number(dropPercentage.toFixed(2)) : Number(dropPercentage) || 0,
          oversoldThreshold: typeof dropPercentage === 'number' ? Number(dropPercentage.toFixed(2)) : Number(dropPercentage) || 0,
        });
        break;
      case 'range-compression':
        onUpdateParams({
          ...baseParams,
          initialInvestment: lookbackDays,
          entryPercentage: typeof compressionRatio === 'number' ? Number(compressionRatio.toFixed(2)) : Number(compressionRatio) || 0,
          lookbackDays: lookbackDays,
          compressionRatio: typeof compressionRatio === 'number' ? Number(compressionRatio.toFixed(2)) : Number(compressionRatio) || 0,
        });
        break;
      case 'volume-spike':
        onUpdateParams({
          ...baseParams,
          initialInvestment: volumeLookback,
          entryPercentage: typeof volumeMultiplier === 'number' ? Number(volumeMultiplier.toFixed(2)) : Number(volumeMultiplier) || 0,
          volumeLookback: volumeLookback,
          volumeMultiplier: typeof volumeMultiplier === 'number' ? Number(volumeMultiplier.toFixed(2)) : Number(volumeMultiplier) || 0,
        });
        break;
      case 'price-volume-divergence':
        onUpdateParams({
          ...baseParams,
          entryPercentage: typeof priceMoveThreshold === 'number' ? Number(priceMoveThreshold.toFixed(2)) : Number(priceMoveThreshold) || 0,
          stopPercentage: typeof volumeDropRatio === 'number' ? Number(volumeDropRatio.toFixed(2)) : Number(volumeDropRatio) || 0,
          priceMoveThreshold: typeof priceMoveThreshold === 'number' ? Number(priceMoveThreshold.toFixed(2)) : Number(priceMoveThreshold) || 0,
          volumeDropRatio: typeof volumeDropRatio === 'number' ? Number(volumeDropRatio.toFixed(2)) : Number(volumeDropRatio) || 0,
        });
        break;
      default:
        onUpdateParams(baseParams);
    }
  };

  // Retorna o título do painel baseado na estratégia
  const getPanelTitle = () => {
    switch (strategy) {
      case 'entry-percentage': return 'Entry % Setup';
      case 'breakout': return 'Breakout Setup';
      case 'gap-trading': return 'Gap Trading Setup';
      case 'intraday-oversold': return 'Oversold Setup';
      case 'range-compression': return 'Range Setup';
      case 'volume-spike': return 'Volume Setup';
      case 'price-volume-divergence': return 'Divergence Setup';
      default: return 'Strategy Setup';
    }
  };

  // Renderiza os campos específicos de cada estratégia
  const renderStrategyFields = () => {
    switch (strategy) {
      case 'entry-percentage':
        return (
          <>
            <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'space-y-3 md:space-y-4'}`}>
              <div>
                <label className="block text-xs md:text-sm font-medium mb-1">Reference Price</label>
                <Select value={refPrice} onValueChange={(v) => setRefPrice(v)} disabled={isLoading}>
                  <SelectTrigger className="h-9 md:h-10">
                    <SelectValue placeholder="Select price" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Previous day's open</SelectItem>
                    <SelectItem value="high">Previous day's high</SelectItem>
                    <SelectItem value="low">Previous day's low</SelectItem>
                    <SelectItem value="close">Previous day's close</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium mb-1">Entry Price (%)</label>
                <div className="flex items-center">
                  <Input 
                    type="text"
                    inputMode="decimal"
                    value={isEntryPriceFocused 
                      ? (entryPercentage === null ? '' : String(entryPercentage)) 
                      : (typeof entryPercentage === 'number' ? entryPercentage.toFixed(2) : '')}
                    onChange={(e) => handleDecimalInputChange(e.target.value, setEntryPercentage)}
                    onFocus={() => setIsEntryPriceFocused(true)}
                    onBlur={() => {
                      handleBlurFormatting(entryPercentage, setEntryPercentage);
                      setIsEntryPriceFocused(false);
                    }}
                    disabled={isLoading}
                    placeholder="1.50"
                    className="h-9 md:h-10 text-sm"
                  />
                  <span className="ml-2 text-xs md:text-sm">%</span>
                </div>
              </div>
            </div>
          </>
        );

      case 'breakout':
        return (
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1">Buffer (%)</label>
            <div className="flex items-center">
              <Input 
                type="text"
                inputMode="decimal"
                value={typeof bufferPercentage === 'number' ? bufferPercentage.toFixed(2) : ''}
                onChange={(e) => handleDecimalInputChange(e.target.value, setBufferPercentage)}
                onBlur={() => handleBlurFormatting(bufferPercentage, setBufferPercentage)}
                disabled={isLoading}
                placeholder="0.10"
                className="h-9 md:h-10 text-sm"
              />
              <span className="ml-2 text-xs md:text-sm">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">% above/below previous high/low</p>
          </div>
        );

      case 'gap-trading':
        return (
          <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'space-y-3 md:space-y-4'}`}>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Min Gap (%)</label>
              <div className="flex items-center">
                <Input 
                  type="text"
                  inputMode="decimal"
                  value={typeof minGapPercent === 'number' ? minGapPercent.toFixed(2) : ''}
                  onChange={(e) => handleDecimalInputChange(e.target.value, setMinGapPercent)}
                  onBlur={() => handleBlurFormatting(minGapPercent, setMinGapPercent)}
                  disabled={isLoading}
                  placeholder="1.00"
                  className="h-9 md:h-10 text-sm"
                />
                <span className="ml-2 text-xs md:text-sm">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Gap Mode</label>
              <Select value={gapMode} onValueChange={setGapMode} disabled={isLoading}>
                <SelectTrigger className="h-9 md:h-10">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="close">Fade (Reversal)</SelectItem>
                  <SelectItem value="open">Continuation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'intraday-oversold':
        return (
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1">Drop (%)</label>
            <div className="flex items-center">
              <Input 
                type="text"
                inputMode="decimal"
                value={typeof dropPercentage === 'number' ? dropPercentage.toFixed(2) : ''}
                onChange={(e) => handleDecimalInputChange(e.target.value, setDropPercentage)}
                onBlur={() => handleBlurFormatting(dropPercentage, setDropPercentage)}
                disabled={isLoading}
                placeholder="2.00"
                className="h-9 md:h-10 text-sm"
              />
              <span className="ml-2 text-xs md:text-sm">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Min % drop from open to trigger</p>
          </div>
        );

      case 'range-compression':
        return (
          <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'space-y-3 md:space-y-4'}`}>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Lookback Days</label>
              <Input 
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value) || 5)}
                disabled={isLoading}
                min={3}
                max={20}
                className="h-9 md:h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Compression Ratio</label>
              <div className="flex items-center">
                <Input 
                  type="text"
                  inputMode="decimal"
                  value={typeof compressionRatio === 'number' ? compressionRatio.toFixed(2) : ''}
                  onChange={(e) => handleDecimalInputChange(e.target.value, setCompressionRatio)}
                  onBlur={() => handleBlurFormatting(compressionRatio, setCompressionRatio)}
                  disabled={isLoading}
                  placeholder="0.50"
                  className="h-9 md:h-10 text-sm"
                />
                <span className="ml-2 text-xs md:text-sm">%</span>
              </div>
            </div>
          </div>
        );

      case 'volume-spike':
        return (
          <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'space-y-3 md:space-y-4'}`}>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Volume Multiplier (X)</label>
              <Input 
                type="text"
                inputMode="decimal"
                value={typeof volumeMultiplier === 'number' ? volumeMultiplier.toFixed(2) : ''}
                onChange={(e) => handleDecimalInputChange(e.target.value, setVolumeMultiplier)}
                onBlur={() => handleBlurFormatting(volumeMultiplier, setVolumeMultiplier)}
                disabled={isLoading}
                placeholder="2.00"
                className="h-9 md:h-10 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Lookback Days</label>
              <Input 
                type="number"
                value={volumeLookback}
                onChange={(e) => setVolumeLookback(parseInt(e.target.value) || 20)}
                disabled={isLoading}
                min={5}
                max={50}
                className="h-9 md:h-10 text-sm"
              />
            </div>
          </div>
        );

      case 'price-volume-divergence':
        return (
          <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'space-y-3 md:space-y-4'}`}>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Price Move (%)</label>
              <div className="flex items-center">
                <Input 
                  type="text"
                  inputMode="decimal"
                  value={typeof priceMoveThreshold === 'number' ? priceMoveThreshold.toFixed(2) : ''}
                  onChange={(e) => handleDecimalInputChange(e.target.value, setPriceMoveThreshold)}
                  onBlur={() => handleBlurFormatting(priceMoveThreshold, setPriceMoveThreshold)}
                  disabled={isLoading}
                  placeholder="2.00"
                  className="h-9 md:h-10 text-sm"
                />
                <span className="ml-2 text-xs md:text-sm">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Volume Drop Ratio</label>
              <div className="flex items-center">
                <Input 
                  type="text"
                  inputMode="decimal"
                  value={typeof volumeDropRatio === 'number' ? volumeDropRatio.toFixed(2) : ''}
                  onChange={(e) => handleDecimalInputChange(e.target.value, setVolumeDropRatio)}
                  onBlur={() => handleBlurFormatting(volumeDropRatio, setVolumeDropRatio)}
                  disabled={isLoading}
                  placeholder="0.70"
                  className="h-9 md:h-10 text-sm"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={ref} className={`${isMobile ? 'order-2' : 'md:col-span-1 h-[460px]'} bg-card rounded-lg border p-3 md:p-4 flex flex-col`}>
      <h3 className="text-base md:text-lg font-medium mb-3 md:mb-4">{getPanelTitle()}</h3>
      <div className="space-y-3 md:space-y-4 flex-1">
        {/* Campos específicos da estratégia */}
        {renderStrategyFields()}
        
        {/* Campos comuns: Stop % e Initial Capital (exceto para price-volume-divergence que usa stop como volumeDropRatio) */}
        <div className={`${isMobile ? 'grid grid-cols-2 gap-3' : 'space-y-3 md:space-y-4'}`}>
          {strategy !== 'price-volume-divergence' && (
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Stop (%)</label>
              <div className="flex items-center">
                <Input 
                  type="text"
                  inputMode="decimal"
                  value={isStopPriceFocused 
                    ? (stopPercentage === null ? '' : String(stopPercentage)) 
                    : (typeof stopPercentage === 'number' ? stopPercentage.toFixed(2) : '')}
                  onChange={(e) => handleDecimalInputChange(e.target.value, setStopPercentage)}
                  onFocus={() => setIsStopPriceFocused(true)}
                  onBlur={() => {
                    handleBlurFormatting(stopPercentage, setStopPercentage);
                    setIsStopPriceFocused(false);
                  }}
                  disabled={isLoading}
                  placeholder="2.00"
                  className="h-9 md:h-10 text-sm"
                />
                <span className="ml-2 text-xs md:text-sm">%</span>
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-xs md:text-sm font-medium mb-1">Initial Capital ($)</label>
            <Input 
              type="text"
              value={initialCapital ? initialCapital.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, '.') : ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  setInitialCapital(null);
                  return;
                }
                const cleanValue = value.replace(/\./g, '');
                if (cleanValue.startsWith('-')) return;
                const regex = /^\d*$/;
                if (regex.test(cleanValue)) {
                  const numValue = parseInt(cleanValue) || null;
                  setInitialCapital(numValue);
                }
              }}
              disabled={isLoading}
              placeholder="10.000"
              className="h-9 md:h-10 text-sm"
            />
          </div>
        </div>
      </div>
      
      <Button 
        onClick={handleUpdateResults} 
        className="w-full h-9 md:h-10 text-sm md:text-base mt-4" 
        disabled={isLoading}
      >
        {isLoading ? 'Updating...' : 'Update Results'}
      </Button>
    </div>
  );
}
