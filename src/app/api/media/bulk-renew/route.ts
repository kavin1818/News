import { NextRequest, NextResponse } from "next/server";
import { bulkRenewLicenses, MediaError } from "@/lib/newsroom/media";

export const dynamic = "force-dynamic";

/**
 * POST /api/media/bulk-renew
 * Extend the license window of several dated assets in one transaction.
 * Body: { mediaIds: string[], expiresAt: string, note?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    try {
      const media = await bulkRenewLicenses({
        mediaIds: Array.isArray(body?.mediaIds) ? body.mediaIds.map(String) : [],
        expiresAt: typeof body?.expiresAt === "string" ? body.expiresAt : "",
        note: typeof body?.note === "string" ? body.note : undefined,
        actor: typeof body?.requestedBy === "string" ? body.requestedBy : undefined,
      });
      return NextResponse.json({ media, renewed: media.length });
    } catch (err) {
      if (err instanceof MediaError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  } catch (error) {
    console.error("POST /api/media/bulk-renew failed", error);
    return NextResponse.json(
      { error: "Failed to renew licenses." },
      { status: 500 }
    );
  }
}
