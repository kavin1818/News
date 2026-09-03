import { db } from "@/lib/db";
import {
  STATUS_LABELS,
  type HandoffDTO,
  type StoryDTO,
  type ValidationCheck,
  type ValidationResult,
  type WebHandoffPayload,
} from "./types";
import { getStory } from "./stories";
import { checkMediaRights } from "./media";
import { recordStoryEvent } from "./events";

export class HandoffError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const HANDOFF_TARGET = "cms-web";
export const SOURCE_SYSTEM = "meridian-newsroom/1.0";

function generateHandoffRef(): string {
  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `WEB-${ymd}-${rand}`;
}

/**
 * Full pre-publication validation for a story. Shared by the Handoff Engine
 * UI, the /api/handoff/validate endpoint and the WebMCP validate_publication
 * tool — one source of truth for what "ready to publish" means.
 */
export async function validateStoryForPublication(
  storyId: string
): Promise<{ result: ValidationResult; story: StoryDTO | null }> {
  const story = await getStory(storyId);

  if (!story) {
    return {
      story: null,
      result: {
        storyId,
        valid: false,
        failedCheckIds: ["story-exists"],
        checks: [
          {
            id: "story-exists",
            label: "Story exists",
            status: "fail",
            detail: `No story found with id ${storyId}.`,
          },
        ],
      },
    };
  }

  const checks: ValidationCheck[] = [];
  const add = (
    id: string,
    label: string,
    ok: boolean,
    passDetail: string,
    failDetail: string
  ) =>
    checks.push({
      id,
      label,
      status: ok ? "pass" : "fail",
      detail: ok ? passDetail : failDetail,
    });

  // 1. Editorial status
  add(
    "story-approved",
    "Editorial status is Approved",
    story.status === "APPROVED",
    `Status: ${STATUS_LABELS[story.status]}.`,
    `Status is ${STATUS_LABELS[story.status]} — only Approved stories can be handed off.`
  );

  // 2. Desk editor assigned
  add(
    "editor-assigned",
    "Desk editor assigned",
    !!story.assignee,
    `Assigned to ${story.assignee}.`,
    "No desk editor assigned — assign an editor before handoff."
  );

  // 3. Headline
  const titleOk = story.title.trim().length >= 12 && story.title.length <= 140;
  add(
    "headline-quality",
    "Headline length (12–140 chars)",
    titleOk,
    `${story.title.length} characters.`,
    `Headline is ${story.title.length} characters — must be between 12 and 140.`
  );

  // 4. Standfirst / summary
  const summaryOk = story.summary.trim().length >= 30 && story.summary.length <= 300;
  add(
    "standfirst",
    "Standfirst/summary (30–300 chars)",
    summaryOk,
    `${story.summary.trim().length} characters.`,
    `Summary is ${story.summary.trim().length} characters — must be between 30 and 300.`
  );

  // 5. Body copy
  const bodyOk = story.wordCount >= 100;
  add(
    "body-copy",
    "Body copy (≥ 100 words)",
    bodyOk,
    `${story.wordCount} words.`,
    `Body is only ${story.wordCount} words — needs at least 100.`
  );

  // 6. Media attached
  add(
    "media-attached",
    "Media attached",
    story.media.length > 0,
    `${story.media.length} asset(s) attached.`,
    "No media attached — attach at least one approved asset."
  );

  // 7. Primary media
  const primary = story.media.find((m) => m.isPrimary);
  add(
    "primary-media",
    "Primary (lead) media set",
    !!primary,
    primary ? `Lead image: "${primary.media.title}".` : "",
    "No primary image marked — set one attachment as the lead image."
  );

  // 8-10. Per-asset rights
  const expired: string[] = [];
  const noWeb: string[] = [];
  const noCredit: string[] = [];
  for (const att of story.media) {
    const report = await checkMediaRights(att.media.id);
    if (!report) continue;
    if (report.rights.status === "EXPIRED") {
      expired.push(att.media.title);
    }
    if (!report.rights.webAllowed) {
      noWeb.push(att.media.title);
    }
    if (report.rights.creditRequired && !report.rights.creditLine) {
      noCredit.push(att.media.title);
    }
  }

  add(
    "media-rights",
    "All media licenses valid (not expired)",
    expired.length === 0,
    "All attached assets are within their license window.",
    expired.length === 1
      ? `Expired license: ${expired[0]}. Replace the asset before handoff.`
      : `Expired licenses: ${expired.join(", ")}. Replace the assets before handoff.`
  );

  add(
    "media-web-channel",
    'All media cleared for "web" channel',
    noWeb.length === 0,
    'Every attached asset permits web use.',
    noWeb.length === 1
      ? `${noWeb[0]} is not licensed for the web channel.`
      : `${noWeb.join(", ")} are not licensed for the web channel.`
  );

  add(
    "media-credits",
    "Attribution present for all media",
    noCredit.length === 0,
    "All credit lines present.",
    `Missing credit line: ${noCredit.join(", ")}.`
  );

  // 11. Accessibility: alt text for every attached asset (delivered in the
  // payload as the image's `alt` attribute).
  const noAlt = story.media
    .filter((m) => !m.altText?.trim())
    .map((m) => m.media.title);
  add(
    "media-alt-text",
    "Alt text present for all media",
    noAlt.length === 0,
    "Every asset carries a text alternative for screen readers.",
    noAlt.length === 1
      ? `Missing alt text: ${noAlt[0]}. Add a text alternative on the Story Desk.`
      : `Missing alt text: ${noAlt.join(", ")}. Add text alternatives on the Story Desk.`
  );

  const failed = checks.filter((c) => c.status === "fail").map((c) => c.id);

  return {
    story,
    result: {
      storyId: story.id,
      valid: failed.length === 0,
      checks,
      failedCheckIds: failed,
    },
  };
}

