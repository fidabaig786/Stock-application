import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp, Clock, ExternalLink, Link, RefreshCw, Loader2 } from 'lucide-react';
import { Stock } from '@/hooks/useWatchlist';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WatchlistManagerProps {
  watchlist: Stock[];
  onAdd: (ticker: string, assetType: 'Stock' | 'Option', companyUrl?: string, nextEarningDate?: string) => void;
  onRemove: (ticker: string, assetType: 'Stock' | 'Option') => void;
  onUpdateEarningDate: (ticker: string, assetType: 'Stock' | 'Option', newDate: string | null) => void;
  onUpdateCompanyUrl: (ticker: string, assetType: 'Stock' | 'Option', newUrl: string | null) => void;
  onRefreshEarnings: (tickers: string[]) => void;
  isFetchingEarnings: boolean;
}

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  watchlist,
  onAdd,
  onRemove,
  onUpdateEarningDate,
  onUpdateCompanyUrl,
  onRefreshEarnings,
  isFetchingEarnings,
}) => {
  const [newTicker, setNewTicker] = useState('');
  const [newAssetType, setNewAssetType] = useState<'Stock' | 'Option'>('Stock');
  const [newCompanyUrl, setNewCompanyUrl] = useState('');
  
  const [chartOpen, setChartOpen] = useState(false);
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [editUrlTicker, setEditUrlTicker] = useState<string | null>(null);
  const [editUrlAssetType, setEditUrlAssetType] = useState<'Stock' | 'Option'>('Stock');
  const [editUrlValue, setEditUrlValue] = useState('');

  const handleOpenChart = (ticker: string) => {
    setChartTicker(ticker);
    setChartOpen(true);
  };

  const handleAdd = () => {
    if (newTicker.trim()) {
      onAdd(newTicker.trim(), newAssetType, newCompanyUrl.trim() || undefined, newEarningDate.trim() || undefined);
      setNewTicker('');
      setNewCompanyUrl('');
      setNewEarningDate('');
    }
  };

  return (
    <div className="grid gap-6">
      {/* Add New Stock */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add to Watchlist
          </CardTitle>
          <CardDescription>
            Add stocks or options to your analysis watchlist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ticker">Ticker Symbol</Label>
                <Input
                  id="ticker"
                  placeholder="e.g., AAPL, TSLA, NVDA"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="asset-type">Asset Type</Label>
                <Select value={newAssetType} onValueChange={(value: 'Stock' | 'Option') => setNewAssetType(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Stock">Stock</SelectItem>
                    <SelectItem value="Option">Option</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="company-url">Company Website (Optional)</Label>
                <Input
                  id="company-url"
                  type="url"
                  placeholder="e.g., https://www.apple.com"
                  value={newCompanyUrl}
                  onChange={(e) => setNewCompanyUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                  className="mt-1"
                />
              </div>
              <div className="hidden">
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleAdd}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Watchlist */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Your Watchlist ({watchlist.length})
              </CardTitle>
              <CardDescription>
                Manage your current stock and options watchlist. Earnings dates are auto-fetched.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetchingEarnings || watchlist.length === 0}
              onClick={() => onRefreshEarnings(watchlist.map(s => s.ticker))}
            >
              {isFetchingEarnings ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh Earnings
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {watchlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Your watchlist is empty</p>
              <p className="text-sm">Add some tickers to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {watchlist.map((stock) => (
                <div 
                  key={`${stock.ticker}-${stock.assetType}`}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {stock.companyUrl ? (
                          <a 
                            href={stock.companyUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-semibold text-lg text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {stock.ticker}
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <h3 className="font-semibold text-lg">{stock.ticker}</h3>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title="Edit company URL"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditUrlTicker(stock.ticker);
                            setEditUrlAssetType(stock.assetType);
                            setEditUrlValue(stock.companyUrl || '');
                          }}
                        >
                          <Link className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Added {new Date(stock.addedAt).toLocaleDateString()}
                        {stock.nextEarningDate && (
                          <span className="ml-2 text-warning">
                            📅 Earnings: {new Date(stock.nextEarningDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={stock.assetType === 'Stock' ? 'default' : 'secondary'}>
                      {stock.assetType}
                    </Badge>
                    {stock.currentPrice && (
                      <Badge variant="outline" className="font-mono">
                        ${stock.currentPrice.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(stock.ticker, stock.assetType)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit URL Dialog */}
      <Dialog open={!!editUrlTicker} onOpenChange={(open) => { if (!open) setEditUrlTicker(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company URL for {editUrlTicker}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="edit-url">Company Website URL</Label>
              <Input
                id="edit-url"
                type="url"
                placeholder="https://www.example.com"
                value={editUrlValue}
                onChange={(e) => setEditUrlValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateCompanyUrl(editUrlTicker!, editUrlAssetType, editUrlValue.trim() || null);
                    setEditUrlTicker(null);
                  }
                }}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditUrlTicker(null)}>Cancel</Button>
              <Button onClick={() => {
                onUpdateCompanyUrl(editUrlTicker!, editUrlAssetType, editUrlValue.trim() || null);
                setEditUrlTicker(null);
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
