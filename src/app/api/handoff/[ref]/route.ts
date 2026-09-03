import { NextRequest, NextResponse } from "next/server";
import { getHandoffByRef } from "@/lib/newsroom/handoff";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ref: string }> };

/**
 * GET /api/handoff/[ref] — one delivered handoff by reference (WEB-…).
 * Backs the shareable receipt view and the agent-facing receipt lookup.
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { ref } = await ctx.params;
    const handoff = await getHandoffByRef(ref);
    if (!handoff) {
      return NextResponse.json(
        { error: `No handoff found with reference "${ref}".` },
        { status: 404 }
      );
    }
    return NextResponse.json({ handoff });
  } catch (error) {
    console.error("GET /api/handoff/[ref] failed", error);
    return NextResponse.json(
      { error: "Failed to load handoff." },
      { status: 500 }
    );
  }
}