/** Build the web publishing payload (also persisted on successful handoff). */
export function buildWebPayload(
  story: StoryDTO,
  handoffRef: string,
  requestedBy = "newsroom-ui"
): WebHandoffPayload {
  return {
    handoffType: "web-publish",
    handoffRef,
    generatedAt: new Date().toISOString(),
    sourceSystem: SOURCE_SYSTEM,
    story: {
      id: story.id,
      slug: story.slug,
      headline: story.title,
      standfirst: story.summary,
      body: story.body,
      byline: `By ${story.author}`,
      desk: story.desk,
      priority: story.priority,
      wordCount: story.wordCount,
      scheduledFor: story.scheduledFor,
    },
    media: story.media.map((att) => ({
      id: att.media.id,
      fileName: att.media.fileName,
      url: att.media.url,
      role: att.isPrimary ? ("primary" as const) : ("supporting" as const),
      alt: att.altText || att.caption || att.media.title,
      caption: att.caption,
      credit: att.media.creditLine,
      license: att.media.licenseType,
      width: att.media.width,
      height: att.media.height,
      format: att.media.format,
    })),
    seo: {
      slug: story.slug,
      metaDescription: story.summary.slice(0, 160),
    },
    delivery: {
      target: HANDOFF_TARGET,
      channel: "web",
      requestedBy,
    },
  };
}

/**
 * A previously prepared (not yet delivered) payload, returned alongside a new
 * preparation so any consumer — UI, agent tool, API client — can show exactly
 * what the re-preparation would change. Persisted server-side per story and
 * cleared on delivery, so the comparison survives browser sessions.
 */
export interface PreviousPayload {
  handoffRef: string;
  generatedAt: string;
  payload: WebHandoffPayload;
}

