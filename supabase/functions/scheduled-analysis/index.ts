import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scheduled analysis...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users who have email notifications enabled
    const { data: usersWithNotifications, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, email, email_notifications_enabled, notification_criteria')
      .eq('email_notifications_enabled', true);

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
      throw settingsError;
    }

    if (!usersWithNotifications || usersWithNotifications.length === 0) {
      console.log('No users with email notifications enabled');
      return new Response(
        JSON.stringify({ message: 'No users to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${usersWithNotifications.length} users with notifications enabled`);

    // Process each user
    for (const userSettings of usersWithNotifications) {
      try {
        console.log(`Processing user ${userSettings.user_id}`);

        // Get user's watchlist
        const { data: watchlist, error: watchlistError } = await supabase
          .from('watchlist_items')
          .select('ticker, asset_type')
          .eq('user_id', userSettings.user_id);

        if (watchlistError || !watchlist || watchlist.length === 0) {
          console.log(`No watchlist for user ${userSettings.user_id}`);
          continue;
        }

        console.log(`User has ${watchlist.length} items in watchlist`);

        // Get notification criteria for each asset type
        const notifCriteria = userSettings.notification_criteria || {};
        
        // Process options if user has option criteria
        if (notifCriteria.option && Array.isArray(notifCriteria.option) && notifCriteria.option.length > 0) {
          const optionWatchlist = watchlist.filter(item => item.asset_type === 'Option');
          
          if (optionWatchlist.length > 0) {
            console.log(`Running analysis for ${optionWatchlist.length} options`);
            
            // Build criteria object
            const criteria = {
              mrt: notifCriteria.option.includes('mrt'),
              rsiConfirmation: notifCriteria.option.includes('rsiConfirmation'),
              dmiConfirmation: notifCriteria.option.includes('dmiConfirmation'),
              emaCrossover: notifCriteria.option.includes('emaCrossover'),
              macdCrossover: notifCriteria.option.includes('macdCrossover'),
              weeklyMacd: notifCriteria.option.includes('weeklyMacd'),
              burst: notifCriteria.option.includes('burst'),
            };

            // Call stock-analysis function
            const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
              'stock-analysis',
              {
                body: {
                  watchlist: optionWatchlist.map(item => ({
                    ticker: item.ticker,
                    assetType: item.asset_type,
                  })),
                  criteria,
                },
              }
            );

            if (analysisError) {
              console.error(`Analysis error for user ${userSettings.user_id}:`, analysisError);
              continue;
            }

            // Process all results and check notification status
            const allResults = analysisData?.results || [];
            
            for (const stock of allResults) {
              const passed = stock.passed;
              
              // Check previous notification status
              const { data: prevStatus } = await supabase
                .from('notification_status')
                .select('*')
                .eq('user_id', userSettings.user_id)
                .eq('ticker', stock.ticker)
                .eq('asset_type', 'Option')
                .maybeSingle();

              // Send email only if status changed from false to true
              if (passed && (!prevStatus || !prevStatus.criteria_met)) {
                console.log(`Sending email for ${stock.ticker} to ${userSettings.email} (status changed)`);
                
                await supabase.functions.invoke('send-alert-email', {
                  body: {
                    email: userSettings.email,
                    ticker: stock.ticker,
                    assetType: stock.assetType,
                    metCriteria: notifCriteria.option,
                    price: parseFloat(stock.currentPrice.replace('$', '')),
                  },
                });

                // Update status with email sent timestamp
                await supabase
                  .from('notification_status')
                  .upsert({
                    user_id: userSettings.user_id,
                    ticker: stock.ticker,
                    asset_type: 'Option',
                    criteria_met: true,
                    last_email_sent_at: new Date().toISOString(),
                    last_checked_at: new Date().toISOString(),
                  }, {
                    onConflict: 'user_id,ticker,asset_type'
                  });
              } else {
                // Update status without sending email
                await supabase
                  .from('notification_status')
                  .upsert({
                    user_id: userSettings.user_id,
                    ticker: stock.ticker,
                    asset_type: 'Option',
                    criteria_met: passed,
                    last_checked_at: new Date().toISOString(),
                    ...(prevStatus?.last_email_sent_at && { last_email_sent_at: prevStatus.last_email_sent_at }),
                  }, {
                    onConflict: 'user_id,ticker,asset_type'
                  });
              }
            }
          }
        }

        // Process stocks if user has stock criteria
        if (notifCriteria.stock && Array.isArray(notifCriteria.stock) && notifCriteria.stock.length > 0) {
          const stockWatchlist = watchlist.filter(item => item.asset_type === 'Stock');
          
          if (stockWatchlist.length > 0) {
            console.log(`Running analysis for ${stockWatchlist.length} stocks`);
            
            const criteria = {
              mrt: false, // Not applicable for stocks
              rsiConfirmation: notifCriteria.stock.includes('rsiConfirmation'),
              dmiConfirmation: notifCriteria.stock.includes('dmiConfirmation'),
              emaCrossover: notifCriteria.stock.includes('emaCrossover'),
              macdCrossover: notifCriteria.stock.includes('macdCrossover'),
              weeklyMacd: notifCriteria.stock.includes('weeklyMacd'),
              burst: notifCriteria.stock.includes('burst'),
            };

            const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
              'stock-analysis',
              {
                body: {
                  watchlist: stockWatchlist.map(item => ({
                    ticker: item.ticker,
                    assetType: item.asset_type,
                  })),
                  criteria,
                },
              }
            );

            if (analysisError) {
              console.error(`Analysis error for user ${userSettings.user_id}:`, analysisError);
              continue;
            }

            // Process all results and check notification status
            const allResults = analysisData?.results || [];
            
            for (const stock of allResults) {
              const passed = stock.passed;
              
              // Check previous notification status
              const { data: prevStatus } = await supabase
                .from('notification_status')
                .select('*')
                .eq('user_id', userSettings.user_id)
                .eq('ticker', stock.ticker)
                .eq('asset_type', 'Stock')
                .maybeSingle();

              // Send email only if status changed from false to true
              if (passed && (!prevStatus || !prevStatus.criteria_met)) {
                console.log(`Sending email for ${stock.ticker} to ${userSettings.email} (status changed)`);
                
                await supabase.functions.invoke('send-alert-email', {
                  body: {
                    email: userSettings.email,
                    ticker: stock.ticker,
                    assetType: stock.assetType,
                    metCriteria: notifCriteria.stock,
                    price: parseFloat(stock.currentPrice.replace('$', '')),
                  },
                });

                // Update status with email sent timestamp
                await supabase
                  .from('notification_status')
                  .upsert({
                    user_id: userSettings.user_id,
                    ticker: stock.ticker,
                    asset_type: 'Stock',
                    criteria_met: true,
                    last_email_sent_at: new Date().toISOString(),
                    last_checked_at: new Date().toISOString(),
                  }, {
                    onConflict: 'user_id,ticker,asset_type'
                  });
              } else {
                // Update status without sending email
                await supabase
                  .from('notification_status')
                  .upsert({
                    user_id: userSettings.user_id,
                    ticker: stock.ticker,
                    asset_type: 'Stock',
                    criteria_met: passed,
                    last_checked_at: new Date().toISOString(),
                    ...(prevStatus?.last_email_sent_at && { last_email_sent_at: prevStatus.last_email_sent_at }),
                  }, {
                    onConflict: 'user_id,ticker,asset_type'
                  });
              }
            }
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${userSettings.user_id}:`, userError);
        // Continue with next user
      }
    }

    console.log('Scheduled analysis completed');

    return new Response(
      JSON.stringify({ 
        message: 'Scheduled analysis completed',
        usersProcessed: usersWithNotifications.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduled analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
