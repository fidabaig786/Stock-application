import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TradingDashboard } from '@/components/TradingDashboard';

const Index = () => {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = '/auth';
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return <TradingDashboard />;
};

export default Index;
