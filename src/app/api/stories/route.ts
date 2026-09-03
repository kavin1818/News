import { NextRequest, NextResponse } from "next/server";
import { listStories, createStory, StoryError } from "@/lib/newsroom/stories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const stories = await listStories({
      status: sp.get("status") ?? undefined,
      desk: sp.get("desk") ?? undefined,
      assignee: sp.get("assignee") ?? undefined,
      query: sp.get("query") ?? undefined,
    });
    return NextResponse.json({ stories, count: stories.length });
  } catch (error) {
    console.error("GET /api/stories failed", error);
    return NextResponse.json(
      { error: "Failed to list stories." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const story = await createStory(body);
    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    if (error instanceof StoryError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("POST /api/stories failed", error);
    return NextResponse.json(
      { error: "Failed to create story." },
      { status: 500 }
    );
  }
}
