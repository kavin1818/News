import { NextRequest, NextResponse } from "next/server";
import { replaceStoryMedia, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One-action media replacement: detach the old asset, attach the new one,
 * preserving caption and lead-image status. Powers the expired-rights
 * remediation flow and the replace_story_media WebMCP tool.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (!body?.oldMediaId || !body?.newMediaId) {
      return NextResponse.json(
        { error: "oldMediaId and newMediaId are required." },
        { status: 422 }
      );
    }
    const story = await replaceStoryMedia(
      id,
      String(body.oldMediaId),
      String(body.newMediaId),
      {
        caption:
          body.caption === undefined ? undefined : body.caption?.trim() || null,
        actor: typeof body.actor === "string" ? body.actor : undefined,
      }
    );
    return NextResponse.json({ story });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/stories/[id]/media/replace failed", error);
    return NextResponse.json(
      { error: "Failed to replace media." },
      { status: 500 }
    );
  }
}
