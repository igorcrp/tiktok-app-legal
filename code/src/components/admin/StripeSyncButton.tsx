import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface StripeSyncResponse {
  success: boolean;
  message: string;
  stats: {
    total_processed: number;
    stripe_customers_created: number;
    users_updated_with_stripe_id: number;
  };
}

export const StripeSyncButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    try {
      logger.info("Starting Stripe customer sync");
      
      const { data, error } = await supabase.functions.invoke('sync-stripe-customers');
      
      if (error) {
        throw error;
      }

      const result = data as StripeSyncResponse;
      
      if (result.success) {
        toast.success("Sincronização concluída", {
          description: `${result.stats.stripe_customers_created} clientes criados, ${result.stats.users_updated_with_stripe_id} usuários atualizados`
        });
        logger.info("Stripe sync completed successfully", result.stats);
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      logger.error("Error syncing Stripe customers:", error);
      toast.error("Erro na sincronização", {
        description: "Não foi possível sincronizar os usuários com o Stripe"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSync} 
      disabled={isLoading}
      variant="outline"
      className="flex items-center gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {isLoading ? "Sincronizando..." : "Sincronizar com Stripe"}
    </Button>
  );
};