import { NextRequest, NextResponse } from "next/server";
import { executeHandoff, HandoffError } from "@/lib/newsroom/handoff";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!body?.storyId) {
      return NextResponse.json(
        { error: "storyId is required." },
        { status: 422 }
      );
    }
    const requestedBy =
      typeof body.requestedBy === "string" && body.requestedBy
        ? body.requestedBy
        : "newsroom-ui";

    const result = await executeHandoff(String(body.storyId), requestedBy);
    // Blocked handoffs are reported as 409 with full check details.
    if (!result.ok) {
      return NextResponse.json({ result }, { status: 409 });
    }
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof HandoffError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/handoff/execute failed", error);
    return NextResponse.json(
      { error: "Failed to execute handoff." },
      { status: 500 }
    );
  }
}
