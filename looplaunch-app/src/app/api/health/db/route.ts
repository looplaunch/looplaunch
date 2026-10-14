import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/db/supabase";

export async function GET() {
  try {
    const health = await checkSupabaseConnection();
    if (health.ok) {
      return NextResponse.json({
        status: "ok",
        connected: true,
        message: health.message,
        database: health.database,
      });
    }
    return NextResponse.json(
      {
        status: "error",
        connected: false,
        message: health.message,
      },
      { status: 503 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "error",
        connected: false,
        message: msg,
      },
      { status: 500 }
    );
  }
}
