import { db } from "@/lib/db";
import type {
  Channel,
  CreateMediaAssetInput,
  MediaAssetDTO,
  MediaRights,
  RightsStatus,
} from "./types";

const EXPIRING_SOON_DAYS = 14;

function parseChannels(raw: string): Channel[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is Channel =>
      ["web", "print", "social", "broadcast"].includes(c)
    );
  } catch {
    return [];
  }
}

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

export function computeRights(asset: {
  allowedChannels: string;
  expiresAt: Date | null;
  licenseType: string;
  licenseNotes: string;
  creditRequired: boolean;
  creditLine: string;
}, now: Date = new Date()): MediaRights {
  const channels = parseChannels(asset.allowedChannels);
  let status: RightsStatus = "PERPETUAL";
  let days: number | null = null;

  if (asset.expiresAt) {
    days = daysUntil(asset.expiresAt, now);
    if (days < 0) status = "EXPIRED";
    else if (days <= EXPIRING_SOON_DAYS) status = "EXPIRING_SOON";
    else status = "VALID";
  }

  return {
    status,
    webAllowed: channels.includes("web"),
    allowedChannels: channels,
    expiresAt: asset.expiresAt ? asset.expiresAt.toISOString() : null,
    daysUntilExpiry: days,
    licenseType: asset.licenseType,
    licenseNotes: asset.licenseNotes,
    creditRequired: asset.creditRequired,
    creditLine: asset.creditLine,
  };
}

type AssetRow = {
  id: string;
  fileName: string;
  externalUrl?: string | null;
  title: string;
  description: string;
  photographer: string;
  source: string;
  licenseType: string;
  licenseNotes: string;
  allowedChannels: string;
  expiresAt: Date | null;
  creditRequired: boolean;
  creditLine: string;
  width: number | null;
  height: number | null;
  format: string;
  sizeKb: number;
  createdAt: Date;
  stories?: Array<{ story: { title: string } }>;
};

export function toMediaAssetDTO(asset: AssetRow): MediaAssetDTO {
  const attached = asset.stories?.map((s) => s.story.title) ?? [];
  return {
    id: asset.id,
    fileName: asset.fileName,
    url: asset.externalUrl ?? `/media/${asset.fileName}`,
    externalUrl: asset.externalUrl ?? null,
    title: asset.title,
    description: asset.description,
    photographer: asset.photographer,
    source: asset.source,
    licenseType: asset.licenseType,
    licenseNotes: asset.licenseNotes,
    allowedChannels: parseChannels(asset.allowedChannels),
    expiresAt: asset.expiresAt ? asset.expiresAt.toISOString() : null,
    creditRequired: asset.creditRequired,
    creditLine: asset.creditLine,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    sizeKb: asset.sizeKb,
    createdAt: asset.createdAt.toISOString(),
    rights: computeRights(asset),
    attachedToCount: attached.length,
    attachedStoryTitles: attached,
  };
}

export interface MediaSearchFilters {
  query?: string;
  licenseType?: string;
  channel?: string;
  rightsStatus?: string; // VALID | EXPIRING_SOON | EXPIRED | PERPETUAL | "any"
  limit?: number;
}

