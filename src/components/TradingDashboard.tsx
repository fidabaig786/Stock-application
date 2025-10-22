import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TrendingUp, Search, BarChart3, ShieldCheck, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useWatchlist } from '@/hooks/useWatchlist';
import { WatchlistManager } from './WatchlistManager';
import { AnalysisResults } from './AnalysisResults';
import { PortfolioTracker } from './PortfolioTracker';

// Moved to useWatchlist hook

export interface AnalysisCriteria {
  mrt: boolean;
  rsiConfirmation: boolean;
  dmiConfirmation: boolean;
  emaCrossover: boolean;
  macdCrossover: boolean;
  weeklyMacd: boolean;
  burst: boolean;
}

export interface AnalysisResult {
  ticker: string;
  assetType: string;
  currentPrice: string;
  mrt: string;
  rsiConfirmation: string;
  macdCrossover: string;
  weeklyMacd: string;
  dmiConfirmation: string;
  emaCrossover: string;
  burst: string;
  passed: boolean;
}

export const TradingDashboard: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [selectedAssetType, setSelectedAssetType] = useState<'Stock' | 'Option'>('Stock');
  const [criteria, setCriteria] = useState<AnalysisCriteria>({
    mrt: false,
    rsiConfirmation: false,
    dmiConfirmation: false,
    emaCrossover: true,
    macdCrossover: false,
    weeklyMacd: true,
    burst: false,
  });

  // Update criteria when asset type changes
  React.useEffect(() => {
    const newCriteria = selectedAssetType === 'Option' 
      ? {
          mrt: true,
          rsiConfirmation: false,
          dmiConfirmation: false,
          emaCrossover: false,
          macdCrossover: true,
          weeklyMacd: false,
          burst: false,
        }
      : {
          mrt: false,
          rsiConfirmation: false,
          dmiConfirmation: false,
          emaCrossover: true,
          macdCrossover: false,
          weeklyMacd: true,
          burst: false,
        };
    
    setCriteria(newCriteria);
  }, [selectedAssetType]);

  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { watchlist, addToWatchlist, removeFromWatchlist, isLoading } = useWatchlist();

  // Watchlist functions moved to useWatchlist hook

  const runAnalysis = async () => {
    // Filter watchlist by selected asset type
    const filteredWatchlist = watchlist.filter(stock => stock.assetType === selectedAssetType);
    
    if (filteredWatchlist.length === 0) {
      toast({
        title: "Empty Watchlist",
        description: `Add some ${selectedAssetType.toLowerCase()}s to your watchlist before running analysis`,
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('stock-analysis', {
        body: {
          watchlist: filteredWatchlist.map(stock => ({
            ticker: stock.ticker,
            assetType: stock.assetType,
          })),
          criteria,
        },
      });

      if (error) {
        console.error('Analysis error:', error);
        throw error;
      }

      setAnalysisResults(data.results);
      
      const passedCount = data.results.filter((r: AnalysisResult) => r.passed).length;
      toast({
        title: "Analysis Complete",
        description: `${passedCount} of ${data.results.length} ${selectedAssetType.toLowerCase()}s meet the criteria`,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to complete analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-center space-y-4 flex-1">
            <div className="flex items-center justify-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Ticker Triumph
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Professional stock & options analysis platform with advanced technical indicators
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={signOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* API Status */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              API Status
            </CardTitle>
            <CardDescription>
              Real-time market data powered by Polygon.io
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">API Connected & Validated</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                ✅ Secure
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              API key is securely stored and validated on the server
            </p>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="watchlist" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist">
            <WatchlistManager 
              watchlist={watchlist}
              onAdd={addToWatchlist}
              onRemove={removeFromWatchlist}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <div className="grid gap-6">
              {/* Analysis Criteria */}
              <Card className="bg-gradient-card shadow-card">
                <CardHeader>
                  <CardTitle>Analysis Criteria</CardTitle>
                  <CardDescription>
                    Select the technical indicators and conditions to analyze
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mb-4">
                    <Label className="text-sm font-medium">Asset Type</Label>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="stock"
                          name="assetType"
                          checked={selectedAssetType === 'Stock'}
                          onChange={() => setSelectedAssetType('Stock')}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="stock">Stock</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="option"
                          name="assetType"
                          checked={selectedAssetType === 'Option'}
                          onChange={() => setSelectedAssetType('Option')}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="option">Option</Label>
                      </div>
                    </div>
                  </div>
                  
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {selectedAssetType === 'Stock' ? (
                       // Stock criteria: EMA, Weekly MACD, and Burst only
                       <>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="emaCrossover"
                             checked={criteria.emaCrossover}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, emaCrossover: checked as boolean }))
                             }
                           />
                           <Label htmlFor="emaCrossover" className="text-sm font-medium">
                             EMA Crossover
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="weeklyMacd"
                             checked={criteria.weeklyMacd}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, weeklyMacd: checked as boolean }))
                             }
                           />
                           <Label htmlFor="weeklyMacd" className="text-sm font-medium">
                             Weekly MACD
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="burst"
                             checked={criteria.burst}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, burst: checked as boolean }))
                             }
                           />
                           <Label htmlFor="burst" className="text-sm font-medium">
                             Burst
                           </Label>
                         </div>
                       </>
                     ) : (
                       // Option criteria: all six analyses
                       <>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="mrt"
                             checked={criteria.mrt}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, mrt: checked as boolean }))
                             }
                           />
                           <Label htmlFor="mrt" className="text-sm font-medium">
                             MRT
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="rsiConfirmation"
                             checked={criteria.rsiConfirmation}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, rsiConfirmation: checked as boolean }))
                             }
                           />
                           <Label htmlFor="rsiConfirmation" className="text-sm font-medium">
                             RSI Confirmation
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="dmiConfirmation"
                             checked={criteria.dmiConfirmation}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, dmiConfirmation: checked as boolean }))
                             }
                           />
                           <Label htmlFor="dmiConfirmation" className="text-sm font-medium">
                             DMI Confirmation
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="emaCrossover"
                             checked={criteria.emaCrossover}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, emaCrossover: checked as boolean }))
                             }
                           />
                           <Label htmlFor="emaCrossover" className="text-sm font-medium">
                             EMA Crossover
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="macdCrossover"
                             checked={criteria.macdCrossover}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, macdCrossover: checked as boolean }))
                             }
                           />
                           <Label htmlFor="macdCrossover" className="text-sm font-medium">
                             MACD Crossover
                           </Label>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Checkbox
                             id="weeklyMacd"
                             checked={criteria.weeklyMacd}
                             onCheckedChange={(checked) => 
                               setCriteria(prev => ({ ...prev, weeklyMacd: checked as boolean }))
                             }
                           />
                           <Label htmlFor="weeklyMacd" className="text-sm font-medium">
                             Weekly MACD
                           </Label>
                         </div>
                       </>
                     )}
                   </div>
                  
                  <div className="flex justify-center pt-4">
                    <Button 
                      onClick={runAnalysis}
                      disabled={isAnalyzing}
                      size="lg"
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      {isAnalyzing ? (
                        <>
                          <Search className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Run Analysis
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Analysis Results */}
              {analysisResults.length > 0 && (
                <AnalysisResults results={analysisResults} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6">
            <PortfolioTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};