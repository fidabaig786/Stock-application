import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PortfolioPosition {
  id: string;
  ticker: string;
  shares: number;
  buy_price: number;
  buy_date: string;
  index_ticker: string;
  index_buy_price: number;
  stop_loss_price?: number;
  holding: number;
  comments?: string;
  current_price?: number;
  index_current_price?: number;
}

export const usePortfolio = (userId: string | undefined) => {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPositions = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('portfolio_positions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to load portfolio positions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [userId]);

  const addPosition = async (position: Omit<PortfolioPosition, 'id'>) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .insert([{ ...position, user_id: userId }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Position added to portfolio",
      });

      await fetchPositions();
    } catch (error) {
      console.error('Error adding position:', error);
      toast({
        title: "Error",
        description: "Failed to add position",
        variant: "destructive",
      });
    }
  };

  const updatePosition = async (id: string, updates: Partial<PortfolioPosition>) => {
    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Position updated",
      });

      await fetchPositions();
    } catch (error) {
      console.error('Error updating position:', error);
      toast({
        title: "Error",
        description: "Failed to update position",
        variant: "destructive",
      });
    }
  };

  const removePosition = async (id: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_positions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Position removed from portfolio",
      });

      await fetchPositions();
    } catch (error) {
      console.error('Error removing position:', error);
      toast({
        title: "Error",
        description: "Failed to remove position",
        variant: "destructive",
      });
    }
  };

  const fetchCurrentPrices = async () => {
    if (positions.length === 0) return;

    try {
      const tickers = Array.from(new Set([
        ...positions.map(p => p.ticker),
        ...positions.map(p => p.index_ticker)
      ]));

      const { data, error } = await supabase.functions.invoke('get-current-prices', {
        body: { tickers }
      });

      if (error) throw error;

      const updatedPositions = positions.map(pos => ({
        ...pos,
        current_price: data.prices[pos.ticker],
        index_current_price: data.prices[pos.index_ticker]
      }));

      setPositions(updatedPositions);
    } catch (error) {
      console.error('Error fetching current prices:', error);
    }
  };

  return {
    positions,
    isLoading,
    addPosition,
    updatePosition,
    removePosition,
    fetchCurrentPrices,
    refresh: fetchPositions,
  };
};
