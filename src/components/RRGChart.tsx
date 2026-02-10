import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Cell,
  Label,
} from 'recharts';
import { MatrixRow, RRGTrailPoint } from '@/hooks/useWeeklyMatrix';

const TICKER_COLORS = [
  'hsl(210, 90%, 55%)',
  'hsl(340, 80%, 55%)',
  'hsl(160, 70%, 45%)',
  'hsl(40, 90%, 50%)',
  'hsl(280, 70%, 55%)',
  'hsl(20, 85%, 55%)',
  'hsl(190, 80%, 45%)',
  'hsl(310, 70%, 50%)',
  'hsl(100, 60%, 45%)',
  'hsl(0, 75%, 55%)',
];

interface RRGChartProps {
  data: MatrixRow[];
  highlightedTicker: string | null;
  onTickerClick: (ticker: string) => void;
}

function getQuadrant(rs: number, mom: number): string {
  if (rs >= 100 && mom >= 100) return 'Leading';
  if (rs >= 100 && mom < 100) return 'Weakening';
  if (rs < 100 && mom < 100) return 'Lagging';
  return 'Improving';
}

interface TrailDataPoint {
  x: number;
  y: number;
  ticker: string;
  isLatest: boolean;
  trailIndex: number;
  trailLength: number;
  date: string;
  quadrant: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TrailDataPoint;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md text-popover-foreground">
      <p className="font-bold">{d.ticker}</p>
      <p>RS-Ratio: {d.x.toFixed(2)}</p>
      <p>RS-Momentum: {d.y.toFixed(2)}</p>
      <p>Quadrant: {d.quadrant}</p>
      <p className="text-muted-foreground text-xs">{d.date}</p>
    </div>
  );
};

