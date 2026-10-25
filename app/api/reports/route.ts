import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { latitude, longitude, category, title, image_url, description } = body;

    if (!latitude || !longitude || !category || !title || !image_url) {
      return NextResponse.json(
        { error: "Missing required fields: latitude, longitude, category, title, image_url" },
        { status: 400 }
      );
    }

    // Validate latitude/longitude
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      "buraco_asfalto",
      "iluminacao",
      "lixo_entulho",
      "vazamento_agua",
      "sinalizacao",
      "acessibilidade",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Forward to Supabase Edge Function
    // The actual database insert will be done via RPC or directly with server-side values
    // Points, status, user_id are set by database triggers (SECURITY DEFINER functions)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const authHeader = request.headers.get("Authorization");
      const response = await fetch(`${supabaseUrl}/functions/v1/add-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader || `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          category,
          title,
          image_url,
          description: description || null,
          // NOT sending: points, status, user_id - these are set server-side by triggers
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(data, { status: response.status });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Development fallback - mock response
    console.log("Creating report:", { latitude: lat, longitude: lng, category, title, image_url, description });

    return NextResponse.json(
      {
        success: true,
        report: {
          id: `report-${Date.now()}`,
          latitude: lat,
          longitude: lng,
          category,
          title,
          description: description || null,
          image_url,
          status: "ativo",
          created_at: new Date().toISOString(),
          score_awarded: 10,
        },
        user: {
          new_total_score: 1260,
          new_level: 4,
        },
        rateLimit: {
          remaining: 9,
          resetAt: Date.now() + 3600000,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add report error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}