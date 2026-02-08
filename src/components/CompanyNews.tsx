import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper, Loader2 } from 'lucide-react';
import { NewsArticle } from '@/hooks/useWeeklyMatrix';

interface CompanyNewsProps {
  ticker: string;
  articles: NewsArticle[];
  isLoading: boolean;
}

export const CompanyNews: React.FC<CompanyNewsProps> = ({ ticker, articles, isLoading }) => {
  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          {ticker} — Latest News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading news...</span>
          </div>
        ) : articles.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No recent news found for {ticker}</p>
        ) : (
          <div className="space-y-3">
            {articles.map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {article.source}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(article.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
