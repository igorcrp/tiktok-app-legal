import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { StockAnalysisParams } from "@/types";
import { StrategyType, getStrategy } from "@/services/strategyService";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface StrategyParameterFieldsProps {
  form: UseFormReturn<StockAnalysisParams>;
  strategy: StrategyType;
  isLoading: boolean;
  isOptionsLoading: boolean;
}

export function StrategyParameterFields({
  form,
  strategy,
  isLoading,
  isOptionsLoading
}: StrategyParameterFieldsProps) {
  const { isSubscribed } = useSubscription();
  const currentStrategy = getStrategy(strategy);
  
  // Helper to handle decimal input - allows typing values that appear as user types
  const handleDecimalInputChange = (value: string, onChange: (val: string) => void) => {
    if (value === "") {
      onChange("");
      return;
    }
    if (value.startsWith('-')) {
      return;
    }
    // Allow numbers, optionally with one decimal point, and up to 2 decimal places
    // Also allows trailing '.' for continuous typing (e.g., "1.")
    const regex = /^\d*\.?\d{0,2}$/;
    if (regex.test(value)) {
      onChange(value);
    }
  };

  const handleBlurFormatting = (value: number | string | null | undefined, onChange: (val: number) => void) => {
    let numValue = 0;
    if (typeof value === 'string') {
      numValue = parseFloat(value) || 0;
    } else if (typeof value === 'number') {
      numValue = value;
    }
    onChange(Math.max(0, parseFloat(numValue.toFixed(2))));
  };

  // Common fields that all strategies use
  const renderPeriodField = () => (
    <FormField
      control={form.control}
      name="period"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel>Period</FormLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Time period for historical data analysis</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select 
            disabled={isLoading || isOptionsLoading} 
            onValueChange={field.onChange}
            defaultValue={field.value}
          >
            <FormControl>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="1m">1 Month</SelectItem>
              <SelectItem value="3m" disabled={!isSubscribed} className={!isSubscribed ? "opacity-50" : ""}>
                3 Months
              </SelectItem>
              <SelectItem value="6m" disabled={!isSubscribed} className={!isSubscribed ? "opacity-50" : ""}>
                6 Months
              </SelectItem>
              <SelectItem value="1y" disabled={!isSubscribed} className={!isSubscribed ? "opacity-50" : ""}>
                1 Year
              </SelectItem>
              <SelectItem value="2y" disabled={!isSubscribed} className={!isSubscribed ? "opacity-50" : ""}>
                2 Years
              </SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // Reference price field - used by entry-percentage
  const renderReferencePriceField = () => (
    <FormField
      control={form.control}
      name="referencePrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel>Reference Price</FormLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Previous day's Reference Price used to calculate the trade entry</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select 
            disabled={isLoading || isOptionsLoading} 
            onValueChange={field.onChange}
            defaultValue={field.value}
          >
            <FormControl>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Reference price" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="open">Previous day's open</SelectItem>
              <SelectItem value="high">Previous day's high</SelectItem>
              <SelectItem value="low">Previous day's low</SelectItem>
              <SelectItem value="close">Previous day's close</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // Stop percentage field - used by all strategies
  const renderStopPercentageField = () => (
    <FormField
      control={form.control}
      name="stopPercentage"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel>% Stop</FormLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Stop loss percentage to limit losses</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <FormControl>
            <div className="relative">
              <Input 
                type="text"
                inputMode="decimal"
                disabled={isLoading || isOptionsLoading}
                value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                className="pr-8 h-9 text-sm"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // Entry percentage field - used by entry-percentage strategy
  const renderEntryPercentageField = () => (
    <FormField
      control={form.control}
      name="entryPercentage"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-2">
            <FormLabel>% Entry Price</FormLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>What percentage of the Reference Price do you want to buy or sell</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <FormControl>
            <div className="relative">
              <Input 
                type="text"
                inputMode="decimal"
                disabled={isLoading || isOptionsLoading}
                value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                className="pr-8 h-9 text-sm"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  // Render strategy-specific parameters based on strategy type
  const renderStrategySpecificFields = () => {
    switch (strategy) {
      case 'entry-percentage':
        return (
          <>
            {renderReferencePriceField()}
            {renderPeriodField()}
            {renderEntryPercentageField()}
            {renderStopPercentageField()}
          </>
        );

      case 'breakout':
        return (
          <>
            {renderPeriodField()}
            <FormField
              control={form.control}
              name="entryPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Buffer %</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Additional % above/below previous high/low to confirm breakout</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {renderStopPercentageField()}
          </>
        );

      case 'gap-trading':
        return (
          <>
            {renderPeriodField()}
            <FormField
              control={form.control}
              name="entryPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Min Gap %</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum gap size to trigger a trade</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referencePrice"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Gap Mode</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Fade: bet gap closes. Continuation: bet gap extends.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select 
                    disabled={isLoading || isOptionsLoading} 
                    onValueChange={field.onChange}
                    defaultValue="close"
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="close">Fade (Reversal)</SelectItem>
                      <SelectItem value="open">Continuation</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {renderStopPercentageField()}
          </>
        );

      case 'intraday-oversold':
        return (
          <>
            {renderPeriodField()}
            <FormField
              control={form.control}
              name="entryPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Drop %</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum % drop from open to trigger entry</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {renderStopPercentageField()}
          </>
        );

      case 'range-compression':
        return (
          <>
            {renderPeriodField()}
            <FormField
              control={form.control}
              name="initialInvestment"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Lookback Days</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Days to calculate average range</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <Input 
                      type="number"
                      disabled={isLoading || isOptionsLoading}
                      value={field.value || 5}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                      className="h-9 text-sm"
                      min={3}
                      max={20}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="entryPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Compression Ratio</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Current range must be below this % of average range</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {renderStopPercentageField()}
          </>
        );

      case 'volume-spike':
        return (
          <>
            {renderPeriodField()}
            <FormField
              control={form.control}
              name="entryPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Volume Multiplier</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Volume must be X times the average to trigger</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">x</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="initialInvestment"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Volume Lookback</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Days to calculate average volume</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <Input 
                      type="number"
                      disabled={isLoading || isOptionsLoading}
                      value={field.value || 20}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 20)}
                      className="h-9 text-sm"
                      min={5}
                      max={50}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {renderStopPercentageField()}
          </>
        );

      case 'price-volume-divergence':
        return (
          <>
            {renderPeriodField()}
            <FormField
              control={form.control}
              name="entryPercentage"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Price Move %</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum price move to check divergence</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stopLoss"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Volume Drop Ratio</FormLabel>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Volume must be below this ratio of average</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="text"
                        inputMode="decimal"
                        disabled={isLoading || isOptionsLoading}
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                        onChange={(e) => handleDecimalInputChange(e.target.value, field.onChange)}
                        onBlur={() => handleBlurFormatting(field.value, field.onChange)}
                        className="pr-8 h-9 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">x</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {renderStopPercentageField()}
          </>
        );

      default:
        return (
          <>
            {renderReferencePriceField()}
            {renderPeriodField()}
            {renderEntryPercentageField()}
            {renderStopPercentageField()}
          </>
        );
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-tour="strategy-config">
      {renderStrategySpecificFields()}
    </div>
  );
}