export async function prepareHandoff(
  storyId: string,
  requestedBy = "newsroom-ui"
): Promise<{
  payload: WebHandoffPayload;
  validation: ValidationResult;
  previous: PreviousPayload | null;
}> {
  const { story, result } = await validateStoryForPublication(storyId);
  if (!story) {
    throw new HandoffError(`Story ${storyId} not found.`, 404);
  }
  if (!result.valid) {
    throw new HandoffError(
      `Story "${story.title}" failed publication validation (${result.failedCheckIds.length} blocker(s)).`,
      409
    );
  }

  // Snapshot of the last prepared-but-undelivered payload for this story.
  const existing = await db.payloadSnapshot.findUnique({ where: { storyId } });
  const previous: PreviousPayload | null = existing
    ? {
        handoffRef: existing.handoffRef,
        generatedAt: existing.updatedAt.toISOString(),
        payload: JSON.parse(existing.payload) as WebHandoffPayload,
      }
    : null;

  const payload = buildWebPayload(story, generateHandoffRef(), requestedBy);

  await db.payloadSnapshot.upsert({
    where: { storyId },
    create: { storyId, handoffRef: payload.handoffRef, payload: JSON.stringify(payload) },
    update: { handoffRef: payload.handoffRef, payload: JSON.stringify(payload) },
  });

  return { payload, validation: result, previous };
}

export async function executeHandoff(
  storyId: string,
  requestedBy = "newsroom-ui"
): Promise<HandoffResult> {
  const { story, result } = await validateStoryForPublication(storyId);
  if (!story) {
    throw new HandoffError(`Story ${storyId} not found.`, 404);
  }

  if (!result.valid) {
    const issues = result.checks
      .filter((c) => c.status === "fail")
      .map((c) => `${c.label}: ${c.detail}`);
    return {
      ok: false,
      storyId,
      status: "FAILED",
      message: `Handoff blocked — ${issues.length} requirement(s) missing.`,
      checks: result.checks,
    };
  }

  const handoffRef = generateHandoffRef();
  const payload = buildWebPayload(story, handoffRef, requestedBy);
  const deliveredAt = new Date();

  await db.handoff.create({
    data: {
      handoffRef,
      storyId,
      status: "SUCCESS",
      target: HANDOFF_TARGET,
      payload: JSON.stringify(payload),
      issues: "[]",
    },
  });

  await db.story.update({
    where: { id: storyId },
    data: { status: "PUBLISHED", publishedAt: deliveredAt },
  });

  // The payload was delivered — the next preparation for this story starts
  // with a clean diff baseline.
  await db.payloadSnapshot.deleteMany({ where: { storyId } });

  await recordStoryEvent({
    storyId,
    kind: "HANDOFF_EXECUTED",
    message: `Web handoff ${handoffRef} delivered to ${HANDOFF_TARGET} (${payload.media.length} media asset(s)).`,
    actor: requestedBy,
  });

  return {
    ok: true,
    handoffRef,
    storyId,
    status: "SUCCESS",
    deliveredAt: deliveredAt.toISOString(),
    previewUrl: `https://cms.meridianledger.example/preview/${story.slug}`,
    message: `Story "${story.title}" handed off to the web CMS. ${payload.media.length} media asset(s) included.`,
  };
}

export async function listHandoffs(limit = 20): Promise<HandoffDTO[]> {
  const rows = await db.handoff.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { story: { select: { title: true } } },
  });
  return rows.map((h) => ({
    id: h.id,
    handoffRef: h.handoffRef,
    storyId: h.storyId,
    storyTitle: h.story.title,
    status: h.status,
    target: h.target,
    payload: JSON.parse(h.payload || "{}"),
    issues: JSON.parse(h.issues || "[]"),
    createdAt: h.createdAt.toISOString(),
  }));
}

/**
 * A single delivered handoff by its reference (e.g. WEB-20260902-8BD3) —
 * backs the shareable receipt view (?receipt=<ref>) and its API endpoint.
 */
export async function getHandoffByRef(ref: string): Promise<HandoffDTO | null> {
  const h = await db.handoff.findUnique({
    where: { handoffRef: ref },
    include: { story: { select: { title: true } } },
  });
  if (!h) return null;
  return {
    id: h.id,
    handoffRef: h.handoffRef,
    storyId: h.storyId,
    storyTitle: h.story.title,
    status: h.status,
    target: h.target,
    payload: JSON.parse(h.payload || "{}"),
    issues: JSON.parse(h.issues || "[]"),
    createdAt: h.createdAt.toISOString(),
  };
}
