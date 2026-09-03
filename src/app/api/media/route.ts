import { NextRequest, NextResponse } from "next/server";
import { searchMedia, createMediaAsset, MediaError } from "@/lib/newsroom/media";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const media = await searchMedia({
      query: sp.get("query") ?? undefined,
      licenseType: sp.get("licenseType") ?? undefined,
      channel: sp.get("channel") ?? undefined,
      rightsStatus: sp.get("rightsStatus") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return NextResponse.json({ media, count: media.length });
  } catch (error) {
    console.error("GET /api/media failed", error);
    return NextResponse.json(
      { error: "Failed to search media." },
      { status: 500 }
    );
  }
}

/**
 * Register a new media asset by URL (agent-supplied or wire-service imagery).
 * The image is referenced, not downloaded; licensing metadata is required so
 * the Handoff Engine can gate publication on rights.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const media = await createMediaAsset({
      url: body?.url,
      title: body?.title,
      description: body?.description,
      photographer: body?.photographer,
      source: body?.source,
      licenseType: body?.licenseType,
      licenseNotes: body?.licenseNotes,
      allowedChannels: Array.isArray(body?.allowedChannels) ? body.allowedChannels : undefined,
      expiresAt: body?.expiresAt ?? null,
      creditRequired: typeof body?.creditRequired === "boolean" ? body.creditRequired : undefined,
      creditLine: body?.creditLine,
      width: body?.width,
      height: body?.height,
    });
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/media failed", error);
    return NextResponse.json(
      { error: "Failed to register media asset." },
      { status: 500 }
    );
  }
}