export const RRGChart: React.FC<RRGChartProps> = ({ data, highlightedTicker, onTickerClick }) => {
  const { trailPoints, domain } = useMemo(() => {
    const nonSPY = data.filter(r => r.ticker !== 'SPY' && r.rrgTrail && r.rrgTrail.length > 0);
    const colorMap: Record<string, string> = {};
    nonSPY.forEach((r, i) => {
      colorMap[r.ticker] = TICKER_COLORS[i % TICKER_COLORS.length];
    });

    const points: TrailDataPoint[] = [];
    let minX = 98, maxX = 102, minY = 98, maxY = 102;

    nonSPY.forEach(row => {
      const trail = row.rrgTrail;
      trail.forEach((pt, idx) => {
        if (pt.rsRatio < minX) minX = pt.rsRatio;
        if (pt.rsRatio > maxX) maxX = pt.rsRatio;
        if (pt.rsMomentum < minY) minY = pt.rsMomentum;
        if (pt.rsMomentum > maxY) maxY = pt.rsMomentum;
        points.push({
          x: pt.rsRatio,
          y: pt.rsMomentum,
          ticker: row.ticker,
          isLatest: idx === trail.length - 1,
          trailIndex: idx,
          trailLength: trail.length,
          date: pt.date,
          quadrant: getQuadrant(pt.rsRatio, pt.rsMomentum),
        });
      });
    });

    // Pad domain symmetrically around 100
    const pad = 1;
    const extent = Math.max(maxX - 100, 100 - minX, maxY - 100, 100 - minY, 2) + pad;
    const lo = Math.floor(100 - extent);
    const hi = Math.ceil(100 + extent);

    return {
      trailPoints: points,
      domain: [lo, hi] as [number, number],
      colorMap,
    };
  }, [data]);

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    data.filter(r => r.ticker !== 'SPY').forEach((r, i) => {
      m[r.ticker] = TICKER_COLORS[i % TICKER_COLORS.length];
    });
    return m;
  }, [data]);

  // Group by ticker for line rendering
  const tickerGroups = useMemo(() => {
    const groups: Record<string, TrailDataPoint[]> = {};
    trailPoints.forEach(p => {
      if (!groups[p.ticker]) groups[p.ticker] = [];
      groups[p.ticker].push(p);
    });
    return groups;
  }, [trailPoints]);

  return (
    <div className="w-full h-[520px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 30 }}>
          {/* Quadrant backgrounds */}
          <ReferenceArea x1={100} x2={domain[1]} y1={100} y2={domain[1]} fill="hsl(130, 50%, 90%)" fillOpacity={0.5} />
          <ReferenceArea x1={100} x2={domain[1]} y1={domain[0]} y2={100} fill="hsl(45, 80%, 90%)" fillOpacity={0.5} />
          <ReferenceArea x1={domain[0]} x2={100} y1={domain[0]} y2={100} fill="hsl(0, 60%, 92%)" fillOpacity={0.5} />
          <ReferenceArea x1={domain[0]} x2={100} y1={100} y2={domain[1]} fill="hsl(210, 60%, 92%)" fillOpacity={0.5} />

          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <ReferenceLine x={100} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
          <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />

          <XAxis
            type="number"
            dataKey="x"
            domain={domain}
            tick={{ fontSize: 11 }}
            tickLine={false}
          >
            <Label value="RS-Ratio →" position="bottom" offset={10} className="text-xs fill-muted-foreground" />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            domain={domain}
            tick={{ fontSize: 11 }}
            tickLine={false}
          >
            <Label value="RS-Momentum →" angle={-90} position="left" offset={10} className="text-xs fill-muted-foreground" />
          </YAxis>

          <Tooltip content={<CustomTooltip />} />

          {/* Trail lines rendered as individual scatters per ticker with line */}
          {Object.entries(tickerGroups).map(([ticker, pts]) => (
            <Scatter
              key={ticker}
              data={pts}
              line={{ strokeWidth: 1.5, stroke: colorMap[ticker] }}
              lineType="joint"
              onClick={() => onTickerClick(ticker)}
              cursor="pointer"
            >
              {pts.map((pt, i) => {
                const opacity = pt.isLatest ? 1 : 0.25 + (pt.trailIndex / pt.trailLength) * 0.5;
                const size = pt.isLatest ? 80 : 20 + (pt.trailIndex / pt.trailLength) * 20;
                const isHighlighted = highlightedTicker === ticker;
                return (
                  <Cell
                    key={i}
                    fill={colorMap[ticker]}
                    fillOpacity={isHighlighted ? 1 : highlightedTicker ? opacity * 0.3 : opacity}
                    r={Math.sqrt(size / Math.PI)}
                    stroke={pt.isLatest && isHighlighted ? 'hsl(var(--foreground))' : 'none'}
                    strokeWidth={pt.isLatest && isHighlighted ? 2 : 0}
                  />
                );
              })}
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant labels */}
      <div className="absolute top-6 right-10 text-xs font-semibold text-success/70 pointer-events-none">Leading</div>
      <div className="absolute bottom-10 right-10 text-xs font-semibold text-warning/70 pointer-events-none">Weakening</div>
      <div className="absolute bottom-10 left-10 text-xs font-semibold text-destructive/70 pointer-events-none">Lagging</div>
      <div className="absolute top-6 left-10 text-xs font-semibold text-info/70 pointer-events-none">Improving</div>

      {/* Ticker labels on latest points */}
      <div className="absolute inset-0 pointer-events-none">
        {Object.entries(tickerGroups).map(([ticker, pts]) => {
          const latest = pts.find(p => p.isLatest);
          if (!latest) return null;
          return (
            <div
              key={ticker}
              className="absolute text-[10px] font-bold pointer-events-none"
              style={{
                color: colorMap[ticker],
                opacity: highlightedTicker && highlightedTicker !== ticker ? 0.3 : 1,
              }}
            >
              {/* Labels are positioned by the chart itself via tooltip; 
                  we skip manual absolute positioning for simplicity */}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {Object.entries(colorMap).map(([ticker, color]) => (
          <button
            key={ticker}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border transition-all cursor-pointer ${
              highlightedTicker === ticker
                ? 'border-foreground bg-muted'
                : highlightedTicker
                  ? 'opacity-40 border-transparent'
                  : 'border-transparent hover:bg-muted/50'
            }`}
            onClick={() => onTickerClick(ticker)}
          >
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
            {ticker}
          </button>
        ))}
      </div>
    </div>
  );
};
