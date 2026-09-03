import { NextRequest, NextResponse } from "next/server";
import { detachMedia, updateAttachment, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id, mediaId } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const story = await updateAttachment(id, mediaId, {
      caption: body?.caption,
      altText: body?.altText,
      // Only touch the lead flag when the client explicitly sends it —
      // a caption/alt-only PATCH must never silently demote the primary.
      isPrimary:
        typeof body?.isPrimary === "boolean" ? body.isPrimary : undefined,
    });
    return NextResponse.json({ story });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("PATCH /api/stories/[id]/media/[mediaId] failed", error);
    return NextResponse.json(
      { error: "Failed to update attachment." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id, mediaId } = await ctx.params;
    const story = await detachMedia(id, mediaId);
    return NextResponse.json({ story });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("DELETE /api/stories/[id]/media/[mediaId] failed", error);
    return NextResponse.json(
      { error: "Failed to detach media." },
      { status: 500 }
    );
  }
}
