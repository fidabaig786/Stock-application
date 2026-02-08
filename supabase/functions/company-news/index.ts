import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    const apiKey = Deno.env.get('POLYGON_API_KEY');

    if (!apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    if (!ticker) {
      throw new Error('ticker is required');
    }

    const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker.toUpperCase()}&limit=10&order=desc&sort=published_utc&apiKey=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Polygon news API error: ${res.status}`);
    }

    const data = await res.json();

    const articles = (data.results || []).map((article: any) => ({
      title: article.title,
      source: article.publisher?.name || 'Unknown',
      publishedAt: article.published_utc,
      url: article.article_url,
      description: article.description || '',
      imageUrl: article.image_url || null,
    }));

    return new Response(
      JSON.stringify({ articles }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in company-news:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
