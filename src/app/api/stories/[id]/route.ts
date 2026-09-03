import { NextRequest, NextResponse } from "next/server";
import {
  getStory,
  updateStory,
  changeStoryStatus,
  approveStory,
  deleteStory,
  StoryError,
  UpdateStoryInput,
} from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function actorFromBody(body: Record<string, unknown>): string | undefined {
  return typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : undefined;
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const story = await getStory(id);
    if (!story) {
      return NextResponse.json({ error: "Story not found." }, { status: 404 });
    }
    return NextResponse.json({ story });
  } catch (error) {
    console.error("GET /api/stories/[id] failed", error);
    return NextResponse.json({ error: "Failed to load story." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();

    // Support three mutation shapes: field update, status transition, approve action.
    if (body && typeof body === "object" && "action" in body) {
      if (body.action === "approve") {
        const story = await approveStory(id, actorFromBody(body));
        return NextResponse.json({ story });
      }
      return NextResponse.json(
        { error: `Unknown action "${String(body.action)}".` },
        { status: 422 }
      );
    }

    if (body && typeof body === "object" && "status" in body) {
      const story = await changeStoryStatus(id, String(body.status), actorFromBody(body));
      return NextResponse.json({ story });
    }

    const story = await updateStory(id, body as UpdateStoryInput);
    return NextResponse.json({ story });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("PATCH /api/stories/[id] failed", error);
    return NextResponse.json({ error: "Failed to update story." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteStory(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("DELETE /api/stories/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete story." }, { status: 500 });
  }
}
