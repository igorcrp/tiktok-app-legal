import { AnalysisResult } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface TradeDetail {
  profitLoss: number;
  trade: string;
  stop: string;
}

interface ResultsTableProps {
  results: AnalysisResult[];
  onViewDetails: (assetCode: string) => void;
  sortConfig: { field: string; direction: "asc" | "desc" };
  setSortConfig: (config: { field: string; direction: "asc" | "desc" }) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;
}

type SortField = 
  | "assetCode" 
  | "tradingDays"
  | "trades"
  | "tradePercentage"
  | "profits"
  | "profitPercentage"
  | "losses"
  | "lossPercentage"
  | "stops"
  | "stopPercentage"
  | "probabilityRaw"
  | "finalCapital"
  | "optimalEntryPercent"
  | "optimalStopPercent"
  | "optimalFinalCapital";

interface SortConfig {
  field: SortField;
  direction: "asc" | "desc";
}

export function ResultsTable({ 
  results, 
  onViewDetails, 
  sortConfig, 
  setSortConfig, 
  currentPage, 
  setCurrentPage, 
  rowsPerPage, 
  setRowsPerPage 
}: ResultsTableProps) {
  const { isSubscribed } = useSubscription();

  console.info(`DEBUG ResultsTable: Received ${results.length} results`);
  console.info(`DEBUG ResultsTable: First 5 results:`, results.slice(0, 5).map(r => ({
    assetCode: r.assetCode,
    finalCapital: r.finalCapital,
    trades: r.trades
  })));

  // Sort results - now available for all users
  const sortedResults = [...results].sort((a, b) => {
    const fieldA = a[sortConfig.field as SortField];
    const fieldB = b[sortConfig.field as SortField];
    
    if (fieldA < fieldB) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (fieldA > fieldB) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  // Show all results for all users
  const displayResults = sortedResults;

  console.info(`DEBUG ResultsTable: After processing, displaying ${displayResults.length} results`);

  // Pagination
  const totalPages = Math.ceil(displayResults.length / rowsPerPage);
  const paginatedResults = displayResults.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  
  console.info(`DEBUG ResultsTable: After pagination, showing ${paginatedResults.length} results on page ${currentPage}`);
  
  const handleSort = (field: SortField) => {
    setSortConfig({
      field,
      direction:
        sortConfig.field === field && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return null;
    }
    
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
      
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="start-ellipsis">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4);
      } else if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={currentPage === i}
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
        );
      }
      
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="end-ellipsis">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      items.push(
      <PaginationItem key={totalPages}>
        <PaginationLink
          isActive={currentPage === totalPages}
          onClick={() => setCurrentPage(totalPages)}
        >
          {totalPages}
        </PaginationLink>
      </PaginationItem>
      );
    }
    
    return items;
  };
  
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Results</h2>
        </div>
      </div>
      
      {/* Mobile Table View - Horizontal Scroll with Sticky First Column */}
      <div className="md:hidden overflow-hidden rounded-md border" data-tour="results-table">
        {paginatedResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No results to display
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th
                    className="sticky left-0 z-20 bg-muted/95 backdrop-blur-sm px-2 py-2 text-left font-semibold border-r border-border cursor-pointer whitespace-nowrap min-w-[72px]"
                    onClick={() => handleSort("assetCode")}
                  >
                    <div className="flex items-center gap-0.5">
                      Stock
                      <SortIcon field="assetCode" />
                    </div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[44px] cursor-pointer" onClick={() => handleSort("trades")}>
                    <div className="flex items-center justify-center gap-0.5">Trades<SortIcon field="trades" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[44px] cursor-pointer" onClick={() => handleSort("profits")}>
                    <div className="flex items-center justify-center gap-0.5">Win<SortIcon field="profits" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[56px] cursor-pointer" onClick={() => handleSort("profitPercentage")}>
                    <div className="flex items-center justify-center gap-0.5">Win%<SortIcon field="profitPercentage" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[44px] cursor-pointer" onClick={() => handleSort("losses")}>
                    <div className="flex items-center justify-center gap-0.5">Loss<SortIcon field="losses" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[56px] cursor-pointer" onClick={() => handleSort("lossPercentage")}>
                    <div className="flex items-center justify-center gap-0.5">Loss%<SortIcon field="lossPercentage" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[52px] cursor-pointer" onClick={() => handleSort("stops")}>
                    <div className="flex items-center justify-center gap-0.5">Stops<SortIcon field="stops" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[64px] cursor-pointer font-bold" onClick={() => handleSort("probabilityRaw")}>
                    <div className="flex items-center justify-center gap-0.5">Prob.<SortIcon field="probabilityRaw" /></div>
                  </th>
                  {isSubscribed && (
                    <>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[60px] bg-primary/10 cursor-pointer" onClick={() => handleSort("optimalEntryPercent")}>
                        <div className="flex items-center justify-center gap-0.5">B.Entry%<SortIcon field="optimalEntryPercent" /></div>
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[60px] bg-primary/10 cursor-pointer" onClick={() => handleSort("optimalStopPercent")}>
                        <div className="flex items-center justify-center gap-0.5">B.Stop%<SortIcon field="optimalStopPercent" /></div>
                      </th>
                      <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[80px] bg-primary/10 cursor-pointer" onClick={() => handleSort("optimalFinalCapital")}>
                        <div className="flex items-center justify-center gap-0.5">Opt.Cap<SortIcon field="optimalFinalCapital" /></div>
                      </th>
                    </>
                  )}
                  <th className="px-2 py-2 text-center font-semibold whitespace-nowrap min-w-[80px] cursor-pointer" onClick={() => handleSort("finalCapital")}>
                    <div className="flex items-center justify-center gap-0.5">Capital<SortIcon field="finalCapital" /></div>
                  </th>
                  <th className="px-2 py-2 text-center font-medium whitespace-nowrap min-w-[36px]"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((result) => (
                  <tr key={result.assetCode} className="border-t border-border hover:bg-muted/30">
                    <td className="sticky left-0 z-10 bg-card/95 backdrop-blur-sm px-2 py-1.5 font-semibold border-r border-border whitespace-nowrap">
                      {result.assetCode}
                    </td>
                    <td className="px-2 py-1.5 text-center">{result.trades}</td>
                    <td className="px-2 py-1.5 text-center text-green-600 dark:text-green-400">{result.profits}</td>
                    <td className="px-2 py-1.5 text-center text-green-600 dark:text-green-400">{result.profitPercentage.toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-center text-red-600 dark:text-red-400">{result.losses}</td>
                    <td className="px-2 py-1.5 text-center text-red-600 dark:text-red-400">{result.lossPercentage.toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-center">{result.stops}</td>
                    <td className="px-2 py-1.5 text-center">
                      {result.probabilityToday ? (
                        <span className={cn(
                          "font-bold",
                          result.probabilityRaw && result.probabilityRaw >= 60 ? "text-green-600" :
                          result.probabilityRaw && result.probabilityRaw >= 50 ? "text-yellow-600" :
                          "text-red-600"
                        )}>
                          {result.probabilityToday}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    {isSubscribed && (
                      <>
                        <td className="px-2 py-1.5 text-center bg-primary/5 text-primary font-medium">
                          {result.optimalEntryPercent !== undefined ? `${result.optimalEntryPercent.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center bg-primary/5 text-primary font-medium">
                          {result.optimalStopPercent !== undefined ? `${result.optimalStopPercent.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center bg-primary/5 text-primary font-bold">
                          {result.optimalFinalCapital !== undefined
                            ? `$${result.optimalFinalCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                            : '-'}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">
                      ${(result.lastCurrentCapital ?? result.finalCapital).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => onViewDetails(result.assetCode)}
                        className="p-1 rounded-md hover:bg-muted transition-colors"
                        aria-label={`View details for ${result.assetCode}`}
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="w-20 text-center cursor-pointer"
                  onClick={() => handleSort("assetCode")}
                >
                  <div className="flex items-center justify-center">
                    Stock
                    <SortIcon field="assetCode" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("tradingDays")}
                >
                  <div className="flex items-center justify-center">
                    Trading Days
                    <SortIcon field="tradingDays" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("trades")}
                >
                  <div className="flex items-center justify-center">
                    Nº of Trades
                    <SortIcon field="trades" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("tradePercentage")}
                >
                  <div className="flex items-center justify-center">
                    % Trade
                    <SortIcon field="tradePercentage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("profits")}
                >
                  <div className="flex items-center justify-center">
                    Profits
                    <SortIcon field="profits" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("profitPercentage")}
                >
                  <div className="flex items-center justify-center">
                    Win Rate
                    <SortIcon field="profitPercentage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("losses")}
                >
                  <div className="flex items-center justify-center">
                    Losses
                    <SortIcon field="losses" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("lossPercentage")}
                >
                  <div className="flex items-center justify-center">
                    Loss Rate
                    <SortIcon field="lossPercentage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("stops")}
                >
                  <div className="flex items-center justify-center">
                    Stops
                    <SortIcon field="stops" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("stopPercentage")}
                >
                  <div className="flex items-center justify-center">
                    Stop Rate
                    <SortIcon field="stopPercentage" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-center cursor-pointer font-bold"
                  onClick={() => handleSort("probabilityRaw")}
                >
                  <div className="flex items-center justify-center">
                    Probability
                    <SortIcon field="probabilityRaw" />
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  Probability Strength
                </TableHead>
                {/* Premium-only columns for Optimal Parameters */}
                {isSubscribed && (
                  <>
                    <TableHead 
                      className="text-center cursor-pointer bg-primary/10 font-bold"
                      onClick={() => handleSort("optimalEntryPercent")}
                    >
                      <div className="flex items-center justify-center">
                        Best Entry%
                        <SortIcon field="optimalEntryPercent" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer bg-primary/10 font-bold"
                      onClick={() => handleSort("optimalStopPercent")}
                    >
                      <div className="flex items-center justify-center">
                        Best Stop%
                        <SortIcon field="optimalStopPercent" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer bg-primary/10 font-bold"
                      onClick={() => handleSort("optimalFinalCapital")}
                    >
                      <div className="flex items-center justify-center">
                        Optimized Capital
                        <SortIcon field="optimalFinalCapital" />
                      </div>
                    </TableHead>
                  </>
                )}
                <TableHead
                  className="text-center cursor-pointer font-bold"
                  onClick={() => handleSort("finalCapital")}
                >
                  <div className="flex items-center justify-center">
                    Final Capital
                    <SortIcon field="finalCapital" />
                  </div>
                </TableHead>
                <TableHead className="w-24 text-center">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSubscribed ? 17 : 14} className="text-center py-6 text-muted-foreground">
                    No results to display
                  </TableCell>
                </TableRow>
              ) : (
                paginatedResults.map((result) => (
                  <TableRow key={result.assetCode}>
                    <TableCell className="font-medium text-center">{result.assetCode}</TableCell>
                    <TableCell className="text-center">{result.tradingDays}</TableCell>
                    <TableCell className="text-center">{result.trades}</TableCell>
                    <TableCell className="text-center">
                      {result.tradePercentage.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">{result.profits}</TableCell>
                    <TableCell className={cn(
                      "text-center",
                      "text-green-600 dark:text-green-400"
                    )}>
                      {result.profitPercentage.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">{result.losses}</TableCell>
                    <TableCell className={cn(
                      "text-center",
                      "text-red-600 dark:text-red-400"
                    )}>
                      {result.lossPercentage.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">{result.stops}</TableCell>
                    <TableCell className="text-center">
                      {result.stopPercentage.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">
                      {result.probabilityToday ? (
                        <span className={cn(
                          "font-bold",
                          result.probabilityRaw && result.probabilityRaw >= 60 ? "text-green-600" :
                          result.probabilityRaw && result.probabilityRaw >= 50 ? "text-yellow-600" :
                          "text-red-600"
                        )}>
                          {result.probabilityToday}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {result.confidence95 || '-'}
                    </TableCell>
                    {/* Premium-only columns for Optimal Parameters */}
                    {isSubscribed && (
                      <>
                        <TableCell className="text-center font-medium bg-primary/5">
                          {result.optimalEntryPercent !== undefined 
                            ? `${result.optimalEntryPercent.toFixed(2)}%` 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center font-medium bg-primary/5">
                          {result.optimalStopPercent !== undefined 
                            ? `${result.optimalStopPercent.toFixed(2)}%` 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center font-bold bg-primary/5 text-primary">
                          {result.optimalFinalCapital !== undefined 
                            ? `$${result.optimalFinalCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : '-'}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-center font-medium">
                      ${(result.lastCurrentCapital ?? result.finalCapital).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        onClick={() => onViewDetails(result.assetCode)}
                      >
                        <Search className="h-4 w-4" />
                        <span className="sr-only">View Details</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Pagination - only show if subscribed or if free user has less than 10 results */}
      {(isSubscribed || paginatedResults.length <= 10) && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <select
              className="bg-transparent border rounded px-2 py-1 text-sm"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              disabled={!isSubscribed}
              style={{ backgroundColor: "#0f1729" }}
            >
              <option value={10}>10</option>
              {isSubscribed && (
                <>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                </>
              )}
            </select>
          </div>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
              />
              </PaginationItem>
              
              {generatePaginationItems()}
              
              <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
              />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
