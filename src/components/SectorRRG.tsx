import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, PieChart, TrendingUp, BarChart3, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SectorRecord {
  ticker: string;
  sector: string;
  returns: Record<string, number | null>;
  vsSpy: Record<string, number | null>;
  momentum: number | null;
  breadth: number | null;
  rsTrendLabel: string;
  composite: number | null;
  compositeLabel: string;
  trajectory: {
    arrow: string;
    delta: number;
    history: Array<{ date: string; score: number }>;
  };
}

interface BullSpreadItem {
  ticker: string;
  sector: string;
  passes: boolean;
  reason: string;
  trajectorySignal: string;
  entryQuality: string;
  composite: number | null;
  momentum: number | null;
  breadth: number | null;
  rsTrendLabel: string;
}

interface DashboardData {
  sectors: SectorRecord[];
  spyReturns: Record<string, number | null>;
  bullSpread: BullSpreadItem[];
  asOf: string;
}

const TFS = ["1W", "1M", "3M", "6M", "YTD", "1Y"];

function fmt(v: number | null | undefined, suffix = "%"): string {
  if (v === null || v === undefined) return "N/A";
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}${suffix}`;
}

function getReturnColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return "text-muted-foreground";
  if (v >= 5) return "text-success font-semibold";
  if (v > 0) return "text-success";
  if (v <= -5) return "text-destructive font-semibold";
  return "text-destructive";
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 75) return "text-success font-bold";
  if (score >= 60) return "text-success";
  if (score >= 45) return "text-foreground";
  if (score >= 30) return "text-destructive";
  return "text-destructive font-bold";
}

function getCompositeVariant(label: string): "default" | "secondary" | "destructive" | "outline" {
  if (label === "Strong buy" || label === "Buy") return "default";
  if (label === "Neutral") return "secondary";
  if (label === "Sell" || label === "Strong sell") return "destructive";
  return "outline";
}

// ─── Performance Heatmap ───

const PerformanceHeatmap: React.FC<{ sectors: SectorRecord[]; spyReturns: Record<string, number | null> }> = ({ sectors, spyReturns }) => (
  <Card className="bg-gradient-card shadow-card">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <BarChart3 className="h-4 w-4 text-primary" />
        Performance Heatmap
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ticker</TableHead>
              <TableHead className="w-32">Sector</TableHead>
              {TFS.map(tf => <TableHead key={tf} className="text-right w-16">{tf}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map(s => (
              <TableRow key={s.ticker}>
                <TableCell className="font-bold text-primary">{s.ticker}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{s.sector}</TableCell>
                {TFS.map(tf => (
                  <TableCell key={tf} className={`text-right font-mono text-xs ${getReturnColor(s.returns[tf])}`}>
                    {fmt(s.returns[tf])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-bold">SPY</TableCell>
              <TableCell className="text-muted-foreground text-xs">S&P 500</TableCell>
              {TFS.map(tf => (
                <TableCell key={tf} className={`text-right font-mono text-xs ${getReturnColor(spyReturns[tf])}`}>
                  {fmt(spyReturns[tf])}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

// ─── Relative Strength vs SPY ───

const RSHeatmap: React.FC<{ sectors: SectorRecord[] }> = ({ sectors }) => (
  <Card className="bg-gradient-card shadow-card">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <TrendingUp className="h-4 w-4 text-primary" />
        Relative Strength vs SPY
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ticker</TableHead>
              <TableHead className="w-32">Sector</TableHead>
              {TFS.map(tf => <TableHead key={tf} className="text-right w-16">{tf}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map(s => (
              <TableRow key={s.ticker}>
                <TableCell className="font-bold text-primary">{s.ticker}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{s.sector}</TableCell>
                {TFS.map(tf => (
                  <TableCell key={tf} className={`text-right font-mono text-xs ${getReturnColor(s.vsSpy[tf])}`}>
                    {fmt(s.vsSpy[tf])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

// ─── Composite Ranking ───

const CompositeRanking: React.FC<{ sectors: SectorRecord[] }> = ({ sectors }) => (
  <Card className="bg-gradient-card shadow-card">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <BarChart3 className="h-4 w-4 text-primary" />
        Composite Ranking
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="w-16">Ticker</TableHead>
              <TableHead className="w-32">Sector</TableHead>
              <TableHead className="text-right w-16">Score</TableHead>
              <TableHead className="text-right w-20">Momentum</TableHead>
              <TableHead className="text-right w-20">Breadth</TableHead>
              <TableHead className="text-center w-20">RS Trend</TableHead>
              <TableHead className="text-center w-16">Trend</TableHead>
              <TableHead className="w-40">History</TableHead>
              <TableHead className="text-center w-24">Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((s, i) => (
              <TableRow key={s.ticker}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-bold text-primary">{s.ticker}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{s.sector}</TableCell>
                <TableCell className={`text-right font-mono ${getScoreColor(s.composite)}`}>
                  {s.composite !== null ? s.composite.toFixed(1) : 'N/A'}
                </TableCell>
                <TableCell className={`text-right font-mono text-xs ${getScoreColor(s.momentum)}`}>
                  {s.momentum !== null ? s.momentum.toFixed(1) : 'N/A'}
                </TableCell>
                <TableCell className={`text-right font-mono text-xs ${s.breadth !== null && s.breadth >= 50 ? 'text-success' : 'text-destructive'}`}>
                  {s.breadth !== null ? `${s.breadth.toFixed(1)}%` : 'N/A'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={s.rsTrendLabel === 'Rising' ? 'default' : s.rsTrendLabel === 'Falling' ? 'destructive' : 'secondary'} className="text-xs">
                    {s.rsTrendLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {s.trajectory ? `${s.trajectory.arrow} ${s.trajectory.delta >= 0 ? '+' : ''}${s.trajectory.delta.toFixed(1)}` : '—'}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {s.trajectory?.history?.length
                    ? s.trajectory.history.map(h => h.score.toFixed(0)).join(' → ')
                    : 'no history'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={getCompositeVariant(s.compositeLabel)} className="text-xs">
                    {s.compositeLabel}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

// ─── Bull Spread Filter ───

const BullSpreadFilter: React.FC<{ items: BullSpreadItem[] }> = ({ items }) => {
  const passed = items.filter(i => i.passes);
  const failed = items.filter(i => !i.passes);

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-primary" />
          45-Day Bull Spread Filter
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Filters: Score ≥ 60 | RS = Rising | Momentum &gt; 45 | Breadth &gt; 50%
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ticker</TableHead>
                <TableHead className="w-32">Sector</TableHead>
                <TableHead className="text-right w-16">Score</TableHead>
                <TableHead className="text-right w-16">Mom</TableHead>
                <TableHead className="text-right w-20">Breadth</TableHead>
                <TableHead className="text-center w-20">RS</TableHead>
                <TableHead className="text-center w-20">Trend</TableHead>
                <TableHead className="w-40">Entry Quality</TableHead>
                <TableHead className="w-48">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passed.length > 0 ? passed.map(item => (
                <TableRow key={item.ticker} className="bg-success/5">
                  <TableCell className="font-bold text-success">{item.ticker}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{item.sector}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{item.composite?.toFixed(1) ?? 'N/A'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{item.momentum?.toFixed(1) ?? 'N/A'}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{item.breadth !== null ? `${item.breadth.toFixed(1)}%` : 'N/A'}</TableCell>
                  <TableCell className="text-center text-xs">{item.rsTrendLabel}</TableCell>
                  <TableCell className="text-center text-xs">{item.trajectorySignal}</TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-xs">✓ {item.entryQuality}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.reason}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                    No sectors pass all filters this week.
                  </TableCell>
                </TableRow>
              )}
              {failed.length > 0 && (
                <>
                  <TableRow>
                    <TableCell colSpan={9} className="text-xs font-semibold text-muted-foreground pt-4 pb-1 border-t">
                      FILTERED OUT
                    </TableCell>
                  </TableRow>
                  {failed.map(item => (
                    <TableRow key={item.ticker} className="opacity-60">
                      <TableCell className="font-bold text-muted-foreground">{item.ticker}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.sector}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{item.composite?.toFixed(1) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{item.momentum?.toFixed(1) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{item.breadth !== null ? `${item.breadth.toFixed(1)}%` : 'N/A'}</TableCell>
                      <TableCell className="text-center text-xs">{item.rsTrendLabel}</TableCell>
                      <TableCell className="text-center text-xs">{item.trajectorySignal}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">✗</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive">{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Component ───

export const SectorRRG: React.FC = () => {
  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
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

      // RRG chart data
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

      // Dashboard data
      if (data.dashboard) {
        setDashboard(data.dashboard);
      }
    } catch (error) {
      console.error('Sector RRG fetch error:', error);
      toast({
        title: 'Sector RRG Error',
        description: 'Failed to fetch sector data. Please try again.',
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
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PieChart className="h-5 w-5 text-primary" />
          Sector Rotation Dashboard
        </h2>
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

      {isLoading && !dashboard && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading sector rotation data (this may take a minute)...</span>
        </div>
      )}

      {/* Dashboard Tables */}
      {dashboard && (
        <>
          <PerformanceHeatmap sectors={dashboard.sectors} spyReturns={dashboard.spyReturns} />
          <RSHeatmap sectors={dashboard.sectors} />
          <CompositeRanking sectors={dashboard.sectors} />
          <BullSpreadFilter items={dashboard.bullSpread} />
        </>
      )}
    </div>
  );
};
