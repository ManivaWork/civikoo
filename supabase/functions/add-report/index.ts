import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  getSupabaseAdmin,
  getSupabaseUser,
  getUserIdFromAuth,
  validateProximity,
  checkRateLimit,
  getRateLimitKey
} from '../_shared/supabase.ts';

interface AddReportRequest {
  latitude: number;
  longitude: number;
  category: string;
  title: string;
  description?: string;
  photo_url: string;
  photo_thumbnail_url?: string;
  user_location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

const VALID_CATEGORIES = [
  'buraco_asfalto',
  'vazamento_agua',
  'sinalizacao',
  'acessibilidade',
];

const POINTS_PER_REPORT = 10;

// Rate limits: 10 reports per hour per user
const REPORT_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const userId = getUserIdFromAuth(authHeader);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const rateLimitKey = getRateLimitKey(userId, 'add_report');
    const rateLimit = checkRateLimit(rateLimitKey, REPORT_RATE_LIMIT.max, REPORT_RATE_LIMIT.windowMs);

    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: AddReportRequest = await req.json();

    // Validate required fields
    const { latitude, longitude, category, title, photo_url } = body;

    if (!latitude || !longitude || !category || !title || !photo_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: latitude, longitude, category, title, photo_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
      return new Response(
        JSON.stringify({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate title length
    if (title.trim().length < 5 || title.trim().length > 200) {
      return new Response(
        JSON.stringify({ error: 'Title must be between 5 and 200 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate description length
    if (body.description && body.description.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Description too long (max 2000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anti-fraud: If user_location provided, verify proximity to reported location
    if (body.user_location) {
      const { valid, distance } = validateProximity(
        body.user_location.latitude,
        body.user_location.longitude,
        latitude,
        longitude,
        100 // Allow 100m tolerance for reporting (wider than verification)
      );

      if (!valid) {
        return new Response(
          JSON.stringify({
            error: 'Location mismatch',
            message: `Reported location is ${distance}m away from your GPS position. Maximum allowed: 100m.`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Initialize Supabase admin client (service role - bypasses RLS)
    const supabaseAdmin = getSupabaseAdmin();

    // Insert the report using new schema: user_id = auth.uid()
    // The database trigger will sync location from lat/lng
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: userId,  // NEW: user_id instead of creator_id
        latitude,
        longitude,
        category,
        title: title.trim(),
        description: body.description?.trim() || null,
        photo_url,
        photo_thumbnail_url: body.photo_thumbnail_url || photo_url,
        status: 'ativo',
      })
      .select()
      .single();

    if (reportError) {
      console.error('Report insert error:', reportError);
      return new Response(
        JSON.stringify({ error: 'Failed to create report' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Award XP/coins via server-side function (SECURITY DEFINER)
    const { error: rewardError } = await supabaseAdmin.rpc('award_reward', {
      p_user_id: userId,
      p_source: 'report_created',
      p_xp: 50,
      p_coins: 10,
      p_ref_type: 'report',
      p_ref_id: report.id,
    });

    if (rewardError) {
      console.error('Reward error:', rewardError);
      // Don't fail the request - report was created successfully
    }

    // Get updated user profile for response
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('xp, coins, level, total_score')
      .eq('id', userId)
      .single();

    // Return success with new report data
    return new Response(
      JSON.stringify({
        success: true,
        report: {
          id: report.id,
          latitude: report.latitude,
          longitude: report.longitude,
          category: report.category,
          title: report.title,
          status: report.status,
          created_at: report.created_at,
        },
        user: {
          xp: userProfile?.xp || 0,
          coins: userProfile?.coins || 0,
          level: userProfile?.level || 1,
          total_score: userProfile?.total_score || 0,
        },
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Add report error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});