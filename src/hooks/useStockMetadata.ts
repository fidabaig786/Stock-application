import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StockMetadata {
  ticker: string;
  sector: string | null;
  sectorETF: string | null;
  sectorQuadrant: string | null;
  sectorColor: 'red' | 'green' | null;
}

export const useStockMetadata = () => {
  const [metadata, setMetadata] = useState<Record<string, StockMetadata>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetadata = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stock-metadata', {
        body: { tickers },
      });

      if (error) throw error;

      const map: Record<string, StockMetadata> = {};
      (data.results || []).forEach((r: StockMetadata) => {
        map[r.ticker] = r;
      });
      setMetadata(map);
    } catch (error) {
      console.error('Metadata fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { metadata, isLoading: isLoading, fetchMetadata };
};
