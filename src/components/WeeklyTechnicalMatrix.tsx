import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, RefreshCw, X, BarChart3, Loader2 } from 'lucide-react';
import { useWeeklyMatrix, MatrixRow } from '@/hooks/useWeeklyMatrix';
import { WeeklyChartModal } from './WeeklyChartModal';
import { CompanyNews } from './CompanyNews';

export const WeeklyTechnicalMatrix: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>(['SPY']);
  const [newTicker, setNewTicker] = useState('');
  const [selectedRow, setSelectedRow] = useState<MatrixRow | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [selectedNewsTicker, setSelectedNewsTicker] = useState<string | null>(null);

  const { matrixData, isLoading, fetchMatrix, news, isLoadingNews, fetchNews } = useWeeklyMatrix();

  useEffect(() => {
    if (tickers.length > 0) {
      fetchMatrix(tickers);
    }
  }, []);

  const handleAddTicker = () => {
    const ticker = newTicker.trim().toUpperCase();
    if (ticker && !tickers.includes(ticker)) {
      const updated = [...tickers, ticker];
      setTickers(updated);
      fetchMatrix(updated);
      setNewTicker('');
    }
  };

  const handleRemoveTicker = (ticker: string) => {
    if (ticker === 'SPY') return; // SPY cannot be removed
    const updated = tickers.filter(t => t !== ticker);
    setTickers(updated);
    fetchMatrix(updated);
    if (selectedNewsTicker === ticker) setSelectedNewsTicker(null);
  };

  const handleRefresh = () => {
    fetchMatrix(tickers);
  };

  const handleRowClick = (row: MatrixRow) => {
    setSelectedRow(row);
    setChartOpen(true);
    setSelectedNewsTicker(row.ticker);
    fetchNews(row.ticker);
  };

  const getRsiColor = (rsi: number | null, label: string | null) => {
    if (rsi === null) return 'text-muted-foreground';
    if (label === 'Overbought') return 'text-destructive';
    if (label === 'Oversold') return 'text-success';
    return 'text-foreground';
  };

  const getSignalBadge = (signal: string | null, type: 'ema' | 'macd') => {
    if (!signal) return <Badge variant="outline">N/A</Badge>;
    return signal === 'Bullish' ? (
      <Badge className="bg-success/20 text-success border-success/30">▲ Bullish</Badge>
    ) : (
      <Badge className="bg-destructive/20 text-destructive border-destructive/30">▼ Bearish</Badge>
    );
  };

  const getRRGBadge = (quadrant: string | null) => {
    if (!quadrant || quadrant === 'N/A') return <Badge variant="outline">N/A</Badge>;
    if (quadrant === 'Benchmark') return <Badge variant="outline" className="border-primary text-primary">Benchmark</Badge>;
    
    const colors: Record<string, string> = {
      'Leading': 'bg-success/20 text-success border-success/30',
      'Improving': 'bg-info/20 text-info border-info/30',
      'Weakening': 'bg-warning/20 text-warning border-warning/30',
      'Lagging': 'bg-destructive/20 text-destructive border-destructive/30',
    };
    return <Badge className={colors[quadrant] || ''}>{quadrant}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Weekly Technical Matrix
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add ticker..."
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
                className="w-36"
              />
              <Button size="sm" onClick={handleAddTicker} className="bg-gradient-primary">
                <Plus className="h-4 w-4" />
              </Button>
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
              <span className="ml-3 text-muted-foreground">Loading weekly data...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Ticker</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">RSI (14)</TableHead>
                    <TableHead className="text-center">EMA 8×21</TableHead>
                    <TableHead className="text-center">MACD</TableHead>
                    <TableHead className="text-center">RRG Quadrant</TableHead>
                    <TableHead className="text-center">Burst</TableHead>
                    <TableHead className="text-center w-20">Chart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrixData.map((row, index) => (
                    <TableRow
                      key={row.ticker}
                      className="cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell className="font-bold text-primary">
                        {row.ticker}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.currentPrice != null ? `$${row.currentPrice.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.rsi != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`font-mono font-semibold ${getRsiColor(row.rsi, row.rsiLabel)}`}>
                              {row.rsi.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{row.rsiLabel}</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {getSignalBadge(row.emaCrossover, 'ema')}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getSignalBadge(row.macdSignal, 'macd')}
                          {/* Remove icon for rows after SPY and first added ticker */}
                          {index >= 2 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTicker(row.ticker);
                              }}
                              className="ml-1 text-destructive hover:text-destructive/80 transition-colors"
                              title={`Remove ${row.ticker}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getRRGBadge(row.rrgQuadrant)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.burst === true ? (
                          <Badge className="bg-warning/20 text-warning border-warning/30">🚀 Burst</Badge>
                        ) : row.burst === false ? (
                          <span className="text-muted-foreground">—</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row);
                          }}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {matrixData.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Click Refresh to load weekly technical data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart Modal */}
      {selectedRow && (
        <WeeklyChartModal
          open={chartOpen}
          onOpenChange={setChartOpen}
          row={selectedRow}
        />
      )}

      {/* Company News */}
      {selectedNewsTicker && (
        <CompanyNews
          ticker={selectedNewsTicker}
          articles={news}
          isLoading={isLoadingNews}
        />
      )}
    </div>
  );
};
