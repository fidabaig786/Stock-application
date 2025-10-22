import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Trash2, Edit2, ExternalLink, AlertTriangle } from 'lucide-react';
import { usePortfolio, PortfolioPosition } from '@/hooks/usePortfolio';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const PortfolioTracker: React.FC = () => {
  const { user } = useAuth();
  const { positions, isLoading, addPosition, removePosition, fetchCurrentPrices, updatePosition } = usePortfolio(user?.id);
  const { toast } = useToast();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cashBalance, setCashBalance] = useState<string>('0');
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [formData, setFormData] = useState({
    ticker: '',
    shares: '',
    buy_price: '',
    buy_date: '',
    index_ticker: 'SPY',
    index_buy_price: '',
    stop_loss_price: '',
    holding: '1',
    comments: ''
  });

  useEffect(() => {
    if (positions.length > 0) {
      fetchCurrentPrices();
    }
  }, [positions.length]);

  useEffect(() => {
    const fetchCashBalance = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('cash_balance')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setCashBalance(data.cash_balance?.toString() || '0');
        } else {
          // Create user_settings if it doesn't exist
          await supabase
            .from('user_settings')
            .insert({ user_id: user.id, cash_balance: 0 });
          setCashBalance('0');
        }
      } catch (error) {
        console.error('Error fetching cash balance:', error);
      }
    };

    fetchCashBalance();
  }, [user?.id]);

  const handleCashBalanceUpdate = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id, 
          cash_balance: parseFloat(cashBalance) || 0 
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Cash balance updated",
      });
      setIsEditingCash(false);
    } catch (error) {
      console.error('Error updating cash balance:', error);
      toast({
        title: "Error",
        description: "Failed to update cash balance",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const positionData = {
      ticker: formData.ticker.toUpperCase(),
      shares: parseFloat(formData.shares),
      buy_price: parseFloat(formData.buy_price),
      buy_date: formData.buy_date,
      index_ticker: formData.index_ticker.toUpperCase(),
      index_buy_price: parseFloat(formData.index_buy_price),
      stop_loss_price: formData.stop_loss_price ? parseFloat(formData.stop_loss_price) : undefined,
      holding: parseInt(formData.holding),
      comments: formData.comments || undefined
    };

    if (editingId) {
      await updatePosition(editingId, positionData);
      setEditingId(null);
    } else {
      await addPosition(positionData);
    }

    setFormData({
      ticker: '',
      shares: '',
      buy_price: '',
      buy_date: '',
      index_ticker: 'SPY',
      index_buy_price: '',
      stop_loss_price: '',
      holding: '1',
      comments: ''
    });
    setShowAddForm(false);
  };

  const handleEdit = (position: PortfolioPosition) => {
    setFormData({
      ticker: position.ticker,
      shares: position.shares.toString(),
      buy_price: position.buy_price.toString(),
      buy_date: position.buy_date,
      index_ticker: position.index_ticker,
      index_buy_price: position.index_buy_price.toString(),
      stop_loss_price: position.stop_loss_price?.toString() || '',
      holding: position.holding.toString(),
      comments: position.comments || ''
    });
    setEditingId(position.id);
    setShowAddForm(true);
  };

  const handleTickerClick = async (ticker: string) => {
    try {
      const { data, error } = await supabase
        .from('watchlist_items')
        .select('company_url')
        .eq('ticker', ticker)
        .maybeSingle();

      if (error) throw error;

      if (data?.company_url) {
        window.open(data.company_url, '_blank', 'noopener,noreferrer');
      } else {
        toast({
          title: "Company URL not found",
          description: `No company chart URL found for ${ticker}. Add it to your watchlist first.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching company URL:', error);
      toast({
        title: "Error",
        description: "Failed to fetch company information",
        variant: "destructive",
      });
    }
  };

  const calculateMetrics = (position: PortfolioPosition) => {
    const currentPrice = position.current_price || position.buy_price;
    const indexCurrentPrice = position.index_current_price || position.index_buy_price;
    
    const buyValue = position.shares * position.buy_price;
    const currentValue = position.shares * currentPrice;
    const dollarChange = currentValue - buyValue;
    const percentChange = ((currentPrice / position.buy_price) - 1) * 100;
    const stopLossProfit = position.stop_loss_price 
      ? (position.stop_loss_price - position.buy_price) * position.shares 
      : 0;
    const stopLossPercent = position.stop_loss_price 
      ? (stopLossProfit / (position.buy_price * position.shares)) * 100
      : 0;
    const indexPercentChange = ((indexCurrentPrice - position.index_buy_price) / position.index_buy_price) * 100;
    
    const today = new Date();
    const buyDate = new Date(position.buy_date);
    const daysHeld = Math.floor((today.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      currentPrice,
      buyValue,
      currentValue,
      dollarChange,
      percentChange,
      stopLossProfit,
      stopLossPercent,
      daysHeld,
      indexPercentChange
    };
  };

  const totalMetrics = positions.reduce((acc, pos) => {
    const metrics = calculateMetrics(pos);
    return {
      totalDollarChange: acc.totalDollarChange + metrics.dollarChange,
      totalProfit: acc.totalProfit + metrics.stopLossProfit
    };
  }, { totalDollarChange: 0, totalProfit: 0 });

  // Calculate top gainer/loser in last 5 days (active positions only)
  const activePositions = positions.filter(p => p.holding === 1);
  
  // Calculate total invested and remaining cash
  const totalInvested = activePositions.reduce((sum, pos) => {
    return sum + (pos.shares * pos.buy_price);
  }, 0);
  const remainingCash = parseFloat(cashBalance) - totalInvested;
  const topGainer = activePositions.length > 0 
    ? activePositions.reduce((top, pos) => {
        const metrics = calculateMetrics(pos);
        const topMetrics = calculateMetrics(top);
        return metrics.percentChange > topMetrics.percentChange ? pos : top;
      })
    : null;

  const topLoser = activePositions.length > 0
    ? activePositions.reduce((bottom, pos) => {
        const metrics = calculateMetrics(pos);
        const bottomMetrics = calculateMetrics(bottom);
        return metrics.percentChange < bottomMetrics.percentChange ? pos : bottom;
      })
    : null;

  const isNearStopLoss = (position: PortfolioPosition) => {
    if (!position.stop_loss_price) return false;
    const currentPrice = position.current_price || position.buy_price;
    const priceAboveStopLoss = currentPrice - position.stop_loss_price;
    const percentAboveStopLoss = (priceAboveStopLoss / position.stop_loss_price) * 100;
    return percentAboveStopLoss <= 5 && percentAboveStopLoss >= 0; // Within 5% above stop loss
  };

  if (isLoading) {
    return <div className="p-4">Loading portfolio...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Portfolio Tracker
              </CardTitle>
              <CardDescription>
                Track your positions with real-time calculations
              </CardDescription>
              
              {/* Cash Balance Section */}
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Cash Balance</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {isEditingCash ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          value={cashBalance}
                          onChange={(e) => setCashBalance(e.target.value)}
                          className="w-40"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleCashBalanceUpdate}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingCash(false)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-green-600">
                          ${parseFloat(cashBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingCash(true)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="border-t pt-2">
                  <Label className="text-xs text-muted-foreground">Remaining Cash</Label>
                  <div className={`text-xl font-bold mt-1 ${remainingCash < 0 ? 'text-destructive' : 'text-primary'}`}>
                    ${remainingCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Invested: ${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCurrentPrices}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Prices
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setEditingId(null);
                  setFormData({
                    ticker: '',
                    shares: '',
                    buy_price: '',
                    buy_date: '',
                    index_ticker: 'SPY',
                    index_buy_price: '',
                    stop_loss_price: '',
                    holding: '1',
                    comments: ''
                  });
                }}
                className="bg-gradient-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Position
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-card/50 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="ticker">Ticker</Label>
                  <Input
                    id="ticker"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="shares"># of Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.01"
                    value={formData.shares}
                    onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="buy_price">Buy Price</Label>
                  <Input
                    id="buy_price"
                    type="number"
                    step="0.01"
                    value={formData.buy_price}
                    onChange={(e) => setFormData({ ...formData, buy_price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="buy_date">Buy Date</Label>
                  <Input
                    id="buy_date"
                    type="date"
                    value={formData.buy_date}
                    onChange={(e) => setFormData({ ...formData, buy_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="index_ticker">Index Ticker</Label>
                  <Input
                    id="index_ticker"
                    value={formData.index_ticker}
                    onChange={(e) => setFormData({ ...formData, index_ticker: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="index_buy_price">Index Buy Price</Label>
                  <Input
                    id="index_buy_price"
                    type="number"
                    step="0.01"
                    value={formData.index_buy_price}
                    onChange={(e) => setFormData({ ...formData, index_buy_price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="stop_loss_price">Stop Loss Price</Label>
                  <Input
                    id="stop_loss_price"
                    type="number"
                    step="0.01"
                    value={formData.stop_loss_price}
                    onChange={(e) => setFormData({ ...formData, stop_loss_price: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="holding">Holding (1=Yes, 0=Sold)</Label>
                  <Input
                    id="holding"
                    type="number"
                    min="0"
                    max="1"
                    value={formData.holding}
                    onChange={(e) => setFormData({ ...formData, holding: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    rows={1}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-gradient-primary">
                  {editingId ? 'Update Position' : 'Add Position'}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {positions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No positions yet. Add your first position to start tracking.</p>
            </div>
          ) : (
            <>
              {/* Top Gainer/Loser Cards */}
              {(topGainer || topLoser) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Top Gainer */}
                  {topGainer && (() => {
                    const metrics = calculateMetrics(topGainer);
                    const nearStopLoss = isNearStopLoss(topGainer);
                    return (
                      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs text-muted-foreground">🚀 Top Gainer (Last 5 Days)</Label>
                            {nearStopLoss && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Near Stop Loss
                              </Badge>
                            )}
                          </div>
                          <button 
                            onClick={() => handleTickerClick(topGainer.ticker)}
                            className="text-2xl font-bold text-green-600 hover:text-green-500 transition-colors flex items-center gap-1 group"
                          >
                            {topGainer.ticker}
                            <ExternalLink className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Gain:</span>
                              <span className="text-lg font-bold text-green-600">
                                +{metrics.percentChange.toFixed(2)}% (${metrics.dollarChange.toFixed(2)})
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Days Held:</span>
                              <span className="font-semibold">{metrics.daysHeld} days</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Top Loser */}
                  {topLoser && (() => {
                    const metrics = calculateMetrics(topLoser);
                    return (
                      <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                        <CardContent className="pt-6">
                          <Label className="text-xs text-muted-foreground">📉 Top Loser (Last 5 Days)</Label>
                          <button 
                            onClick={() => handleTickerClick(topLoser.ticker)}
                            className="text-2xl font-bold text-red-600 hover:text-red-500 transition-colors flex items-center gap-1 group"
                          >
                            {topLoser.ticker}
                            <ExternalLink className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Loss:</span>
                              <span className="text-lg font-bold text-red-600">
                                {metrics.percentChange.toFixed(2)}% (${metrics.dollarChange.toFixed(2)})
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Days Held:</span>
                              <span className="font-semibold">{metrics.daysHeld} days</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}

              {/* Active Positions */}
              {positions.filter(p => p.holding === 1).length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Active Positions</h3>
                  {positions.filter(p => p.holding === 1).map((position) => {
                const metrics = calculateMetrics(position);
                const dollarChangePercent = totalMetrics.totalDollarChange !== 0 
                  ? (metrics.dollarChange / totalMetrics.totalDollarChange * 100).toFixed(1)
                  : '0.0';
                const profitPercent = totalMetrics.totalProfit !== 0
                  ? (metrics.stopLossProfit / totalMetrics.totalProfit * 100).toFixed(1)
                  : '0.0';

                return (
                  <Card key={position.id} className="bg-card/50">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2 md:col-span-4 flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleTickerClick(position.ticker)}
                                className="text-xl font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
                              >
                                {position.ticker}
                                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                              {!position.stop_loss_price && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Stop Loss Not Set
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{position.shares} shares</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(position)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removePosition(position.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">$ Change</Label>
                          <div className={`text-lg font-semibold ${metrics.dollarChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${metrics.dollarChange.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">% Change</Label>
                          <div className={`text-lg font-semibold ${metrics.percentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {metrics.percentChange.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Stop Loss Profit</Label>
                          <div className={`text-lg font-semibold ${metrics.stopLossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${metrics.stopLossProfit.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Stop Loss %</Label>
                          <div className={`text-lg font-semibold ${metrics.stopLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {metrics.stopLossPercent.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">{position.index_ticker} %</Label>
                          <div className={`text-lg font-semibold ${metrics.indexPercentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {metrics.indexPercentChange.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Days Held</Label>
                          <div className="text-lg font-semibold">{metrics.daysHeld}</div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">$ up/down % of Total</Label>
                          <div className="text-lg font-semibold">{dollarChangePercent}%</div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Profit % of Total</Label>
                          <div className="text-lg font-semibold">{profitPercent}%</div>
                        </div>

                        {position.comments && (
                          <div className="col-span-2 md:col-span-4">
                            <Label className="text-muted-foreground text-xs">Comments</Label>
                            <p className="text-sm mt-1 p-2 bg-muted/50 rounded">{position.comments}</p>
                          </div>
                        )}

                        <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                          <div>
                            <Label className="text-muted-foreground text-xs">Buy Value</Label>
                            <div className="text-sm font-mono">${metrics.buyValue.toFixed(2)}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Current Value</Label>
                            <div className="text-sm font-mono">${metrics.currentValue.toFixed(2)}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Buy Price</Label>
                            <div className="text-sm font-mono">${position.buy_price.toFixed(2)}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Current Price</Label>
                            <div className="text-sm font-mono">${metrics.currentPrice.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
                </div>
              )}

              {/* Sold Positions */}
              {positions.filter(p => p.holding === 0).length > 0 && (
                <div className="space-y-4 mt-8">
                  <h3 className="text-lg font-semibold">Sold Positions</h3>
                  {positions.filter(p => p.holding === 0).map((position) => {
                const metrics = calculateMetrics(position);
                const dollarChangePercent = totalMetrics.totalDollarChange !== 0 
                  ? (metrics.dollarChange / totalMetrics.totalDollarChange * 100).toFixed(1)
                  : '0.0';
                const profitPercent = totalMetrics.totalProfit !== 0
                  ? (metrics.stopLossProfit / totalMetrics.totalProfit * 100).toFixed(1)
                  : '0.0';

                return (
                  <Card key={position.id} className="bg-card/50 opacity-75">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2 md:col-span-4 flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleTickerClick(position.ticker)}
                                className="text-xl font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 group"
                              >
                                {position.ticker}
                                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                              <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                                SOLD
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{position.shares} shares (SOLD)</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(position)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removePosition(position.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">$ Change</Label>
                          <div className={`text-lg font-semibold ${metrics.dollarChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${metrics.dollarChange.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">% Change</Label>
                          <div className={`text-lg font-semibold ${metrics.percentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {metrics.percentChange.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Stop Loss Profit</Label>
                          <div className={`text-lg font-semibold ${metrics.stopLossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            ${metrics.stopLossProfit.toFixed(2)}
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Stop Loss %</Label>
                          <div className={`text-lg font-semibold ${metrics.stopLossPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {metrics.stopLossPercent.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">{position.index_ticker} %</Label>
                          <div className={`text-lg font-semibold ${metrics.indexPercentChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {metrics.indexPercentChange.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Days Held</Label>
                          <div className="text-lg font-semibold">{metrics.daysHeld}</div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">$ up/down % of Total</Label>
                          <div className="text-lg font-semibold">{dollarChangePercent}%</div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground text-xs">Profit % of Total</Label>
                          <div className="text-lg font-semibold">{profitPercent}%</div>
                        </div>

                        {position.comments && (
                          <div className="col-span-2 md:col-span-4">
                            <Label className="text-muted-foreground text-xs">Comments</Label>
                            <p className="text-sm mt-1 p-2 bg-muted/50 rounded">{position.comments}</p>
                          </div>
                        )}

                        <div className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                          <div>
                            <Label className="text-muted-foreground text-xs">Buy Value</Label>
                            <div className="text-sm font-mono">${metrics.buyValue.toFixed(2)}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Current Value</Label>
                            <div className="text-sm font-mono">${metrics.currentValue.toFixed(2)}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Buy Price</Label>
                            <div className="text-sm font-mono">${position.buy_price.toFixed(2)}</div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Current Price</Label>
                            <div className="text-sm font-mono">${metrics.currentPrice.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
