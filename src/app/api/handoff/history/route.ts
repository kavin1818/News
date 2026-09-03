import { NextResponse } from "next/server";
import { listHandoffs } from "@/lib/newsroom/handoff";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const handoffs = await listHandoffs(20);
    return NextResponse.json({ handoffs, count: handoffs.length });
  } catch (error) {
    console.error("GET /api/handoff/history failed", error);
    return NextResponse.json(
      { error: "Failed to load handoff history." },
      { status: 500 }
    );
  }
}
