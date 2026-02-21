import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface WeeklyChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticker: string;
  currentPrice?: number;
}

export const WeeklyChartModal: React.FC<WeeklyChartModalProps> = ({ open, onOpenChange, ticker, currentPrice }) => {
  // TradingView advanced chart widget URL
  const tradingViewUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(ticker)}&interval=W&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=0&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=localhost&utm_medium=widget_new&utm_campaign=chart`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">{ticker}</span>
            {currentPrice != null && (
              <Badge variant="outline" className="font-mono">
                ${currentPrice.toFixed(2)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="w-full h-[70vh]">
          <iframe
            src={tradingViewUrl}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
