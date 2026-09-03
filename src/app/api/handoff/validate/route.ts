import { NextRequest, NextResponse } from "next/server";
import { validateStoryForPublication } from "@/lib/newsroom/handoff";

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
    const { story, result } = await validateStoryForPublication(String(body.storyId));
    if (!story) {
      return NextResponse.json(
        { error: "Story not found.", validation: result },
        { status: 404 }
      );
    }
    return NextResponse.json({ validation: result, storyTitle: story.title });
  } catch (error) {
    console.error("POST /api/handoff/validate failed", error);
    return NextResponse.json(
      { error: "Validation failed unexpectedly." },
      { status: 500 }
    );
  }
}
