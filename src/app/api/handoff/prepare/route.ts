import { NextRequest, NextResponse } from "next/server";
import { prepareHandoff, HandoffError, validateStoryForPublication } from "@/lib/newsroom/handoff";

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

    try {
      const { payload, validation, previous } = await prepareHandoff(
        String(body.storyId),
        requestedBy
      );
      return NextResponse.json({ payload, validation, previous });
    } catch (err) {
      if (err instanceof HandoffError && err.status === 409) {
        const { result } = await validateStoryForPublication(String(body.storyId));
        return NextResponse.json(
          { error: err.message, validation: result },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("POST /api/handoff/prepare failed", error);
    return NextResponse.json(
      { error: "Failed to prepare handoff payload." },
      { status: 500 }
    );
  }
}
