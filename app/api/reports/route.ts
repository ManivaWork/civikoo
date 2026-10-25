import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { latitude, longitude, category, title, photo_url } = body;

    if (!latitude || !longitude || !category || !title || !photo_url) {
      return NextResponse.json(
        { error: "Missing required fields: latitude, longitude, category, title, photo_url" },
        { status: 400 }
      );
    }

    // In a real deployment, this would call the Supabase Edge Function
    // For now, we'll simulate a successful response
    // The actual Supabase function is at /functions/v1/add-report

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      // Forward to Supabase Edge Function
      const authHeader = request.headers.get("Authorization");
      const response = await fetch(`${supabaseUrl}/functions/v1/add-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader || `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(data, { status: response.status });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Development fallback - mock response
    console.log("Creating report:", body);

    return NextResponse.json(
      {
        success: true,
        report: {
          id: `report-${Date.now()}`,
          latitude: body.latitude,
          longitude: body.longitude,
          category: body.category,
          title: body.title,
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