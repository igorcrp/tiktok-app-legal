import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Percent, TrendingUp, ArrowLeftRight, ArrowDownUp, Minimize2, BarChart3, GitBranch, Crown, ChevronRight, Sparkles, Zap, Target, LineChart, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { STRATEGIES, StrategyConfig, StrategyType } from "@/services/strategyService";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { fireViewContent, fireCustomizeProduct } from "@/utils/metaPixel";

// Map icon names to actual components
const iconMap: Record<string, React.ComponentType<{
  className?: string;
}>> = {
  'Percent': Percent,
  'TrendingUp': TrendingUp,
  'ArrowLeftRight': ArrowLeftRight,
  'ArrowDownUp': ArrowDownUp,
  'Minimize2': Minimize2,
  'BarChart3': BarChart3,
  'GitBranch': GitBranch
};
interface StrategyCardProps {
  strategy: StrategyConfig;
  onSelect: (id: StrategyType) => void;
  isPremiumUser: boolean;
  onUpgrade: () => void;
  isUpgradeLoading: boolean;
}
function StrategyCard({
  strategy,
  onSelect,
  isPremiumUser,
  onUpgrade,
  isUpgradeLoading
}: StrategyCardProps) {
  const Icon = iconMap[strategy.icon] || Target;
  const isLocked = strategy.isPremium && !isPremiumUser;
  return <Card className={cn("group relative overflow-hidden transition-all duration-300 cursor-pointer", "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1", "border-2 border-transparent hover:border-primary/20", isLocked && "opacity-75")} onClick={() => !isLocked && onSelect(strategy.id)}>
      {/* Gradient overlay */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300", strategy.gradient)} />
      
      {/* Premium badge */}
      {strategy.isPremium && <div className="absolute top-3 right-3 z-10">
          <Badge variant={isLocked ? "secondary" : "default"} className={cn("flex items-center gap-1", !isLocked && "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0")}>
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
        </div>}
      
      <CardHeader className="relative z-10 pb-2">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", "bg-gradient-to-br from-muted to-muted/50", !isLocked && strategy.color)}>
          <Icon className={cn("h-6 w-6", isLocked ? "text-muted-foreground" : strategy.color)} />
        </div>
        <CardTitle className="text-lg flex items-center gap-2">
          {strategy.name}
          {!isLocked && <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {strategy.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative z-10 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {strategy.parameters.slice(0, 3).map(param => <Badge key={param.key} variant="outline" className="text-xs font-normal">
              {param.label}
            </Badge>)}
        </div>
        
        {isLocked && <div className="mt-4 pt-3 border-t">
            <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" disabled={isUpgradeLoading} onClick={e => {
          e.stopPropagation();
          onUpgrade();
        }}>
              {isUpgradeLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crown className="h-4 w-4 mr-2" />}
              Upgrade to Unlock
            </Button>
          </div>}
      </CardContent>
    </Card>;
}
export default function AppHomePage() {
  const navigate = useNavigate();
  const {
    isSubscribed,
    createCheckout,
    isLoading
  } = useSubscription();
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);

  // ViewContent: fires once when the user lands on the dashboard
  useEffect(() => {
    fireViewContent('Dashboard');
  }, []);

  const handleSelectStrategy = (strategyId: StrategyType) => {
    navigate(`/app/daytrade?strategy=${strategyId}`);
    // CustomizeProduct: fires when user picks a specific strategy
    fireCustomizeProduct(strategyId);
  };
  const handleUpgrade = async () => {
    setIsUpgradeLoading(true);
    try {
      await createCheckout();
    } finally {
      setIsUpgradeLoading(false);
    }
  };
  const freeStrategies = STRATEGIES.filter(s => !s.isPremium);
  const premiumStrategies = STRATEGIES.filter(s => s.isPremium);
  return <div className="space-y-6 pb-8">
      {/* Hero Section - Compact */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/8 via-primary/4 to-background border px-5 py-4">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">
                Choose Your Trading Strategy
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Select a backtested strategy optimized for day trading across global markets.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-green-500" />
              </div>
              <span className="font-medium">{freeStrategies.length} Free</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <span className="font-medium">{premiumStrategies.length} Premium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                <LineChart className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <span className="font-medium">OHLCV</span>
            </div>
          </div>
        </div>
      </div>

      {/* Free Strategies Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold">Core Strategies</h2>
          <Badge variant="secondary" className="text-xs">Free</Badge>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {freeStrategies.map(strategy => <StrategyCard key={strategy.id} strategy={strategy} onSelect={handleSelectStrategy} isPremiumUser={isSubscribed} onUpgrade={handleUpgrade} isUpgradeLoading={isUpgradeLoading} />)}
        </div>
      </section>

      {/* Premium Strategies Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
          <h2 className="text-lg font-semibold">Advanced Strategies</h2>
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {premiumStrategies.map(strategy => <StrategyCard key={strategy.id} strategy={strategy} onSelect={handleSelectStrategy} isPremiumUser={isSubscribed} onUpgrade={handleUpgrade} isUpgradeLoading={isUpgradeLoading} />)}
        </div>
        
        {!isSubscribed && <Card className="mt-6 border-dashed border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Unlock All Premium Strategies</h3>
                  <p className="text-sm text-muted-foreground">
                    Get access to advanced algorithms + automatic parameter optimization
                  </p>
                </div>
              </div>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0" onClick={handleUpgrade} disabled={isUpgradeLoading}>
                {isUpgradeLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Upgrade Now
              </Button>
            </CardContent>
          </Card>}
      </section>
      
      {/* Quick Stats */}
      
    </div>;
}