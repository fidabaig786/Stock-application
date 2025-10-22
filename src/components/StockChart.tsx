import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, BarChart3, Activity, Calendar } from 'lucide-react';

interface StockChartProps {
  ticker: string;
}

// Mock data generator for demonstration
const generateMockData = (days: number) => {
  const data = [];
  let price = 150 + Math.random() * 100;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Generate realistic price movement
    price += (Math.random() - 0.5) * 10;
    price = Math.max(50, Math.min(300, price)); // Keep within reasonable bounds
    
    // Generate technical indicators
    const rsi = 30 + Math.random() * 40; // RSI between 30-70
    const macd = (Math.random() - 0.5) * 5;
    const signal = macd + (Math.random() - 0.5) * 2;
    const volume = Math.floor(Math.random() * 10000000) + 1000000;
    
    data.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
      macd: parseFloat(macd.toFixed(3)),
      signal: parseFloat(signal.toFixed(3)),
      volume: volume,
      ema8: price + (Math.random() - 0.5) * 5,
      ema21: price + (Math.random() - 0.5) * 8,
    });
  }
  
  return data;
};

export const StockChart: React.FC<StockChartProps> = ({ ticker }) => {
  const [timeframe, setTimeframe] = useState('3M');
  const [selectedChart, setSelectedChart] = useState('price');
  
  const getDays = (tf: string) => {
    switch (tf) {
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
      default: return 90;
    }
  };
  
  const data = generateMockData(getDays(timeframe));
  const latestPrice = data[data.length - 1]?.price || 0;
  const previousPrice = data[data.length - 2]?.price || 0;
  const priceChange = latestPrice - previousPrice;
  const priceChangePercent = (priceChange / previousPrice) * 100;

  return (
    <div className="space-y-6">
      {/* Chart Header */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {ticker} Analysis
              </CardTitle>
              <CardDescription>
                Technical analysis charts and indicators
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">${latestPrice.toFixed(2)}</p>
                <div className="flex items-center gap-1">
                  <Badge variant={priceChange >= 0 ? "default" : "destructive"} className={priceChange >= 0 ? "bg-success" : ""}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chart Controls */}
      <Card className="bg-gradient-card shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1M">1M</SelectItem>
                  <SelectItem value="3M">3M</SelectItem>
                  <SelectItem value="6M">6M</SelectItem>
                  <SelectItem value="1Y">1Y</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              {['price', 'rsi', 'macd'].map((chart) => (
                <Button
                  key={chart}
                  variant={selectedChart === chart ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedChart(chart)}
                  className={selectedChart === chart ? "bg-primary" : ""}
                >
                  {chart.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6">
        {selectedChart === 'price' && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Price Chart with EMAs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                      name="Price"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ema8" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={1}
                      dot={false}
                      name="EMA 8"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ema21" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={1}
                      dot={false}
                      name="EMA 21"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedChart === 'rsi' && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                RSI Indicator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rsi" 
                      stroke="hsl(var(--chart-4))" 
                      fill="hsl(var(--chart-4) / 0.2)"
                      strokeWidth={2}
                      name="RSI"
                    />
                    <Line 
                      type="monotone" 
                      dataKey={() => 70} 
                      stroke="hsl(var(--destructive))" 
                      strokeDasharray="5 5"
                      name="Overbought (70)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey={() => 30} 
                      stroke="hsl(var(--success))" 
                      strokeDasharray="5 5"
                      name="Oversold (30)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedChart === 'macd' && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                MACD Indicator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="macd" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={false}
                      name="MACD"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="signal" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      dot={false}
                      name="Signal"
                    />
                    <Line 
                      type="monotone" 
                      dataKey={() => 0} 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeDasharray="5 5"
                      name="Zero Line"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};