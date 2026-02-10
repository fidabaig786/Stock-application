import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, PieChart } from 'lucide-react';
import { useWeeklyMatrix } from '@/hooks/useWeeklyMatrix';
import { RRGChart } from './RRGChart';

const SECTOR_TICKERS = ['XLK', 'XLF', 'XLV', 'XLE', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB'];

export const SectorRRG: React.FC = () => {
  const { matrixData, isLoading, fetchMatrix } = useWeeklyMatrix();
  const [highlightedTicker, setHighlightedTicker] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      fetchMatrix(SECTOR_TICKERS);
      setLoaded(true);
    }
  }, [loaded, fetchMatrix]);

  const handleRefresh = () => {
    fetchMatrix(SECTOR_TICKERS);
  };

  const handleTickerClick = (ticker: string) => {
    setHighlightedTicker(prev => prev === ticker ? null : ticker);
  };

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
              Benchmark: SPY &nbsp;|&nbsp; {SECTOR_TICKERS.join(', ')}
            </span>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isLoading}>
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
            onTickerClick={handleTickerClick}
          />
        )}
      </CardContent>
    </Card>
  );
};