export async function searchMedia(
  filters: MediaSearchFilters = {}
): Promise<MediaAssetDTO[]> {
  const assets = await db.mediaAsset.findMany({
    where: filters.query
      ? {
          OR: [
            { title: { contains: filters.query } },
            { description: { contains: filters.query } },
            { photographer: { contains: filters.query } },
            { source: { contains: filters.query } },
            { fileName: { contains: filters.query } },
          ],
        }
      : undefined,
    include: { stories: { include: { story: { select: { title: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  let dtos = assets.map((a) => toMediaAssetDTO(a));

  if (filters.licenseType && filters.licenseType !== "any") {
    dtos = dtos.filter((d) => d.licenseType === filters.licenseType);
  }
  if (filters.channel && filters.channel !== "any") {
    dtos = dtos.filter((d) => d.allowedChannels.includes(filters.channel as Channel));
  }
  if (filters.rightsStatus && filters.rightsStatus !== "any") {
    dtos = dtos.filter((d) => d.rights.status === filters.rightsStatus);
  }
  if (filters.limit && filters.limit > 0) {
    dtos = dtos.slice(0, filters.limit);
  }
  return dtos;
}

export async function getMediaAsset(id: string): Promise<MediaAssetDTO | null> {
  const asset = await db.mediaAsset.findUnique({
    where: { id },
    include: { stories: { include: { story: { select: { title: true } } } } },
  });
  return asset ? toMediaAssetDTO(asset) : null;
}

// ---------------------------------------------------------------------------
// Register a new asset by URL (agent-supplied or wire-service imagery)
// ---------------------------------------------------------------------------

export class MediaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const VALID_LICENSES = [
  "Staff Original",
  "Rights-Managed",
  "Editorial Use Only",
  "Royalty-Free",
  "Creative Commons BY",
];

function slugifyFileName(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "asset"
  );
}

/**
 * Register a new media asset in the vault from an external image URL. The
 * image is not downloaded — the vault stores the reference plus its full
 * licensing metadata so the Handoff Engine can gate publication on rights.
 */
export async function createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAssetDTO> {
  const url = input.url?.trim() ?? "";
  if (!/^https?:\/\/.+/i.test(url)) {
    throw new MediaError("A valid http(s) image URL is required.", 422);
  }
  if (!input.title || input.title.trim().length < 3) {
    throw new MediaError("Asset title is required (at least 3 characters).", 422);
  }
  if (!input.photographer || input.photographer.trim().length < 2) {
    throw new MediaError("Photographer or originator is required.", 422);
  }

  const licenseType =
    input.licenseType && VALID_LICENSES.includes(input.licenseType)
      ? input.licenseType
      : "Rights-Managed";

  const channels = (input.allowedChannels ?? ["web"]).filter((c):
    c is Channel =>
    ["web", "print", "social", "broadcast"].includes(c)
  );

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (Number.isNaN(d.getTime())) {
      throw new MediaError("expiresAt must be an ISO date string or null.", 422);
    }
    expiresAt = d;
  }

  // Derive a unique fileName from the URL path or the title.
  let pathName = "";
  try {
    pathName = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    /* validated above */
  }
  const ext = (pathName.match(/\.(png|jpe?g|webp|gif|avif)$/i)?.[1] ?? "png").toLowerCase();
  const base = slugifyFileName(decodeURIComponent(pathName) || input.title);
  let fileName = `${base}.${ext}`;
  for (let n = 2; ; n += 1) {
    const clash = await db.mediaAsset.findUnique({ where: { fileName } });
    if (!clash) break;
    fileName = `${base}-${n}.${ext}`;
  }

  const width =
    typeof input.width === "number" && input.width > 0 ? Math.round(input.width) : null;
  const height =
    typeof input.height === "number" && input.height > 0 ? Math.round(input.height) : null;

  const created = await db.mediaAsset.create({
    data: {
      fileName,
      externalUrl: url,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      photographer: input.photographer.trim(),
      source: input.source?.trim() || "External wire",
      licenseType,
      licenseNotes: input.licenseNotes?.trim() ?? "",
      allowedChannels: JSON.stringify(channels.length ? channels : ["web"]),
      expiresAt,
      creditRequired: input.creditRequired ?? true,
      creditLine: input.creditLine?.trim() ?? "",
      width,
      height,
      format: ext === "jpg" ? "jpeg" : ext,
      sizeKb: 0,
    },
    include: { stories: { include: { story: { select: { title: true } } } } },
  });

  return toMediaAssetDTO(created);
}

export interface RightsReport {
  mediaId: string;
  title: string;
  usableForWeb: boolean;
  rights: MediaRights;
  problems: string[];
}

/** Deep rights check for a single asset, oriented at web publication. */
export async function checkMediaRights(id: string): Promise<RightsReport | null> {
  const asset = await getMediaAsset(id);
  if (!asset) return null;

  const problems: string[] = [];
  if (asset.rights.status === "EXPIRED") {
    problems.push(
      `License expired on ${new Date(asset.rights.expiresAt!).toISOString().slice(0, 10)}`
    );
  } else if (asset.rights.status === "EXPIRING_SOON") {
    problems.push(
      `License expires in ${asset.rights.daysUntilExpiry} day(s) — renewal required before republication`
    );
  }
  if (!asset.rights.webAllowed) {
    problems.push(
      `Channel "web" not permitted (allowed: ${asset.rights.allowedChannels.join(", ") || "none"})`
    );
  }
  if (asset.rights.creditRequired && !asset.rights.creditLine) {
    problems.push("Credit/attribution required but no credit line is set");
  }

  return {
    mediaId: asset.id,
    title: asset.title,
    usableForWeb: problems.length === 0,
    rights: asset.rights,
    problems,
  };
}

// ---------------------------------------------------------------------------
// Bulk license renewal — extend the license window of several dated assets
// in one go (e.g. every EXPIRING_SOON photo before the weekly handoff).
// ---------------------------------------------------------------------------

export interface BulkRenewInput {
  mediaIds: string[];
  /** New expiry date (ISO string). Required — bulk renewal extends windows. */
  expiresAt: string;
  /** Optional note appended to each asset's licenseNotes audit trail. */
  note?: string;
  actor?: string;
}

export async function bulkRenewLicenses(input: BulkRenewInput): Promise<MediaAssetDTO[]> {
  const ids = (input.mediaIds ?? []).filter((id) => typeof id === "string" && id.trim());
  if (ids.length === 0) {
    throw new MediaError("Select at least one asset to renew.", 422);
  }

  const date = new Date(input.expiresAt);
  if (!input.expiresAt || Number.isNaN(date.getTime())) {
    throw new MediaError("A valid expiresAt date is required.", 422);
  }

  const rows = await db.mediaAsset.findMany({ where: { id: { in: ids } } });
  if (rows.length !== ids.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new MediaError(`Unknown media asset(s): ${missing.join(", ")}`, 404);
  }

  const dateLabel = date.toISOString().slice(0, 10);
  const noteSuffix = input.note?.trim() ? `: ${input.note.trim()}` : "";

  await db.$transaction(
    rows.map((row) =>
      db.mediaAsset.update({
        where: { id: row.id },
        data: {
          expiresAt: date,
          licenseNotes: input.note?.trim()
            ? row.licenseNotes
              ? `${row.licenseNotes} · Renewed ${dateLabel}${noteSuffix}`
              : `Renewed ${dateLabel}${noteSuffix}`
            : row.licenseNotes,
        },
      })
    )
  );

  const updated = await db.mediaAsset.findMany({
    where: { id: { in: ids } },
    include: { stories: { include: { story: { select: { title: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return updated.map(toMediaAssetDTO);
}
