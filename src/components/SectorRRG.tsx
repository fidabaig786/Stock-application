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
      const { data, error } = await supabase.functions.invoke('sector-rrg');
      if (error) throw error;

      setLatestDate(data.latestDate || null);

      // Map to MatrixRow format for RRGChart compatibility
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
    } catch (error) {
      console.error('Sector RRG fetch error:', error);
      toast({
        title: 'Sector RRG Error',
        description: 'Failed to fetch sector RRG data. Please try again.',
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
