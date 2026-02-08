import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ReferenceLine, ComposedChart,
} from 'recharts';
import { MatrixRow } from '@/hooks/useWeeklyMatrix';

interface WeeklyChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: MatrixRow;
}

export const WeeklyChartModal: React.FC<WeeklyChartModalProps> = ({ open, onOpenChange, row }) => {
  const candles = row.weeklyCandles || [];

  const tooltipStyle = {
    backgroundColor: 'hsl(210 25% 11%)',
    border: '1px solid hsl(210 25% 18%)',
    borderRadius: '8px',
    fontSize: '12px',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">{row.ticker}</span>
            <Badge variant="outline" className="font-mono">
              ${row.currentPrice?.toFixed(2) ?? '—'}
            </Badge>
            <Badge className={row.emaCrossover === 'Bullish'
              ? 'bg-success/20 text-success border-success/30'
              : 'bg-destructive/20 text-destructive border-destructive/30'}
            >
              EMA: {row.emaCrossover}
            </Badge>
            <Badge className={row.macdSignal === 'Bullish'
              ? 'bg-success/20 text-success border-success/30'
              : 'bg-destructive/20 text-destructive border-destructive/30'}
            >
              MACD: {row.macdSignal}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="price" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="price">Price + EMA</TabsTrigger>
            <TabsTrigger value="macd">MACD</TabsTrigger>
            <TabsTrigger value="rsi">RSI</TabsTrigger>
          </TabsList>

          {/* Price Chart with EMA 8 & EMA 21 */}
          <TabsContent value="price">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={candles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 25% 18%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(215 20% 65%)"
                    fontSize={11}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    stroke="hsl(215 20% 65%)"
                    fontSize={11}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  {/* Candle bodies as bars */}
                  <Bar
                    dataKey="close"
                    fill="hsl(142 70% 45%)"
                    opacity={0.3}
                    name="Close"
                  />
                  <Line type="monotone" dataKey="close" stroke="hsl(142 70% 45%)" strokeWidth={2} dot={false} name="Close" />
                  <Line type="monotone" dataKey="ema8" stroke="hsl(217 91% 60%)" strokeWidth={1.5} dot={false} name="EMA 8" />
                  <Line type="monotone" dataKey="ema21" stroke="hsl(38 92% 50%)" strokeWidth={1.5} dot={false} name="EMA 21" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* MACD Chart */}
          <TabsContent value="macd">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={candles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 25% 18%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(215 20% 65%)"
                    fontSize={11}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis stroke="hsl(215 20% 65%)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={0} stroke="hsl(215 20% 65%)" strokeDasharray="3 3" />
                  <Bar
                    dataKey="histogram"
                    name="Histogram"
                    fill="hsl(142 70% 45%)"
                    opacity={0.5}
                  />
                  <Line type="monotone" dataKey="macd" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} name="MACD" />
                  <Line type="monotone" dataKey="signal" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} name="Signal" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* RSI Chart */}
          <TabsContent value="rsi">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={candles}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 25% 18%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(215 20% 65%)"
                    fontSize={11}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis
                    stroke="hsl(215 20% 65%)"
                    fontSize={11}
                    domain={[0, 100]}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={70} stroke="hsl(0 84% 60%)" strokeDasharray="5 5" label="Overbought" />
                  <ReferenceLine y={30} stroke="hsl(142 70% 45%)" strokeDasharray="5 5" label="Oversold" />
                  <Area
                    type="monotone"
                    dataKey="rsi"
                    stroke="hsl(280 100% 70%)"
                    fill="hsl(280 100% 70% / 0.15)"
                    strokeWidth={2}
                    name="RSI"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
