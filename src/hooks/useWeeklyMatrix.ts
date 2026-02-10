import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RRGTrailPoint {
  rsRatio: number;
  rsMomentum: number;
  date: string;
}

export interface MatrixRow {
  ticker: string;
  currentPrice: number | null;
  rsi: number | null;
  rsiLabel: string | null;
  emaCrossover: string | null;
  macdSignal: string | null;
  rrgQuadrant: string | null;
  rrgTrail: RRGTrailPoint[];
  burst: boolean | null;
  weeklyCandles: WeeklyCandle[];
  error?: string;
}

export interface WeeklyCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  ema8: number;
  ema21: number;
  macd: number;
  signal: number;
  histogram: number;
  rsi: number;
}

export interface NewsArticle {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  description: string;
  imageUrl: string | null;
}

export const useWeeklyMatrix = () => {
  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const { toast } = useToast();

  const fetchMatrix = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-technical-matrix', {
        body: { tickers },
      });

      if (error) throw error;

      setMatrixData(data.results || []);
    } catch (error) {
      console.error('Matrix fetch error:', error);
      toast({
        title: 'Matrix Error',
        description: 'Failed to fetch weekly technical data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchNews = useCallback(async (ticker: string) => {
    setIsLoadingNews(true);
    setNews([]);
    try {
      const { data, error } = await supabase.functions.invoke('company-news', {
        body: { ticker },
      });

      if (error) throw error;

      setNews(data.articles || []);
    } catch (error) {
      console.error('News fetch error:', error);
      toast({
        title: 'News Error',
        description: `Failed to fetch news for ${ticker}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingNews(false);
    }
  }, [toast]);

  return {
    matrixData,
    isLoading,
    fetchMatrix,
    news,
    isLoadingNews,
    fetchNews,
  };
};
