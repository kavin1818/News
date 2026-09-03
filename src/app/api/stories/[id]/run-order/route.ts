import { NextRequest, NextResponse } from "next/server";
import { moveStoryInRunOrder, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Reposition a story within its current status column's run order.
 * Body: { beforeStoryId?: string | null, position?: "top" | "bottom" }.
 * The whole column is resequenced so positions stay dense (1..n).
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (body?.beforeStoryId === id) {
      return NextResponse.json(
        { error: "A story cannot be placed before itself." },
        { status: 422 }
      );
    }
    const position =
      body?.position === "top" || body?.position === "bottom" ? body.position : null;
    const story = await moveStoryInRunOrder(id, {
      beforeStoryId: typeof body?.beforeStoryId === "string" ? body.beforeStoryId : null,
      position,
    });
    return NextResponse.json({ story });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/stories/[id]/run-order failed", error);
    return NextResponse.json(
      { error: "Failed to update the run order." },
      { status: 500 }
    );
  }
}
