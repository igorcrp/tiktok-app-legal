import { useState, useMemo, useRef, useEffect } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { ResponsiveContainer, Tooltip as ChartTooltip, Area, AreaChart, YAxis } from "recharts";
import { DetailedResult, TradeHistoryItem, StockAnalysisParams } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getNextBusinessDay } from "@/utils/dateUtils";
import { StrategyType } from "@/services/strategyService";
import { StrategySetupPanel } from "@/components/details/StrategySetupPanel";
import { getColumnsForStrategy, getSuggestedEntryLabel } from "@/components/details/StrategyColumns";

interface StockDetailsTableProps {
  result: DetailedResult;
  params: StockAnalysisParams & { interval?: string };
  onUpdateParams: (params: StockAnalysisParams) => void;
  isLoading?: boolean;
  strategy?: StrategyType;
}

export function StockDetailsTable({
  result,
  params,
  onUpdateParams,
  isLoading = false,
  strategy = 'entry-percentage'
}: StockDetailsTableProps) {
  // State management
  const [sortField, setSortField] = useState<keyof TradeHistoryItem>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Estados para os valores usados nos cálculos
  const [appliedEntryPercentage, setAppliedEntryPercentage] = useState(params.entryPercentage ?? 0);
  const [appliedStopPercentage, setAppliedStopPercentage] = useState(params.stopPercentage ?? 0);

  const setupPanelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Colunas dinâmicas baseadas na estratégia
  const columns = useMemo(() => getColumnsForStrategy(strategy), [strategy]);
  const suggestedEntryLabel = getSuggestedEntryLabel(strategy);

  // Sincronizar estados quando params mudam
  useEffect(() => {
    setAppliedEntryPercentage(params.entryPercentage ?? 0);
    setAppliedStopPercentage(params.stopPercentage ?? 0);
  }, [params.entryPercentage, params.stopPercentage]);

  // Calculate next day prediction values
  const nextDayPrediction = useMemo(() => {
    if (!result?.tradeHistory?.length || params.stockMarket === "CRYPTO") return null;
    
    const sortedHistory = [...result.tradeHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const lastTrade = sortedHistory[sortedHistory.length - 1];
    if (!lastTrade) return null;
    
    const [year, month, day] = lastTrade.date.split('-').map(Number);
    const lastDate = new Date(year, month - 1, day);
    const nextDate = getNextBusinessDay(lastDate);
    
    const currentOperation = params.operation || 'buy';
    const currentEntryPercentage = Number(appliedEntryPercentage) || 0;
    const lastClosePrice = Number(lastTrade.exitPrice) || 0;
    
    if (lastClosePrice <= 0) return null;
    
    const entryPercent = currentEntryPercentage / 100;
    let suggestedEntry = 0;
    
    if (currentOperation.toLowerCase() === 'buy') {
      suggestedEntry = lastClosePrice - (lastClosePrice * entryPercent);
    } else if (currentOperation.toLowerCase() === 'sell') {
      suggestedEntry = lastClosePrice + (lastClosePrice * entryPercent);
    }
    
    const currentStopPercentage = Number(appliedStopPercentage) || 0;
    const stopPercent = currentStopPercentage / 100;
    let stopPrice = 0;
    
    if (currentOperation.toLowerCase() === 'buy') {
      stopPrice = suggestedEntry - (suggestedEntry * stopPercent);
    } else if (currentOperation.toLowerCase() === 'sell') {
      stopPrice = suggestedEntry + (suggestedEntry * stopPercent);
    }
    
    return {
      date: nextDate.toISOString().split('T')[0],
      suggestedEntryPrice: suggestedEntry,
      stopPrice: stopPrice,
      isNextDayPrediction: true
    };
  }, [result, params.stockMarket, params.operation, appliedEntryPercentage, appliedStopPercentage]);

  // Process and sort data
  const processedData = useMemo(() => {
    if (!result?.tradeHistory?.length) return [];
    
    const sortedHistory = [...result.tradeHistory].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const data = sortedHistory.map((item) => ({
      ...item,
      suggestedEntryPrice: item.suggestedEntryPrice || 0,
      actualPrice: item.actualPrice || "-",
      trade: item.trade || "-", 
      stopPrice: item.stopPrice || 0,
      stopTrigger: item.stopTrigger || "-",
      currentCapital: item.currentCapital || 0,
      profitLoss: item.profitLoss || 0,
      lotSize: item.lotSize || 0
    }));

    return [...data].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (sortField === "date") {
        const dateA = new Date(valA as string);
        const dateB = new Date(valB as string);
        return sortDirection === "asc" 
          ? dateA.getTime() - dateB.getTime() 
          : dateB.getTime() - dateA.getTime();
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [result, sortField, sortDirection]);

  // Chart data
  const chartData = useMemo(() => {
    if (!processedData.length) return [];
    
    const sortedForChart = [...processedData].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    
    return sortedForChart.map((item) => ({
      date: item.date,
      capital: item.currentCapital || 0
    }));
  }, [processedData]);

  // Trade value formatting with colors
  function formatTradeValue(trade: string) {
    if (typeof trade !== "string" || !trade) return <span>-</span>;

    if (trade.includes("/")) {
      const [firstPart, secondPart] = trade.split("/");
      return (
        <>
          <span className={firstPart === "Buy" ? "text-green-600" : firstPart === "Sell" ? "text-red-600" : ""}>
            {firstPart}
          </span>
          <span>/</span>
          <span className={secondPart === "Closed" ? "text-yellow-600" : ""}>
            {secondPart}
          </span>
        </>
      );
    }
    return (
      <span className={
        trade === "Buy" ? "text-green-600" : 
        trade === "Sell" ? "text-red-600" : 
        trade === "Closed" ? "text-yellow-600" : ""
      }>
        {trade}
      </span>
    );
  }

  // Pagination
  const totalItems = processedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const currentData = processedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handlers
  const handleSortChange = (field: keyof TradeHistoryItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  // Formatting functions
  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null) return "-";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPrice = (amount: number | undefined | null): string => {
    if (amount === undefined || amount === null) return "-";
    if (params.stockMarket === "CRYPTO") return amount.toFixed(6);
    return amount.toFixed(2);
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "-";
    try {
      const date = new Date(`${dateString}T00:00:00Z`);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      if (isNaN(date.getTime())) return dateString;
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const getSortIcon = (field: keyof TradeHistoryItem) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" 
      ? <ChevronUp className="h-4 w-4 ml-1" /> 
      : <ChevronDown className="h-4 w-4 ml-1" />;
  };

  if (!processedData.length && !isLoading) {
    return (
      <Alert className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No data available</AlertTitle>
        <AlertDescription>
          No trade history data is available for the selected stock with the current parameters.
        </AlertDescription>
      </Alert>
    );
  }

  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false);

  return (
    <div className="w-full flex flex-col gap-4 md:gap-6">
      {/* Chart and Setup Panel */}
      <div className={`${isMobile ? 'space-y-3' : 'grid md:grid-cols-4 gap-4'}`}>
        {/* Capital Evolution Chart */}
        <div className={`${isMobile ? '' : 'md:col-span-3'} bg-card rounded-lg border p-3 md:p-4`}>
          <h3 className="text-sm md:text-lg font-medium mb-2 md:mb-4">Capital Evolution</h3>
          <div style={{ width: '100%', height: isMobile ? '180px' : '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={isMobile ? { top: 5, right: 10, left: 0, bottom: 5 } : { top: 5, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <ChartTooltip 
                  cursor={false}
                  content={({ active, payload }) => (
                    active && payload?.length ? (
                      <div className="bg-background border rounded-md p-2 shadow-lg text-xs md:text-sm">
                        <p className="font-medium mb-0.5">{formatDate(payload[0].payload.date)}</p>
                        <p className="text-primary">Capital: {formatCurrency(payload[0].payload.capital)}</p>
                      </div>
                    ) : null
                  )}
                />
                <YAxis orientation="left" domain={['dataMin', 'dataMax']} hide={true} />
                <Area
                  type="monotone"
                  dataKey="capital"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#cyanGradient)"
                  connectNulls={true}
                  dot={false}
                  activeDot={{ r: isMobile ? 3 : 5, strokeWidth: 1, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Desktop: inline setup panel */}
        {!isMobile && (
          <StrategySetupPanel
            params={params}
            strategy={strategy}
            isLoading={isLoading}
            onUpdateParams={onUpdateParams}
            panelRef={setupPanelRef}
          />
        )}
      </div>

      {/* Mobile: Floating button to open setup drawer */}
      {isMobile && (
        <>
          <Button
            onClick={() => setSetupDrawerOpen(true)}
            className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-lg p-0"
            size="icon"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </Button>

          {/* Drawer overlay */}
          {setupDrawerOpen && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSetupDrawerOpen(false)} />
              <div className="relative bg-background border-t rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
                <StrategySetupPanel
                  params={params}
                  strategy={strategy}
                  isLoading={isLoading}
                  onUpdateParams={(p) => { onUpdateParams(p); setSetupDrawerOpen(false); }}
                  panelRef={setupPanelRef}
                />
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Mobile Table View for Trade History - Horizontal Scroll with Sticky Date */}
      <div className="md:hidden mb-6">
        <h3 className="text-base font-medium mb-3">Trade History</h3>
        {isLoading ? (
          <div className="text-center py-6">Loading data...</div>
        ) : currentData.length === 0 ? (
          <div className="text-center py-6">No data to display</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-sm px-2 py-2 text-left font-semibold border-r border-border whitespace-nowrap min-w-[72px] cursor-pointer" onClick={() => handleSortChange("date" as keyof TradeHistoryItem)}>
                      <div className="flex items-center gap-0.5">Date{getSortIcon("date" as keyof TradeHistoryItem)}</div>
                    </th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[52px]">Open</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[52px]">High</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[52px]">Low</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[52px]">Close</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[48px]">Trade</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[56px]">{suggestedEntryLabel}</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[52px]">Stop</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[64px] cursor-pointer" onClick={() => handleSortChange("profitLoss" as keyof TradeHistoryItem)}>
                      <div className="flex items-center justify-center gap-0.5">P/L{getSortIcon("profitLoss" as keyof TradeHistoryItem)}</div>
                    </th>
                    <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[72px] cursor-pointer" onClick={() => handleSortChange("currentCapital" as keyof TradeHistoryItem)}>
                      <div className="flex items-center justify-center gap-0.5">Capital{getSortIcon("currentCapital" as keyof TradeHistoryItem)}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Next Day Prediction Row */}
                  {nextDayPrediction && (
                    <tr className="bg-primary/5 border-t border-border">
                      <td className="sticky left-0 z-10 bg-primary/10 backdrop-blur-sm px-2 py-1.5 font-medium border-r border-border whitespace-nowrap text-primary text-[11px]">
                        {formatDate(nextDayPrediction.date)}
                      </td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                      <td className="px-2 py-1.5 text-center font-medium text-primary">{formatPrice(nextDayPrediction.suggestedEntryPrice)}</td>
                      <td className="px-2 py-1.5 text-center font-medium text-primary">{formatPrice(nextDayPrediction.stopPrice)}</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                      <td className="px-2 py-1.5 text-center text-muted-foreground">-</td>
                    </tr>
                  )}
                  {currentData.map((item, index) => (
                    <tr key={`${item.date}-${index}`} className="border-t border-border hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card/95 backdrop-blur-sm px-2 py-1.5 font-medium border-r border-border whitespace-nowrap text-[11px]">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-2 py-1.5 text-center">{formatPrice(item.entryPrice)}</td>
                      <td className="px-2 py-1.5 text-center">{formatPrice(item.high)}</td>
                      <td className="px-2 py-1.5 text-center">{formatPrice(item.low)}</td>
                      <td className="px-2 py-1.5 text-center">{formatPrice(item.exitPrice)}</td>
                      <td className="px-2 py-1.5 text-center">{formatTradeValue(item.trade || "-")}</td>
                      <td className="px-2 py-1.5 text-center">{formatPrice(item.suggestedEntryPrice)}</td>
                      <td className="px-2 py-1.5 text-center">{typeof item.stopPrice === "number" ? formatPrice(item.stopPrice) : item.stopPrice}</td>
                      <td className={`px-2 py-1.5 text-center font-medium ${
                        Number(item.profitLoss) > 0 ? "text-green-600 dark:text-green-400" :
                        Number(item.profitLoss) < 0 ? "text-red-600 dark:text-red-400" : ""
                      }`}>
                        {formatCurrency(item.profitLoss)}
                      </td>
                      <td className="px-2 py-1.5 text-center font-medium">{formatCurrency(item.currentCapital)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead 
                    key={column.id}
                    className={`text-center px-2 py-2 text-sm cursor-pointer ${column.width}`}
                    onClick={() => handleSortChange(column.id as keyof TradeHistoryItem)}
                  >
                    <div className="flex items-center justify-center">
                      {column.id === "suggestedEntryPrice" ? suggestedEntryLabel : column.label}
                      {getSortIcon(column.id as keyof TradeHistoryItem)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-6">
                    Loading data...
                  </TableCell>
                </TableRow>
              ) : currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-6">
                    No data to display
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Next Day Prediction Row */}
                  {nextDayPrediction && (
                    <TableRow className="bg-primary/5 hover:bg-primary/10 border-b-2 border-primary/20">
                      {columns.map((column) => {
                        let cellContent: React.ReactNode = "-";
                        let cellClass = "text-center px-2 py-2 text-sm";
                        
                        if (column.id === "date") {
                          cellContent = `${formatDate(nextDayPrediction.date)} (Next Day)`;
                          cellClass += " font-medium text-primary";
                        } else if (column.id === "suggestedEntryPrice") {
                          cellContent = (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center gap-1 cursor-help">
                                    <span className="font-medium text-primary">
                                      {formatPrice(nextDayPrediction.suggestedEntryPrice)}
                                    </span>
                                    <Info className="h-3 w-3 text-primary/60" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Price may vary until the market is closed</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        } else if (column.id === "stopPrice") {
                          cellContent = formatPrice(nextDayPrediction.stopPrice);
                          cellClass += " font-medium text-primary";
                        } else {
                          cellClass += " text-muted-foreground";
                        }
                        
                        return (
                          <TableCell key={column.id} className={cellClass}>
                            {cellContent}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )}
                  
                  {currentData.map((item) => (
                    <TableRow key={`${item.date}-${item.profitLoss}`} className="hover:bg-muted/50">
                      {columns.map((column) => {
                        const value = item[column.id as keyof TradeHistoryItem];
                        let formattedValue = "-";
                        
                        if (value !== undefined && value !== null) {
                          if (column.id === "date") {
                            formattedValue = formatDate(value as string);
                          } else if (column.id === "profitLoss" || column.id === "currentCapital") {
                            formattedValue = formatCurrency(value as number);
                          } else if (column.id === "volume" || column.id === "lotSize") {
                            formattedValue = (value as number).toLocaleString();
                          } else if (column.id === "stopTrigger") {
                            formattedValue = typeof item.stopTrigger === 'string' ? item.stopTrigger : "-";
                          } else if (column.id === "trade") {
                            formattedValue = value as string;
                          } else if (column.id === "actualPrice") {
                            formattedValue = typeof value === "number" ? formatPrice(value) : String(value);
                          } else if (typeof value === "number") {
                            formattedValue = formatPrice(value);
                          } else {
                            formattedValue = String(value);
                          }
                        }
                        
                        return (
                          <TableCell 
                            key={column.id}
                            className={`text-center px-2 py-2 text-sm ${
                              column.id === "currentCapital" ? "font-medium" : ""
                            } ${
                              column.id === "profitLoss" ? 
                                (Number(item.profitLoss) > 0 ? "text-green-600 dark:text-green-400" : 
                                 Number(item.profitLoss) < 0 ? "text-red-600 dark:text-red-400" : "") : ""
                            }`}
                          >
                            {column.id === "trade" ? formatTradeValue(formattedValue) : formattedValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Desktop Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t">
            <div className="flex items-center gap-2 mb-4 sm:mb-0">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <select
                className="bg-card border rounded px-2 py-1 text-sm"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {[10, 50, 100, 500].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = currentPage <= 3
                    ? i + 1
                    : currentPage >= totalPages - 2
                      ? totalPages - 4 + i
                      : currentPage - 2 + i;
                  return pageNum > 0 && pageNum <= totalPages ? (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ) : null;
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
      
      {/* Mobile Pagination */}
      <div className="md:hidden">
        {totalPages > 1 && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Items per page:</span>
              <select
                className="bg-card border rounded px-2 py-1 text-xs"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {[10, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 px-3 text-xs"
              >
                Previous
              </Button>
              
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 px-3 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
