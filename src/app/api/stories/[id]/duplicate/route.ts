import { NextRequest, NextResponse } from "next/server";
import { duplicateStory, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pitch a follow-up: clone the story as a fresh Draft with clean media,
 * handoff history and deadline. Used by the Story Desk "Duplicate" quick
 * action and the duplicate_story WebMCP tool.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const story = await duplicateStory(id, {
      actor: typeof body?.actor === "string" && body.actor.trim() ? body.actor.trim() : undefined,
    });
    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/stories/[id]/duplicate failed", error);
    return NextResponse.json({ error: "Failed to duplicate story." }, { status: 500 });
  }
}
