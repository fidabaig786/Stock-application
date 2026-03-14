import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Stock {
  ticker: string;
  assetType: 'Stock' | 'Option';
  currentPrice?: number;
  addedAt: string;
  companyUrl?: string;
  nextEarningDate?: string;
}

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState<Stock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadWatchlist = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setWatchlist([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) {
        console.error('Error loading watchlist:', error);
        toast({
          title: "Error loading watchlist",
          description: "Failed to load your watchlist items",
          variant: "destructive",
        });
      } else {
        const formattedWatchlist: Stock[] = data.map(item => ({
          ticker: item.ticker,
          assetType: item.asset_type as 'Stock' | 'Option',
          currentPrice: item.current_price ? Number(item.current_price) : undefined,
          addedAt: item.added_at,
          companyUrl: item.company_url || undefined,
          nextEarningDate: (item as any).next_earning_date || undefined,
        }));
        setWatchlist(formattedWatchlist);
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToWatchlist = async (ticker: string, assetType: 'Stock' | 'Option', companyUrl?: string, nextEarningDate?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to manage your watchlist",
          variant: "destructive",
        });
        return;
      }

      const upperTicker = ticker.toUpperCase();
      
      // Check if already exists with same asset type
      const exists = watchlist.some(stock => stock.ticker === upperTicker && stock.assetType === assetType);
      if (exists) {
        toast({
          title: "Already in watchlist",
          description: `${upperTicker} (${assetType}) is already in your watchlist`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('watchlist_items')
        .insert({
          user_id: user.id,
          ticker: upperTicker,
          asset_type: assetType,
          company_url: companyUrl || null,
          next_earning_date: nextEarningDate || null,
        } as any);

      if (error) {
        console.error('Error adding to watchlist:', error);
        toast({
          title: "Error adding to watchlist",
          description: "Failed to add ticker to your watchlist",
          variant: "destructive",
        });
      } else {
        const newStock: Stock = {
          ticker: upperTicker,
          assetType,
          addedAt: new Date().toISOString(),
          companyUrl: companyUrl || undefined,
          nextEarningDate: nextEarningDate || undefined,
        };
        setWatchlist(prev => [newStock, ...prev]);
        toast({
          title: "Added to watchlist",
          description: `${upperTicker} (${assetType}) added to your watchlist`,
        });
      }
    } catch (error) {
      console.error('Error adding to watchlist:', error);
    }
  };

  const removeFromWatchlist = async (ticker: string, assetType: 'Stock' | 'Option') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to manage your watchlist",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('watchlist_items')
        .delete()
        .eq('user_id', user.id)
        .eq('ticker', ticker)
        .eq('asset_type', assetType);

      if (error) {
        console.error('Error removing from watchlist:', error);
        toast({
          title: "Error removing from watchlist",
          description: "Failed to remove ticker from your watchlist",
          variant: "destructive",
        });
      } else {
        setWatchlist(prev => prev.filter(stock => !(stock.ticker === ticker && stock.assetType === assetType)));
        toast({
          title: "Removed from watchlist",
          description: `${ticker} (${assetType}) removed from your watchlist`,
        });
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  const updateCompanyUrl = async (ticker: string, assetType: 'Stock' | 'Option', newUrl: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('watchlist_items')
        .update({ company_url: newUrl })
        .eq('user_id', user.id)
        .eq('ticker', ticker)
        .eq('asset_type', assetType);

      if (error) {
        console.error('Error updating company URL:', error);
        toast({ title: "Error", description: "Failed to update company URL", variant: "destructive" });
      } else {
        setWatchlist(prev => prev.map(s =>
          s.ticker === ticker && s.assetType === assetType
            ? { ...s, companyUrl: newUrl || undefined }
            : s
        ));
        toast({ title: "Updated", description: `Company URL updated for ${ticker}` });
      }
    } catch (error) {
      console.error('Error updating company URL:', error);
    }
  };

  const updateEarningDate = async (ticker: string, assetType: 'Stock' | 'Option', newDate: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('watchlist_items')
        .update({ next_earning_date: newDate } as any)
        .eq('user_id', user.id)
        .eq('ticker', ticker)
        .eq('asset_type', assetType);

      if (error) {
        console.error('Error updating earning date:', error);
        toast({ title: "Error", description: "Failed to update earning date", variant: "destructive" });
      } else {
        setWatchlist(prev => prev.map(s =>
          s.ticker === ticker && s.assetType === assetType
            ? { ...s, nextEarningDate: newDate || undefined }
            : s
        ));
        toast({ title: "Updated", description: `Earning date updated for ${ticker}` });
      }
    } catch (error) {
      console.error('Error updating earning date:', error);
    }
  };

  useEffect(() => {
    loadWatchlist();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadWatchlist();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    watchlist,
    isLoading,
    addToWatchlist,
    removeFromWatchlist,
    updateCompanyUrl,
    updateEarningDate,
    refreshWatchlist: loadWatchlist,
  };
};