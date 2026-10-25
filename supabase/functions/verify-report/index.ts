import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import {
  getSupabaseAdmin,
  getUserIdFromAuth,
  checkRateLimit,
  getRateLimitKey
} from '../_shared/supabase.ts';

interface VerifyReportRequest {
  report_id: string;
  type: 'continua' | 'resolvido';  // NEW: matches report_confirmations.type
  user_location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

// Rate limits: 30 confirmations per hour per user
const VERIFY_RATE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

// Maximum distance for verification (50 meters)
const MAX_VERIFICATION_DISTANCE = 50;

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
    const rateLimitKey = getRateLimitKey(userId, 'verify_report');
    const rateLimit = checkRateLimit(rateLimitKey, VERIFY_RATE_LIMIT.max, VERIFY_RATE_LIMIT.windowMs);

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
    const body: VerifyReportRequest = await req.json();

    // Validate required fields
    const { report_id, type, user_location } = body;

    if (!report_id || !type || !user_location) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: report_id, type, user_location' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate type (NEW: 'continua' or 'resolvido')
    if (!['continua', 'resolvido'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be "continua" or "resolvido"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user location
    const { latitude: userLat, longitude: userLng, accuracy } = user_location;
    if (!userLat || !userLng || userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid user location coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();

    // Call the confirm_report RPC (SECURITY DEFINER - does proximity check server-side)
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('confirm_report', {
      p_report_id: report_id,
      p_user_id: userId,
      p_type: type,
      p_latitude: userLat,
      p_longitude: userLng,
      p_accuracy: accuracy || null,
    });

    if (rpcError) {
      console.error('Confirm report RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to confirm report' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RPC returns table with: success, message, distance_m, accuracy_m
    const confirmationResult = result?.[0];

    if (!confirmationResult?.success) {
      return new Response(
        JSON.stringify({
          error: confirmationResult?.message || 'Confirmation failed',
          distance: confirmationResult?.distance_m,
          accuracy: confirmationResult?.accuracy_m,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get updated report status and counts
    const { data: updatedReport } = await supabaseAdmin
      .from('reports')
      .select('status, confirmations_continua, confirmations_resolvido')
      .eq('id', report_id)
      .single();

    // Get updated user profile
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('xp, coins, level, total_score')
      .eq('id', userId)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        confirmation: {
          type,
          distance_m: confirmationResult.distance_m,
          created_at: new Date().toISOString(),
        },
        report: {
          status: updatedReport?.status || 'ativo',
          confirmations_continua: updatedReport?.confirmations_continua || 0,
          confirmations_resolvido: updatedReport?.confirmations_resolvido || 0,
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
    console.error('Verify report error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});