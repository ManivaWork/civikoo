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

interface VerifyReportRequest {
  report_id: string;
  type: 'confirmacao' | 'negacao';
  user_location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  notes?: string;
  photo_url?: string;
}

const POINTS_PER_VERIFICATION = 5;
const CONFIRMATIONS_FOR_AUTO_RESOLVE = 3;

// Rate limits: 30 verifications per hour per user
const VERIFY_RATE_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };

// Maximum distance for verification (50 meters as requested)
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

    // Validate type
    if (!['confirmacao', 'negacao'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be "confirmacao" or "negacao"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user location
    const { latitude: userLat, longitude: userLng } = user_location;
    if (!userLat || !userLng || userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid user location coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();

    // Get the report with creator info
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('id, creator_id, latitude, longitude, status, confirmations_count, denials_count')
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anti-fraud: User cannot verify their own report
    const { data: verifierProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    if (!verifierProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (verifierProfile.id === report.creator_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot verify your own report' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anti-fraud: Validate GPS proximity (50 meters max)
    const { valid, distance } = validateProximity(
      userLat,
      userLng,
      report.latitude,
      report.longitude,
      MAX_VERIFICATION_DISTANCE
    );

    if (!valid) {
      return new Response(
        JSON.stringify({
          error: 'Location verification failed',
          message: `You are ${distance}m away from the report location. Maximum allowed: ${MAX_VERIFICATION_DISTANCE}m.`,
          distance,
          maxAllowed: MAX_VERIFICATION_DISTANCE,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anti-fraud: Check if user already verified this report
    const { data: existingVerification } = await supabaseAdmin
      .from('verifications')
      .select('id, type')
      .eq('report_id', report_id)
      .eq('verifier_id', verifierProfile.id)
      .single();

    if (existingVerification) {
      return new Response(
        JSON.stringify({
          error: 'Already verified',
          message: `You already ${existingVerification.type === 'confirmacao' ? 'confirmed' : 'denied'} this report`,
          previousType: existingVerification.type,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Anti-fraud: Check if report is in a verifiable state
    if (!['ativo', 'em_analise'].includes(report.status)) {
      return new Response(
        JSON.stringify({
          error: 'Report not verifiable',
          message: `Report status is "${report.status}" and cannot be verified`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert verification record
    const { data: verification, error: verificationError } = await supabaseAdmin
      .from('verifications')
      .insert({
        report_id,
        verifier_id: verifierProfile.id,
        type,
        notes: body.notes?.trim() || null,
        photo_url: body.photo_url || null,
        score_awarded: POINTS_PER_VERIFICATION,
      })
      .select()
      .single();

    if (verificationError) {
      console.error('Verification insert error:', verificationError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user score for verification
    const { error: scoreError } = await supabaseAdmin.rpc('increment_user_score', {
      p_user_id: verifierProfile.id,
      p_points: POINTS_PER_VERIFICATION,
      p_activity_type: 'verification',
      p_reference_id: verification.id,
    });

    if (scoreError) {
      console.error('Verification score update error:', scoreError);
    }

    // Log activity
    await supabaseAdmin
      .from('user_activity_log')
      .insert({
        user_id: verifierProfile.id,
        activity_type: 'verification',
        reference_id: verification.id,
        points_earned: POINTS_PER_VERIFICATION,
      });

    // Get updated report counts
    const { data: updatedReport } = await supabaseAdmin
      .from('reports')
      .select('confirmations_count, denials_count, status')
      .eq('id', report_id)
      .single();

    // Check if report should be auto-resolved (3+ confirmations for resolved reports)
    let newStatus = report.status;
    let autoResolved = false;

    if (type === 'confirmacao' && updatedReport) {
      // Check if this is a confirmation of a resolved report pattern
      // Actually, the trigger in DB handles status changes based on ratios
      // But we can also check for explicit auto-resolve condition
      if (updatedReport.confirmations_count >= CONFIRMATIONS_FOR_AUTO_RESOLVE &&
          report.status === 'ativo') {
        // The database trigger will handle status change to 'em_analise'
        // This is just for response info
      }
    }

    // Get updated user score
    const { data: updatedUser } = await supabaseAdmin
      .from('users')
      .select('total_score, level')
      .eq('id', verifierProfile.id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        verification: {
          id: verification.id,
          report_id: verification.report_id,
          type: verification.type,
          created_at: verification.created_at,
          score_awarded: POINTS_PER_VERIFICATION,
        },
        report: {
          confirmations_count: updatedReport?.confirmations_count || 0,
          denials_count: updatedReport?.denials_count || 0,
          status: updatedReport?.status || report.status,
        },
        user: {
          new_total_score: updatedUser?.total_score || 0,
          new_level: updatedUser?.level || 1,
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