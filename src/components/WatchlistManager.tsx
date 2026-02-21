import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp, Clock, ExternalLink, BarChart3, Pencil } from 'lucide-react';
import { Stock } from '@/hooks/useWatchlist';
import { useWeeklyMatrix } from '@/hooks/useWeeklyMatrix';
import { WeeklyChartModal } from './WeeklyChartModal';
import { MatrixRow } from '@/hooks/useWeeklyMatrix';

interface WatchlistManagerProps {
  watchlist: Stock[];
  onAdd: (ticker: string, assetType: 'Stock' | 'Option', companyUrl?: string, nextEarningDate?: string) => void;
  onRemove: (ticker: string, assetType: 'Stock' | 'Option') => void;
  onUpdateEarningDate: (ticker: string, assetType: 'Stock' | 'Option', newDate: string | null) => void;
}

export const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  watchlist,
  onAdd,
  onRemove,
  onUpdateEarningDate,
}) => {
  const [newTicker, setNewTicker] = useState('');
  const [newAssetType, setNewAssetType] = useState<'Stock' | 'Option'>('Stock');
  const [newCompanyUrl, setNewCompanyUrl] = useState('');
  const [newEarningDate, setNewEarningDate] = useState('');
  const [chartOpen, setChartOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<MatrixRow | null>(null);
  const { fetchMatrix, matrixData } = useWeeklyMatrix();

  const handleOpenChart = async (ticker: string) => {
    await fetchMatrix([ticker]);
  };

  // When matrixData updates after fetch, open the modal
  React.useEffect(() => {
    if (matrixData.length > 0 && !chartOpen) {
      const row = matrixData[0];
      if (row) {
        setSelectedRow(row);
        setChartOpen(true);
      }
    }
  }, [matrixData]);

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
              <div>
                <Label htmlFor="earning-date">Next Earning Date (Optional)</Label>
                <Input
                  id="earning-date"
                  type="date"
                  value={newEarningDate}
                  onChange={(e) => setNewEarningDate(e.target.value)}
                  className="mt-1"
                />
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
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Your Watchlist ({watchlist.length})
          </CardTitle>
          <CardDescription>
            Manage your current stock and options watchlist
          </CardDescription>
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
                          className="h-6 w-6 p-0 text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenChart(stock.ticker);
                          }}
                          title={`Open chart for ${stock.ticker}`}
                        >
                          <BarChart3 className="h-4 w-4" />
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
                        <span className="ml-2 inline-flex items-center gap-1">
                          <input
                            type="date"
                            value={stock.nextEarningDate || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              onUpdateEarningDate(stock.ticker, stock.assetType, e.target.value || null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 text-xs bg-transparent border border-border rounded px-1 w-32"
                            title="Edit next earning date"
                          />
                        </span>
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

      {/* Chart Modal */}
      {selectedRow && (
        <WeeklyChartModal
          open={chartOpen}
          onOpenChange={setChartOpen}
          row={selectedRow}
        />
      )}
    </div>
  );
};