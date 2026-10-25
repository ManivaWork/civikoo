import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client with service role key for admin operations
export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Initialize Supabase client with user's JWT for RLS
export function getSupabaseUser(jwt: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: `Bearer ${jwt}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Extract user ID from JWT
export function getUserIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const jwt = authHeader.replace('Bearer ', '');
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

// Calculate distance between two GPS coordinates in meters (Haversine formula)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Anti-fraud: Check if user is within allowed radius
export function validateProximity(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  maxRadiusMeters: number = 50
): { valid: boolean; distance: number } {
  const distance = calculateDistance(userLat, userLng, targetLat, targetLng);
  return {
    valid: distance <= maxRadiusMeters,
    distance: Math.round(distance),
  };
}

// Rate limiting key generator
export function getRateLimitKey(userId: string, action: string): string {
  return `ratelimit:${action}:${userId}`;
}

// Simple in-memory rate limiter (for Edge Function instances)
// In production, use Redis or Supabase Realtime
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute