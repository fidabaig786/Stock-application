import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationCriteria {
  stock?: string[];
  option?: string[];
}

export const EmailNotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [optionCriteria, setOptionCriteria] = useState({
    mrt: true,
    rsiConfirmation: false,
    dmiConfirmation: false,
    emaCrossover: false,
    macdCrossover: true,
    weeklyMacd: true,
    burst: true,
  });

  const [stockCriteria, setStockCriteria] = useState({
    rsiConfirmation: false,
    dmiConfirmation: false,
    emaCrossover: true,
    macdCrossover: false,
    weeklyMacd: false,
    burst: true,
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('email, email_notifications_enabled, notification_criteria')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmail(data.email || '');
        setEnabled(data.email_notifications_enabled || false);
        
        const criteria = data.notification_criteria as NotificationCriteria || {};
        if (criteria.option) {
          setOptionCriteria({
            mrt: criteria.option.includes('mrt'),
            rsiConfirmation: criteria.option.includes('rsiConfirmation'),
            dmiConfirmation: criteria.option.includes('dmiConfirmation'),
            emaCrossover: criteria.option.includes('emaCrossover'),
            macdCrossover: criteria.option.includes('macdCrossover'),
            weeklyMacd: criteria.option.includes('weeklyMacd'),
            burst: criteria.option.includes('burst'),
          });
        }
        if (criteria.stock) {
          setStockCriteria({
            rsiConfirmation: criteria.stock.includes('rsiConfirmation'),
            dmiConfirmation: criteria.stock.includes('dmiConfirmation'),
            emaCrossover: criteria.stock.includes('emaCrossover'),
            macdCrossover: criteria.stock.includes('macdCrossover'),
            weeklyMacd: criteria.stock.includes('weeklyMacd'),
            burst: criteria.stock.includes('burst'),
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    if (enabled && !email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Build notification criteria
      const criteria: NotificationCriteria = {
        option: [],
        stock: []
      };

      if (optionCriteria.mrt) criteria.option!.push('mrt');
      if (optionCriteria.rsiConfirmation) criteria.option!.push('rsiConfirmation');
      if (optionCriteria.dmiConfirmation) criteria.option!.push('dmiConfirmation');
      if (optionCriteria.emaCrossover) criteria.option!.push('emaCrossover');
      if (optionCriteria.macdCrossover) criteria.option!.push('macdCrossover');
      if (optionCriteria.weeklyMacd) criteria.option!.push('weeklyMacd');
      if (optionCriteria.burst) criteria.option!.push('burst');

      if (stockCriteria.rsiConfirmation) criteria.stock!.push('rsiConfirmation');
      if (stockCriteria.dmiConfirmation) criteria.stock!.push('dmiConfirmation');
      if (stockCriteria.emaCrossover) criteria.stock!.push('emaCrossover');
      if (stockCriteria.macdCrossover) criteria.stock!.push('macdCrossover');
      if (stockCriteria.weeklyMacd) criteria.stock!.push('weeklyMacd');
      if (stockCriteria.burst) criteria.stock!.push('burst');

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          email,
          email_notifications_enabled: enabled,
          notification_criteria: criteria as any,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your email notification preferences have been updated",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Get notified when stocks meet your specific criteria
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive emails when criteria are met
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        {enabled && (
          <div className="space-y-6">
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div>
                <h4 className="font-medium mb-3">Notify me when Options meet:</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mrt-notify"
                    checked={optionCriteria.mrt}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, mrt: checked as boolean }))
                    }
                  />
                  <Label htmlFor="mrt-notify" className="text-sm font-normal">
                    MRT
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rsi-notify"
                    checked={optionCriteria.rsiConfirmation}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, rsiConfirmation: checked as boolean }))
                    }
                  />
                  <Label htmlFor="rsi-notify" className="text-sm font-normal">
                    RSI Confirmation
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dmi-notify"
                    checked={optionCriteria.dmiConfirmation}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, dmiConfirmation: checked as boolean }))
                    }
                  />
                  <Label htmlFor="dmi-notify" className="text-sm font-normal">
                    DMI Confirmation
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ema-notify"
                    checked={optionCriteria.emaCrossover}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, emaCrossover: checked as boolean }))
                    }
                  />
                  <Label htmlFor="ema-notify" className="text-sm font-normal">
                    EMA Crossover
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="macd-notify"
                    checked={optionCriteria.macdCrossover}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, macdCrossover: checked as boolean }))
                    }
                  />
                  <Label htmlFor="macd-notify" className="text-sm font-normal">
                    MACD Crossover
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="weekly-macd-notify"
                    checked={optionCriteria.weeklyMacd}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, weeklyMacd: checked as boolean }))
                    }
                  />
                  <Label htmlFor="weekly-macd-notify" className="text-sm font-normal">
                    Weekly MACD
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="burst-notify"
                    checked={optionCriteria.burst}
                    onCheckedChange={(checked) =>
                      setOptionCriteria(prev => ({ ...prev, burst: checked as boolean }))
                    }
                  />
                  <Label htmlFor="burst-notify" className="text-sm font-normal">
                    Burst
                  </Label>
                </div>
              </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You'll receive an email when ALL selected criteria are met
                </p>
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div>
                <h4 className="font-medium mb-3">Notify me when Stocks meet:</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock-rsi-notify"
                      checked={stockCriteria.rsiConfirmation}
                      onCheckedChange={(checked) =>
                        setStockCriteria(prev => ({ ...prev, rsiConfirmation: checked as boolean }))
                      }
                    />
                    <Label htmlFor="stock-rsi-notify" className="text-sm font-normal">
                      RSI Confirmation
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock-dmi-notify"
                      checked={stockCriteria.dmiConfirmation}
                      onCheckedChange={(checked) =>
                        setStockCriteria(prev => ({ ...prev, dmiConfirmation: checked as boolean }))
                      }
                    />
                    <Label htmlFor="stock-dmi-notify" className="text-sm font-normal">
                      DMI Confirmation
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock-ema-notify"
                      checked={stockCriteria.emaCrossover}
                      onCheckedChange={(checked) =>
                        setStockCriteria(prev => ({ ...prev, emaCrossover: checked as boolean }))
                      }
                    />
                    <Label htmlFor="stock-ema-notify" className="text-sm font-normal">
                      EMA Crossover
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock-macd-notify"
                      checked={stockCriteria.macdCrossover}
                      onCheckedChange={(checked) =>
                        setStockCriteria(prev => ({ ...prev, macdCrossover: checked as boolean }))
                      }
                    />
                    <Label htmlFor="stock-macd-notify" className="text-sm font-normal">
                      MACD Crossover
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock-weekly-macd-notify"
                      checked={stockCriteria.weeklyMacd}
                      onCheckedChange={(checked) =>
                        setStockCriteria(prev => ({ ...prev, weeklyMacd: checked as boolean }))
                      }
                    />
                    <Label htmlFor="stock-weekly-macd-notify" className="text-sm font-normal">
                      Weekly MACD
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stock-burst-notify"
                      checked={stockCriteria.burst}
                      onCheckedChange={(checked) =>
                        setStockCriteria(prev => ({ ...prev, burst: checked as boolean }))
                      }
                    />
                    <Label htmlFor="stock-burst-notify" className="text-sm font-normal">
                      Burst
                    </Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You'll receive an email when ALL selected criteria are met
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <div className="flex items-start gap-2">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium mb-2">Automated Continuous Analysis</h4>
              <p className="text-sm text-muted-foreground">
                Analysis runs automatically every 20 minutes throughout the day. When stocks in your watchlist meet your selected criteria, you'll receive an email notification. You'll only get one email per status change (when criteria goes from not met to met).
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={saveSettings}
          disabled={saving}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
