import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Clock, Zap } from 'lucide-react';
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
  
  const [zapierWebhook, setZapierWebhook] = useState('');
  const [testingWebhook, setTestingWebhook] = useState(false);

  const scheduledAnalysisUrl = `https://ewvdjypgzfpoldttblhs.supabase.co/functions/v1/scheduled-analysis`;

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

      // Load Zapier webhook from localStorage
      const savedWebhook = localStorage.getItem('zapier_webhook_url');
      if (savedWebhook) {
        setZapierWebhook(savedWebhook);
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
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Save Zapier webhook to localStorage
      if (zapierWebhook) {
        localStorage.setItem('zapier_webhook_url', zapierWebhook);
      }

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

  const testWebhook = async () => {
    if (!zapierWebhook) {
      toast({
        title: "Webhook URL Required",
        description: "Please enter your Zapier webhook URL",
        variant: "destructive",
      });
      return;
    }

    setTestingWebhook(true);
    try {
      await fetch(zapierWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: "Test trigger from Ticker Triumph",
        }),
      });

      toast({
        title: "Test Sent",
        description: "Check your Zap history to confirm it was triggered",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Failed to trigger webhook. Check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
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
              <h4 className="font-medium mb-2">Automated Scheduling</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Set up automatic analysis runs using Zapier's Schedule trigger
              </p>
              
              <Alert className="mb-3">
                <Zap className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Setup Instructions:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Create a new Zap in Zapier</li>
                    <li>Add "Schedule by Zapier" as trigger (e.g., every day at 9 AM)</li>
                    <li>Add "Webhooks by Zapier" as action</li>
                    <li>Choose "POST" method</li>
                    <li>Use this URL: <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">{scheduledAnalysisUrl}</code></li>
                    <li>Copy your Zap's webhook URL below to test</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="zapier-webhook" className="text-sm">
                  Zapier Webhook URL (optional, for testing)
                </Label>
                <Input
                  id="zapier-webhook"
                  type="url"
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={zapierWebhook}
                  onChange={(e) => setZapierWebhook(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={testWebhook}
                  disabled={testingWebhook || !zapierWebhook}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {testingWebhook ? 'Testing...' : 'Test Webhook'}
                </Button>
              </div>
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
