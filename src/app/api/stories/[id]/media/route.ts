import { NextRequest, NextResponse } from "next/server";
import { attachMedia, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    if (!body?.mediaId) {
      return NextResponse.json(
        { error: "mediaId is required." },
        { status: 422 }
      );
    }
    const story = await attachMedia(id, String(body.mediaId), {
      caption: body.caption ?? null,
      altText: body.altText ?? null,
      // Explicit true forces lead + demotes other primaries. Omitted (or
      // false) defers to the business rule: the first attachment on a story
      // with no lead image becomes primary automatically.
      isPrimary: body.isPrimary === true ? true : undefined,
    });
    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/stories/[id]/media failed", error);
    return NextResponse.json(
      { error: "Failed to attach media." },
      { status: 500 }
    );
  }
}
