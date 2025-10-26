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
    mrt: false,
    macdCrossover: false,
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
            macdCrossover: criteria.option.includes('macdCrossover'),
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
        option: []
      };

      if (optionCriteria.mrt) criteria.option!.push('mrt');
      if (optionCriteria.macdCrossover) criteria.option!.push('macdCrossover');

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
                    MRT condition
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
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                You'll receive an email when BOTH selected criteria are met
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <div className="flex items-start gap-2">
            <Clock className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium mb-2">Automated Daily Analysis</h4>
              <p className="text-sm text-muted-foreground">
                Analysis runs automatically every day at 9:00 AM EST. When stocks in your watchlist meet your selected criteria, you'll receive an email notification.
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
