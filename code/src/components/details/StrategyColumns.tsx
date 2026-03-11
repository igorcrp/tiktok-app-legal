import { StrategyType } from "@/services/strategyService";
import { TradeHistoryItem } from "@/types";

export interface ColumnConfig {
  id: string;
  label: string;
  width: string;
}

// Colunas base que todas as estratégias usam
const baseColumns: ColumnConfig[] = [
  { id: "date", label: "Date", width: "w-24" },
  { id: "entryPrice", label: "Open", width: "w-20" },
  { id: "high", label: "High", width: "w-20" },
  { id: "low", label: "Low", width: "w-20" },
  { id: "exitPrice", label: "Close", width: "w-20" },
  { id: "volume", label: "Volume", width: "w-24" },
];

// Colunas finais que todas as estratégias usam
const finalColumns: ColumnConfig[] = [
  { id: "trade", label: "Trade", width: "w-20" },
  { id: "actualPrice", label: "Actual Price", width: "w-24" },
  { id: "lotSize", label: "Lot Size", width: "w-20" },
  { id: "stopPrice", label: "Stop Price", width: "w-24" },
  { id: "stopTrigger", label: "Stop Trigger", width: "w-24" },
  { id: "profitLoss", label: "Profit/Loss", width: "w-28" },
  { id: "currentCapital", label: "Current Capital", width: "w-32" }
];

// Colunas específicas de cada estratégia
const strategySpecificColumns: Record<StrategyType, ColumnConfig[]> = {
  'entry-percentage': [
    { id: "suggestedEntryPrice", label: "Suggested Entry", width: "w-28" },
  ],
  'breakout': [
    { id: "suggestedEntryPrice", label: "Breakout Level", width: "w-28" },
  ],
  'gap-trading': [
    { id: "suggestedEntryPrice", label: "Gap Entry", width: "w-28" },
  ],
  'intraday-oversold': [
    { id: "suggestedEntryPrice", label: "Oversold Entry", width: "w-28" },
  ],
  'range-compression': [
    { id: "suggestedEntryPrice", label: "Breakout Entry", width: "w-28" },
  ],
  'volume-spike': [
    { id: "suggestedEntryPrice", label: "Volume Entry", width: "w-28" },
  ],
  'price-volume-divergence': [
    { id: "suggestedEntryPrice", label: "Divergence Entry", width: "w-28" },
  ],
};

// Retorna as colunas para uma estratégia específica
export function getColumnsForStrategy(strategy: StrategyType): ColumnConfig[] {
  const specificColumns = strategySpecificColumns[strategy] || strategySpecificColumns['entry-percentage'];
  return [...baseColumns, ...specificColumns, ...finalColumns];
}

// Labels amigáveis para exibição mobile
export const mobileLabels: Record<string, string> = {
  date: "Date",
  entryPrice: "Open",
  high: "High",
  low: "Low",
  exitPrice: "Close",
  volume: "Volume",
  suggestedEntryPrice: "Sugg. Entry",
  trade: "Trade",
  actualPrice: "Actual Price",
  lotSize: "Lot Size",
  stopPrice: "Stop Price",
  stopTrigger: "Stop Trigger",
  profitLoss: "P/L",
  currentCapital: "Capital",
};

// Retorna o label específico da estratégia para Suggested Entry
export function getSuggestedEntryLabel(strategy: StrategyType): string {
  switch (strategy) {
    case 'entry-percentage': return 'Sugg. Entry';
    case 'breakout': return 'Breakout Level';
    case 'gap-trading': return 'Gap Entry';
    case 'intraday-oversold': return 'Oversold Entry';
    case 'range-compression': return 'Range Entry';
    case 'volume-spike': return 'Volume Entry';
    case 'price-volume-divergence': return 'Div. Entry';
    default: return 'Entry Price';
  }
}
