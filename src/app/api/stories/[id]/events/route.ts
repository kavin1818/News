import { NextRequest, NextResponse } from "next/server";
import { listStoryEvents } from "@/lib/newsroom/events";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Number(limitParam) || 50, 100) : 50;
    const events = await listStoryEvents(id, limit);
    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    console.error("GET /api/stories/[id]/events failed", error);
    return NextResponse.json(
      { error: "Failed to load story timeline." },
      { status: 500 }
    );
  }
}
