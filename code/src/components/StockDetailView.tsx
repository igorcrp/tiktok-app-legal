import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailedResult, StockAnalysisParams } from "@/types";
import { ArrowLeft, Loader2 } from "lucide-react";
import { StockDetailsTable } from "@/components/StockDetailsTable";
import { useIsMobile } from "@/hooks/use-mobile";
import { StrategyType } from "@/services/strategyService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface StockDetailViewProps {
  result: DetailedResult;
  params: StockAnalysisParams;
  onClose: () => void;
  onUpdateParams: (params: StockAnalysisParams) => void;
  isLoading?: boolean;
  strategy?: StrategyType;
}

export function StockDetailView({
  result,
  params,
  onClose,
  onUpdateParams,
  isLoading = false,
  strategy = 'entry-percentage'
}: StockDetailViewProps) {
  const isMobile = useIsMobile();
  
  const correctedValues = useMemo(() => {
    if (!result?.tradeHistory?.length) return null;
    
    const sortedHistory = [...result.tradeHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const lastTrade = sortedHistory[sortedHistory.length - 1];
    const finalCapital = lastTrade?.currentCapital ?? params.initialCapital;
    const totalProfit = finalCapital - params.initialCapital;
    
    return {
      ...result,
      finalCapital,
      profit: totalProfit
    };
  }, [result, params.initialCapital]);

  const finalCapital = (correctedValues?.finalCapital ?? result.finalCapital) || 0;
  const profit = (correctedValues?.profit ?? result.profit) || 0;

  // ── Mobile KPI Cards ──
  const MobileKPICards = () => (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-card border rounded-lg p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Final Capital</span>
        <p className="text-base font-bold mt-0.5">${finalCapital.toLocaleString()}</p>
      </div>
      <div className="bg-card border rounded-lg p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Profit</span>
        <p className={`text-base font-bold mt-0.5 ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          ${profit.toLocaleString()}
        </p>
      </div>
      <div className="bg-card border rounded-lg p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</span>
        <p className="text-base font-bold mt-0.5">{(result.successRate || 0).toFixed(1)}%</p>
      </div>
      <div className="bg-card border rounded-lg p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Drawdown</span>
        <p className="text-base font-bold mt-0.5 text-red-600 dark:text-red-400">{(result.maxDrawdown || 0).toFixed(2)}%</p>
      </div>
    </div>
  );

  // ── Mobile Metrics Tabs ──
  const MobileMetricsTabs = () => (
    <Tabs defaultValue="performance" className="w-full">
      <TabsList className="w-full grid grid-cols-3 h-9">
        <TabsTrigger value="performance" className="text-xs px-1">Performance</TabsTrigger>
        <TabsTrigger value="statistics" className="text-xs px-1">Statistics</TabsTrigger>
        <TabsTrigger value="risk" className="text-xs px-1">Risk</TabsTrigger>
      </TabsList>
      
      <TabsContent value="performance" className="mt-3 space-y-2">
        <MetricRow label="Total Return" value={`${((profit / (params.initialCapital || 1)) * 100).toFixed(2)}%`} color={profit > 0} />
        <MetricRow label="Annualized Return" value={`${((Math.pow(finalCapital / (params.initialCapital || 1), 252 / (result.tradingDays || 1)) - 1) * 100).toFixed(2)}%`} />
        <MetricRow label="Success Rate" value={`${(result.successRate || 0).toFixed(2)}%`} />
        <MetricRow label="Risk-Free Rate" value="2.00%" />
      </TabsContent>

      <TabsContent value="statistics" className="mt-3 space-y-2">
        <MetricRow label="Total Trades" value={`${result.trades}`} />
        <MetricRow label="Profitable" value={`${result.profits || 0} (${(result.profitPercentage || 0).toFixed(1)}%)`} colorClass="text-green-600 dark:text-green-400" />
        <MetricRow label="Losses" value={`${result.losses || 0} (${(result.lossPercentage || 0).toFixed(1)}%)`} colorClass="text-red-600 dark:text-red-400" />
        <MetricRow label="Profit Factor" value={`${((result.profits || 0) > 0 ? ((result.profits || 0) * (result.averageGain || 0)) / ((result.losses || 1) * Math.abs(result.averageLoss || 1)) : 0).toFixed(2)}`} />
        <MetricRow label="Avg Win/Loss" value={`${((result.averageGain || 0) / Math.abs(result.averageLoss || 1)).toFixed(2)}`} />
      </TabsContent>

      <TabsContent value="risk" className="mt-3 space-y-2">
        <MetricRow label="Volatility" value={`${calcVolatility()}%`} />
        <MetricRow label="Max Drawdown" value={`${(result.maxDrawdown || 0).toFixed(2)}%`} />
        <MetricRow label="Recovery Factor" value={`${(result.recoveryFactor || 0).toFixed(2)}`} />
        <MetricRow label="Sharpe Ratio" value={`${(result.sharpeRatio || 0).toFixed(2)}`} />
        <MetricRow label="Sortino Ratio" value={`${(result.sortinoRatio || 0).toFixed(2)}`} />
        <MetricRow label="Calmar Ratio" value={`${(((profit / (params.initialCapital || 1)) * 100) / (result.maxDrawdown || 1)).toFixed(2)}`} />
      </TabsContent>
    </Tabs>
  );

  function calcVolatility(): string {
    const trades = result.tradeHistory || [];
    if (trades.length < 2) return '0.00';
    const returns = trades.map(trade => {
      const pl = trade.profitLoss || 0;
      const entryValue = (trade.currentCapital || params.initialCapital) - pl;
      return entryValue > 0 ? (pl / entryValue) * 100 : 0;
    });
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);
    return (Math.sqrt(variance) * Math.sqrt(252)).toFixed(2);
  }

  // ── Reusable metric row ──
  function MetricRow({ label, value, color, colorClass }: { label: string; value: string; color?: boolean; colorClass?: string }) {
    const cls = colorClass || (color === true ? 'text-green-600 dark:text-green-400' : color === false ? 'text-red-600 dark:text-red-400' : '');
    return (
      <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-semibold ${cls}`}>{value}</span>
      </div>
    );
  }

  // ── Desktop Metrics (unchanged) ──
  const DesktopMetrics = () => (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-4 py-3 border-b">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          Performance Metrics
        </h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-10">
          {/* Returns */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium mb-2 border-b pb-2 text-primary">Returns</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Final Capital</span>
                <span className="text-sm font-medium">${finalCapital.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Profit</span>
                <span className={`text-sm font-medium ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${profit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="text-sm font-medium">{(result.successRate || 0).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Return</span>
                <span className={`text-sm font-medium ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {((profit / (params.initialCapital || 1)) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Annualized Return</span>
                <span className="text-sm font-medium">
                  {((Math.pow(finalCapital / (params.initialCapital || 1), 252 / (result.tradingDays || 1)) - 1) * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Risk-Free Rate</span>
                <span className="text-sm font-medium">2.00%</span>
              </div>
            </div>
          </div>
          
          {/* Trade Statistics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium mb-2 border-b pb-2 text-primary">Trade Statistics</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Trades</span>
                <span className="text-sm font-medium">{result.trades}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profitable</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">{result.profits || 0} ({(result.profitPercentage || 0).toFixed(2)}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Losses</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">{result.losses || 0} ({(result.lossPercentage || 0).toFixed(2)}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Win Rate</span>
                <span className="text-sm font-medium">{(result.successRate || 0).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profit Factor</span>
                <span className="text-sm font-medium">
                  {((result.profits || 0) > 0
                    ? ((result.profits || 0) * (result.averageGain || 0)) / ((result.losses || 1) * Math.abs(result.averageLoss || 1))
                    : 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average Win/Loss Ratio</span>
                <span className="text-sm font-medium">
                  {((result.averageGain || 0) / Math.abs(result.averageLoss || 1)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Risk Metrics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium mb-2 border-b pb-2 text-primary">Risk Metrics</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Volatility</span>
                <span className="text-sm font-medium">{calcVolatility()}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Max Drawdown</span>
                <span className="text-sm font-medium">{(result.maxDrawdown || 0).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Recovery Factor</span>
                <span className="text-sm font-medium">{(result.recoveryFactor || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {/* Risk-Adjusted Returns */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium mb-2 border-b pb-2 text-primary">Risk-Adjusted Returns</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                <span className="text-sm font-medium">{(result.sharpeRatio || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sortino Ratio</span>
                <span className="text-sm font-medium">{(result.sortinoRatio || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Calmar Ratio</span>
                <span className="text-sm font-medium">
                  {(((profit / (params.initialCapital || 1)) * 100) / (result.maxDrawdown || 1)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Trading Summary - Desktop inline, Mobile accordion */}
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Trading Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This analysis for <strong className="text-foreground">{result.assetCode}</strong> uses a 
            {params.operation === 'buy' ? ' buying' : ' selling'} strategy with 
            {params.entryPercentage}% entry and {params.stopPercentage}% stop parameters.
            The analysis covers {result.tradingDays} trading days with an initial capital of 
            ${(params.initialCapital || 0).toLocaleString()}. The strategy resulted in {result.trades || 0} trades ({(result.tradePercentage || 0).toFixed(2)}% of days), 
            with {result.profits || 0} profitable trades and {result.losses || 0} losing trades. 
            Stop-loss was triggered on {result.stops || 0} occasions ({(result.stopPercentage || 0).toFixed(2)}% of trades). The final capital of ${finalCapital.toLocaleString()} represents a 
            {profit > 0 ? ' profit' : ' loss'} of ${Math.abs(profit).toLocaleString()}, with an average gain of ${(result.averageGain || 0).toFixed(2)} and average loss of ${(result.averageLoss || 0).toFixed(2)}.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="pb-2 mb-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClose} 
            className="border-cyan-500/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {isMobile ? 'Back' : 'Back to Results'}
          </Button>
          <h2 className="text-lg md:text-xl font-bold">
            {result.assetCode}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 md:space-y-6">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {isMobile ? (
              /* ── MOBILE LAYOUT ── */
              <>
                {/* KPI Cards 2x2 */}
                <MobileKPICards />

                {/* Metrics Tabs */}
                <div className="bg-card border rounded-lg p-3">
                  <MobileMetricsTabs />
                </div>

                {/* Trading Summary - Accordion */}
                <div className="bg-card border rounded-lg overflow-hidden">
                  <Accordion type="single" collapsible>
                    <AccordionItem value="summary" className="border-0">
                      <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold hover:no-underline">
                        Ver Resumo da Estratégia
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">{result.assetCode}</strong> — 
                          {params.operation === 'buy' ? ' Buy' : ' Sell'} strategy, {params.entryPercentage}% entry, {params.stopPercentage}% stop. 
                          {result.tradingDays} days, ${(params.initialCapital || 0).toLocaleString()} initial. 
                          {result.trades || 0} trades ({result.profits || 0}W / {result.losses || 0}L). 
                          {result.stops || 0} stops. Final: ${finalCapital.toLocaleString()} ({profit > 0 ? '+' : ''}{((profit / (params.initialCapital || 1)) * 100).toFixed(1)}%).
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </>
            ) : (
              /* ── DESKTOP LAYOUT (unchanged) ── */
              <>
                <DesktopMetrics />

                {/* Trading Summary already included in DesktopMetrics */}
              </>
            )}

            {/* Trade History Card - both layouts */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Trade History Details
                </h3>
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  {result.tradeHistory?.length || 0} records
                </span>
              </div>
              
              <div className="p-2 md:p-4">
                <StockDetailsTable 
                  result={result}
                  params={params}
                  onUpdateParams={onUpdateParams}
                  isLoading={isLoading}
                  strategy={strategy}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
