import { NextRequest, NextResponse } from "next/server";
import { suggestAltText, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

/**
 * GET /api/stories/[id]/media/[mediaId]/suggest-alt — deterministic alt-text
 * suggestion derived from the attachment caption, the asset description or the
 * asset title. Same routine backs the WebMCP suggest_alt_text tool and the
 * inline editor in the Handoff payload step.
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id, mediaId } = await ctx.params;
    const result = await suggestAltText(id, mediaId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET suggest-alt failed", error);
    return NextResponse.json(
      { error: "Failed to suggest alt text." },
      { status: 500 }
    );
  }
}
