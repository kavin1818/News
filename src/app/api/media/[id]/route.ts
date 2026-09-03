import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMediaAsset } from "@/lib/newsroom/media";
import type { Channel } from "@/lib/newsroom/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const asset = await getMediaAsset(id);
    if (!asset) {
      return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
    }
    return NextResponse.json({ media: asset });
  } catch (error) {
    console.error("GET /api/media/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to load media asset." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));

    const existing = await db.mediaAsset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.creditLine === "string") data.creditLine = body.creditLine.trim();
    if (typeof body.licenseNotes === "string") data.licenseNotes = body.licenseNotes;
    if (Array.isArray(body.allowedChannels)) {
      const valid: Channel[] = ["web", "print", "social", "broadcast"];
      const channels = body.allowedChannels.filter((c: string) =>
        valid.includes(c as Channel)
      );
      data.allowedChannels = JSON.stringify(channels);
    }
    if (body.expiresAt === null) data.expiresAt = null;
    else if (typeof body.expiresAt === "string" && body.expiresAt) {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "expiresAt must be an ISO date string or null." },
          { status: 422 }
        );
      }
      data.expiresAt = d;
    }

    await db.mediaAsset.update({ where: { id }, data });
    const asset = await getMediaAsset(id);
    return NextResponse.json({ media: asset });
  } catch (error) {
    console.error("PATCH /api/media/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to update media asset." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.mediaAsset.findUnique({
      where: { id },
      include: { stories: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Media asset not found." }, { status: 404 });
    }
    if (existing.stories.length > 0) {
      return NextResponse.json(
        {
          error: `Asset is attached to ${existing.stories.length} story/stories — detach it first.`,
        },
        { status: 409 }
      );
    }
    await db.mediaAsset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/media/[id] failed", error);
    return NextResponse.json(
      { error: "Failed to delete media asset." },
      { status: 500 }
    );
  }
}
