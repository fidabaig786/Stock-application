import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, PieChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RRGChart } from './RRGChart';
import { MatrixRow } from '@/hooks/useWeeklyMatrix';

export const SectorRRG: React.FC = () => {
  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [highlightedTicker, setHighlightedTicker] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  const fetchRRG = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use direct fetch with longer timeout since batched Polygon calls take ~15-20s
      const supabaseUrl = 'https://ewvdjypgzfpoldttblhs.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dmRqeXBnemZwb2xkdHRibGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0ODU3MzYsImV4cCI6MjA3MDA2MTczNn0.y8SJZzRVAzuBm9WP6tES9Lvp97f7ewumpjISdI1TTV8';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sector-rrg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      
      const data = await response.json();

      if (data.error) {
        throw new Error(`Server error: ${data.error}`);
      }

      if (!data) {
        throw new Error('No data returned from edge function');
      }

      if (data.error) {
        throw new Error(`Server error: ${data.error}`);
      }

      setLatestDate(data.latestDate || null);

      const rows: MatrixRow[] = (data.results || []).map((r: any) => ({
        ticker: r.ticker,
        currentPrice: null,
        rsi: null,
        rsiLabel: null,
        emaCrossover: null,
        macdSignal: null,
        rrgQuadrant: r.quadrant,
        rrgTrail: (r.trail || []).map((pt: any) => ({
          rsRatio: pt.rsRatio,
          rsMomentum: pt.rsMomentum,
          date: pt.date,
        })),
        burst: null,
        weeklyCandles: [],
      }));
      setMatrixData(rows);
      
      console.log(`[SectorRRG] Loaded ${rows.length} sectors, latest: ${data.latestDate}`);
    } catch (error: any) {
      console.error('Sector RRG fetch error:', error);
      toast({
        title: 'Sector RRG Error',
        description: error?.message || 'Failed to fetch sector RRG data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!loaded) {
      fetchRRG();
      setLoaded(true);
    }
  }, [loaded, fetchRRG]);

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Sector RRG (Quadrant)
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Benchmark: SPY
              {latestDate && <> &nbsp;|&nbsp; Data as of {latestDate}</>}
            </span>
            <Button size="sm" variant="outline" onClick={fetchRRG} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && matrixData.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading sector RRG data...</span>
          </div>
        ) : matrixData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Click Refresh to load sector RRG data
          </div>
        ) : (
          <RRGChart
            data={matrixData}
            highlightedTicker={highlightedTicker}
            onTickerClick={(t) => setHighlightedTicker(prev => prev === t ? null : t)}
          />
        )}
      </CardContent>
    </Card>
  );
};
