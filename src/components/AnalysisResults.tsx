import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, Activity, ExternalLink } from 'lucide-react';
import { AnalysisResult } from './TradingDashboard';
import { useAuth } from '@/hooks/useAuth';

interface AnalysisResultsProps {
  results: AnalysisResult[];
}

const getStatusIcon = (status: string) => {
  if (status.startsWith('✅')) {
    return <CheckCircle className="h-4 w-4 text-success" />;
  } else if (status.startsWith('⚠️')) {
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  } else {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
};

const getStatusBadge = (status: string) => {
  if (status.startsWith('✅')) {
    return <Badge variant="default" className="bg-success text-success-foreground">Passed</Badge>;
  } else if (status.startsWith('⚠️')) {
    return <Badge variant="default" className="bg-warning text-warning-foreground">Warning</Badge>;
  } else {
    return <Badge variant="destructive">Failed</Badge>;
  }
};

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ results }) => {
  const { user } = useAuth();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const passedResults = results.filter(r => r.passed);
  const totalResults = results.length;

  const handleTickerClick = (ticker: string) => {
    setSelectedTicker(ticker);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen || !selectedTicker || !widgetContainerRef.current) return;

    const container = widgetContainerRef.current;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: selectedTicker,
      interval: 'W',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    });

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';

    container.appendChild(widgetDiv);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [isOpen, selectedTicker]);

  return (
    <div className="space-y-6">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-sm truncate">{selectedTicker}</DialogTitle>
          </DialogHeader>
          <div
            ref={widgetContainerRef}
            className="tradingview-widget-container w-full flex-1 rounded-b-lg"
            style={{ height: 'calc(85vh - 60px)' }}
          />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-success shadow-trading">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-success-foreground" />
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Passed Analysis</p>
                <p className="text-2xl font-bold text-success-foreground">{passedResults.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Analyzed</p>
                <p className="text-2xl font-bold">{totalResults}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-info" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{totalResults > 0 ? Math.round((passedResults.length / totalResults) * 100) : 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Results */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Analysis Results
          </CardTitle>
          <CardDescription>
            Detailed technical analysis results for each ticker
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {passedResults.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-success">✅ Tickers Meeting Criteria ({passedResults.length})</h3>
                <div className="grid gap-4">
                  {passedResults.map((result) => (
                    <div key={result.ticker} className="border rounded-lg p-4 bg-card/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleTickerClick(result.ticker)}
                            className="text-xl font-bold hover:text-primary transition-colors cursor-pointer flex items-center gap-2"
                          >
                            {result.ticker}
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <Badge variant={result.assetType === 'Stock' ? 'default' : 'secondary'}>
                            {result.assetType}
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {result.currentPrice}
                          </Badge>
                        </div>
                        <Badge variant="default" className="bg-success text-success-foreground">
                          Passed
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {Object.entries(result).map(([key, value]) => {
                          if (['ticker', 'assetType', 'currentPrice', 'passed', 'rsiValue', 'nextEarningDate'].includes(key)) return null;
                          
                           // Filter indicators based on asset type
                           if (result.assetType === 'Stock') {
                             // Only show EMA Crossover, Weekly MACD, and Burst for stocks
                             if (!['emaCrossover', 'weeklyMacd', 'burst'].includes(key)) return null;
                           } else {
                             // For options, exclude burst (show mrt and other option indicators)
                             if (key === 'burst') return null;
                           }
                          
                          return (
                            <div key={key} className="flex items-start gap-2">
                              {getStatusIcon(value)}
                              <div>
                                <p className="font-medium capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </p>
                                <p className="text-muted-foreground text-xs">{value}</p>
                              </div>
                            </div>
                          );
                        })}
                        {result.rsiValue !== null && result.rsiValue !== undefined && (
                          <div className="flex items-start gap-2">
                            <Activity className="h-4 w-4 text-info" />
                            <div>
                              <p className="font-medium">RSI</p>
                              <p className="text-muted-foreground text-xs">{result.rsiValue.toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                        {result.nextEarningDate && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <div>
                              <p className="font-medium">Next Earnings</p>
                              <p className="text-muted-foreground text-xs">{result.nextEarningDate}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.filter(r => !r.passed).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-muted-foreground">❌ Tickers Not Meeting Criteria</h3>
                <div className="grid gap-4">
                  {results.filter(r => !r.passed).map((result) => (
                    <div key={result.ticker} className="border rounded-lg p-4 bg-card/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleTickerClick(result.ticker)}
                            className="text-xl font-bold hover:text-primary transition-colors cursor-pointer flex items-center gap-2"
                          >
                            {result.ticker}
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <Badge variant={result.assetType === 'Stock' ? 'outline' : 'secondary'}>
                            {result.assetType}
                          </Badge>
                          <span className="text-sm text-muted-foreground font-mono">
                            {result.currentPrice}
                          </span>
                        </div>
                        <Badge variant="destructive">Failed</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {Object.entries(result).map(([key, value]) => {
                          if (['ticker', 'assetType', 'currentPrice', 'passed', 'rsiValue', 'nextEarningDate'].includes(key)) return null;

                           // Filter indicators based on asset type
                           if (result.assetType === 'Stock') {
                             if (!['emaCrossover', 'weeklyMacd', 'burst'].includes(key)) return null;
                           } else {
                             if (key === 'burst') return null;
                           }

                          return (
                            <div key={key} className="flex items-start gap-2">
                              {getStatusIcon(String(value))}
                              <div>
                                <p className="font-medium capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </p>
                                <p className="text-muted-foreground text-xs">{String(value)}</p>
                              </div>
                            </div>
                          );
                        })}
                        {result.rsiValue !== null && result.rsiValue !== undefined && (
                          <div className="flex items-start gap-2">
                            <Activity className="h-4 w-4 text-info" />
                            <div>
                              <p className="font-medium">RSI</p>
                              <p className="text-muted-foreground text-xs">{result.rsiValue.toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                        {result.nextEarningDate && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <div>
                              <p className="font-medium">Next Earnings</p>
                              <p className="text-muted-foreground text-xs">{result.nextEarningDate}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};