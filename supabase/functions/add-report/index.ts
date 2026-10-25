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
  'iluminacao',
  'lixo_entulho',
  'vazamento_agua',
  'sinalizacao',
  'acessibilidade',
  'vegetacao',
  'mobiliario_urbano',
  'outro',
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

    // Initialize Supabase clients
    const supabaseAdmin = getSupabaseAdmin();
    const supabaseUser = getSupabaseUser(authHeader!.replace('Bearer ', ''));

    // Get user profile to check if exists and get current score
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, total_score, level')
      .eq('auth_user_id', userId)
      .single();

    if (userError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the report
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .insert({
        creator_id: userProfile.id,
        latitude,
        longitude,
        category,
        title: title.trim(),
        description: body.description?.trim() || null,
        photo_url,
        photo_thumbnail_url: body.photo_thumbnail_url || photo_url,
        status: 'ativo',
        score_awarded: POINTS_PER_REPORT,
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

    // Update user score and level atomically using RPC
    const { error: scoreError } = await supabaseAdmin.rpc('increment_user_score', {
      p_user_id: userProfile.id,
      p_points: POINTS_PER_REPORT,
      p_activity_type: 'report_created',
      p_reference_id: report.id,
    });

    if (scoreError) {
      console.error('Score update error:', scoreError);
      // Don't fail the request - report was created successfully
      // Log for monitoring
    }

    // Log activity for audit trail
    await supabaseAdmin
      .from('user_activity_log')
      .insert({
        user_id: userProfile.id,
        activity_type: 'report_created',
        reference_id: report.id,
        points_earned: POINTS_PER_REPORT,
      });

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
          score_awarded: POINTS_PER_REPORT,
        },
        user: {
          new_total_score: userProfile.total_score + POINTS_PER_REPORT,
          new_level: userProfile.level, // Will be updated by RPC
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