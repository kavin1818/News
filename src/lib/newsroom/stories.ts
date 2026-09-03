import { db } from "@/lib/db";
import {
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  type StoryAttachmentDTO,
  type StoryDTO,
  type StoryStatus,
} from "./types";
import { toMediaAssetDTO } from "./media";
import { recordStoryEvent } from "./events";

export class StoryError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const VALID_STATUSES: StoryStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "PUBLISHED",
];

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  desk: string;
  author: string;
  assignee: string | null;
  priority: string;
  scheduledFor: Date | null;
  runOrder: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  media?: Array<{
    mediaId: string;
    isPrimary: boolean;
    caption: string | null;
    altText: string | null;
    attachedAt: Date;
    media: Parameters<typeof toMediaAssetDTO>[0];
  }>;
  handoffs?: Array<{ id: string }>;
};

export function toStoryDTO(story: StoryRow): StoryDTO {
  const media: StoryAttachmentDTO[] = (story.media ?? [])
    .map((m) => ({
      mediaId: m.mediaId,
      isPrimary: m.isPrimary,
      caption: m.caption,
      altText: m.altText,
      attachedAt: m.attachedAt.toISOString(),
      media: toMediaAssetDTO(m.media),
    }))
    // primary first, then by attachment time
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.attachedAt.localeCompare(b.attachedAt);
    });

  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    summary: story.summary,
    body: story.body,
    status: story.status as StoryStatus,
    desk: story.desk,
    author: story.author,
    assignee: story.assignee,
    priority: story.priority,
    scheduledFor: story.scheduledFor ? story.scheduledFor.toISOString() : null,
    runOrder: story.runOrder,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
    publishedAt: story.publishedAt ? story.publishedAt.toISOString() : null,
    wordCount: story.body.trim() ? story.body.trim().split(/\s+/).length : 0,
    media,
    handoffCount: story.handoffs?.length ?? 0,
  };
}

export async function getStory(id: string): Promise<StoryDTO | null> {
  const story = await db.story.findUnique({
    where: { id },
    include: {
      media: {
        include: { media: true },
      },
      handoffs: { select: { id: true } },
    },
  });
  return story ? toStoryDTO(story) : null;
}

export async function getStoryBySlug(slug: string): Promise<StoryDTO | null> {
  const story = await db.story.findUnique({
    where: { slug },
    include: {
      media: { include: { media: true } },
      handoffs: { select: { id: true } },
    },
  });
  return story ? toStoryDTO(story) : null;
}

export interface StoryListFilters {
  status?: string;
  desk?: string;
  assignee?: string;
  query?: string;
}

export async function listStories(
  filters: StoryListFilters = {}
): Promise<StoryDTO[]> {
  const stories = await db.story.findMany({
    where: {
      status: filters.status && filters.status !== "any" ? filters.status : undefined,
      desk: filters.desk && filters.desk !== "any" ? filters.desk : undefined,
      assignee:
        filters.assignee && filters.assignee !== "any"
          ? filters.assignee
          : undefined,
      OR: filters.query
        ? [
            { title: { contains: filters.query } },
            { summary: { contains: filters.query } },
            { body: { contains: filters.query } },
            { author: { contains: filters.query } },
            { slug: { contains: filters.query } },
          ]
        : undefined,
    },
    include: {
      media: { include: { media: true } },
      handoffs: { select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return stories.map(toStoryDTO);
}

export interface CreateStoryInput {
  title: string;
  summary?: string;
  body?: string;
  desk?: string;
  author?: string;
  assignee?: string | null;
  priority?: string;
  status?: string;
  slug?: string;
  scheduledFor?: string | null;
  actor?: string;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 64) || "untitled-story"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  // ensure uniqueness against DB
  for (;;) {
    const existing = await db.story.findUnique({ where: { slug } });
    if (!existing) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

export async function createStory(input: CreateStoryInput): Promise<StoryDTO> {
  if (!input.title || input.title.trim().length < 4) {
    throw new StoryError("Story title is required (at least 4 characters).", 422);
  }
  const base = slugify(input.slug || input.title);
  const slug = await uniqueSlug(base);

  const status = input.status && VALID_STATUSES.includes(input.status as StoryStatus)
    ? input.status
    : "DRAFT";

  const story = await db.story.create({
    data: {
      slug,
      title: input.title.trim(),
      summary: input.summary?.trim() ?? "",
      body: input.body ?? "",
      desk: input.desk ?? "City Hall",
      author: input.author?.trim() || "Newsroom Staff",
      assignee: input.assignee?.trim() || null,
      priority: input.priority ?? "NORMAL",
      status,
      scheduledFor: parseDate(input.scheduledFor),
    },
    include: { media: { include: { media: true } }, handoffs: { select: { id: true } } },
  });
  await recordStoryEvent({
    storyId: story.id,
    kind: "CREATED",
    message: `Story created on the ${story.desk} desk as ${STATUS_LABELS[story.status as StoryStatus]}.`,
    actor: input.actor,
  });
  return toStoryDTO(story);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Clone a story as a fresh Draft "follow-up" pitch. Copies the desk, byline,
 * standfirst and body so the writer starts from the original reporting;
 * status, media, handoff history and deadline start clean.
 */
export async function duplicateStory(
  id: string,
  opts: { actor?: string } = {}
): Promise<StoryDTO> {
  const source = await db.story.findUnique({
    where: { id },
    include: { media: { include: { media: true } }, handoffs: { select: { id: true } } },
  });
  if (!source) throw new StoryError(`Story ${id} not found.`, 404);

  const created = await createStory({
    title: `${source.title.replace(/\s+\(Follow-up\)\s*$/, "")} (Follow-up)`,
    summary: source.summary,
    body: source.body,
    desk: source.desk,
    author: source.author,
    priority: source.priority,
    status: "DRAFT",
    actor: opts.actor ?? "Newsroom Staff",
  });

  await recordStoryEvent({
    storyId: created.id,
    kind: "CREATED",
    message: `Pitched as a follow-up to "${source.title}".`,
    actor: opts.actor ?? "Newsroom Staff",
  });
  return created;
}

export interface UpdateStoryInput {
  title?: string;
  summary?: string;
  body?: string;
  desk?: string;
  assignee?: string | null;
  author?: string;
  priority?: string;
  scheduledFor?: string | null;
  actor?: string;
}

export async function updateStory(
  id: string,
  input: UpdateStoryInput
): Promise<StoryDTO> {
  const existing = await db.story.findUnique({ where: { id } });
  if (!existing) throw new StoryError(`Story ${id} not found.`, 404);
  if (existing.status === "PUBLISHED") {
    throw new StoryError(
      "Published stories are locked. Reopen review first to make changes.",
      409
    );
  }
  if (input.title !== undefined && input.title.trim().length < 4) {
    throw new StoryError("Story title must be at least 4 characters.", 422);
  }

  // Editorial guardrail: approval applies to the version that was reviewed.
  // Substantive copy edits (headline / standfirst / body) on an APPROVED
  // story revert it to Draft so the desk editor can re-review the copy.
  const approvedCopyEdited =
    existing.status === "APPROVED" &&
    ((input.title !== undefined && input.title.trim() !== existing.title) ||
      (input.summary !== undefined && input.summary.trim() !== existing.summary) ||
      (input.body !== undefined && input.body !== existing.body));

  const nextScheduled =
    input.scheduledFor === undefined ? existing.scheduledFor : parseDate(input.scheduledFor);
  if (input.scheduledFor !== undefined && input.scheduledFor && !nextScheduled) {
    throw new StoryError("scheduledFor must be an ISO date string or null.", 422);
  }

  const story = await db.story.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      summary: input.summary?.trim(),
      body: input.body,
      desk: input.desk,
      assignee: input.assignee === undefined ? undefined : input.assignee?.trim() || null,
      author: input.author?.trim(),
      priority: input.priority,
      scheduledFor: nextScheduled,
      ...(approvedCopyEdited ? { status: "DRAFT" as const } : {}),
    },
    include: { media: { include: { media: true } }, handoffs: { select: { id: true } } },
  });

  // Editorial changelog: summarize what changed.
  const changes: string[] = [];
  if (input.title !== undefined && input.title.trim() !== existing.title) changes.push("headline");
  if (input.summary !== undefined && input.summary.trim() !== existing.summary) changes.push("standfirst");
  if (input.body !== undefined && input.body !== existing.body) changes.push("body copy");
  if (input.desk !== undefined && input.desk !== existing.desk) changes.push(`desk → ${story.desk}`);
  if (input.author !== undefined && input.author?.trim() !== existing.author) changes.push(`byline → ${story.author}`);
  if (input.priority !== undefined && input.priority !== existing.priority) changes.push(`priority → ${story.priority}`);
  if (input.assignee !== undefined && (input.assignee?.trim() || null) !== existing.assignee) {
    changes.push(`editor → ${story.assignee ?? "unassigned"}`);
  }
  if (input.scheduledFor !== undefined && nextScheduled?.getTime() !== (existing.scheduledFor?.getTime() ?? null)) {
    changes.push(`deadline → ${nextScheduled ? nextScheduled.toISOString().slice(0, 10) : "none"}`);
    if (nextScheduled) {
      await recordStoryEvent({
        storyId: id,
        kind: "DEADLINE_SET",
        message: `Publish deadline set to ${nextScheduled.toISOString().slice(0, 10)}.`,
        actor: input.actor,
      });
    }
  }
  if (changes.length > 0) {
    await recordStoryEvent({
      storyId: id,
      kind: "EDITED",
      message: `Updated ${changes.slice(0, 4).join(", ")}${changes.length > 4 ? ` +${changes.length - 4} more` : ""}.`,
      actor: input.actor,
    });
  }
  if (approvedCopyEdited) {
    await recordStoryEvent({
      storyId: id,
      kind: "STATUS_CHANGED",
      message: "Approved copy changed — story reverted to Draft for re-review.",
      actor: input.actor,
    });
  }

  return toStoryDTO(story);
}

export async function changeStoryStatus(
  id: string,
  nextStatus: string,
  actor?: string
): Promise<StoryDTO> {
  const story = await db.story.findUnique({ where: { id } });
  if (!story) throw new StoryError(`Story ${id} not found.`, 404);

  const current = story.status as StoryStatus;
  const next = nextStatus as StoryStatus;

  if (!VALID_STATUSES.includes(next)) {
    throw new StoryError(
      `Invalid status "${nextStatus}". Valid statuses: ${VALID_STATUSES.join(", ")}.`,
      422
    );
  }
  if (current === next) {
    throw new StoryError(`Story is already in status ${STATUS_LABELS[next]}.`, 409);
  }
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new StoryError(
      `Illegal transition ${STATUS_LABELS[current]} → ${STATUS_LABELS[next]}. Allowed from ${STATUS_LABELS[current]}: ${
        allowed.length ? allowed.map((s) => STATUS_LABELS[s]).join(", ") : "none (terminal status)"
      }.`,
      409
    );
  }

  // Joining a column appends to the end of its run order; the target column
  // is resequenced 1..n so positions stay dense for the board.
  const column = await db.story.findMany({
    where: { status: next },
    orderBy: [{ runOrder: "asc" }, { updatedAt: "desc" }],
  });

  const updated = await db.story.update({
    where: { id },
    data: { status: next, runOrder: column.length + 1 },
    include: { media: { include: { media: true } }, handoffs: { select: { id: true } } },
  });
  const ordered = [...column, updated];
  await db.$transaction(
    ordered.map((s, i) =>
      db.story.update({ where: { id: s.id }, data: { runOrder: i + 1 } })
    )
  );
  await recordStoryEvent({
    storyId: id,
    kind: "STATUS_CHANGED",
    message: `Status moved ${STATUS_LABELS[current]} → ${STATUS_LABELS[next]}.`,
    actor,
  });
  return toStoryDTO(updated);
}

/** Convenience wrapper used by the UI quick-action and the approve_story tool. */
export async function approveStory(id: string, actor?: string): Promise<StoryDTO> {
  const story = await db.story.findUnique({ where: { id } });
  if (!story) throw new StoryError(`Story ${id} not found.`, 404);
  if (story.status !== "IN_REVIEW") {
    throw new StoryError(
      `Only stories In Review can be approved. "${story.title}" is ${STATUS_LABELS[story.status as StoryStatus]}.`,
      409
    );
  }
  return changeStoryStatus(id, "APPROVED", actor);
}

// ---------------------------------------------------------------------------
// Run order — position of a story within its status column on the board.
// ---------------------------------------------------------------------------

/**
 * Move a story within its current status column's run order. The whole
 * column is resequenced (runOrder = 1..n) so positions stay dense.
 * - `beforeStoryId`: insert immediately before that story.
 * - `position: "top" | "bottom"`: prepend/append (default bottom).
 */
export async function moveStoryInRunOrder(
  storyId: string,
  opts: {
    beforeStoryId?: string | null;
    position?: "top" | "bottom" | null;
    actor?: string;
  } = {}
): Promise<StoryDTO> {
  const story = await db.story.findUnique({ where: { id: storyId } });
  if (!story) throw new StoryError(`Story ${storyId} not found.`, 404);

  const column = await db.story.findMany({
    where: { status: story.status },
    orderBy: [{ runOrder: "asc" }, { updatedAt: "desc" }],
  });

  if (column.length <= 1) {
    // Nothing to reorder against — still normalize its position to 1.
    if (story.runOrder !== 1) {
      await db.story.update({ where: { id: storyId }, data: { runOrder: 1 } });
    }
    const updated = await getStory(storyId);
    return updated!;
  }

  if (opts.beforeStoryId && !column.some((s) => s.id === opts.beforeStoryId)) {
    throw new StoryError(
      `Story ${opts.beforeStoryId} is not in the ${STATUS_LABELS[story.status as StoryStatus]} column.`,
      422
    );
  }

  const rest = column.filter((s) => s.id !== storyId);
  let insertIndex: number;
  if (opts.beforeStoryId) {
    insertIndex = rest.findIndex((s) => s.id === opts.beforeStoryId);
  } else if (opts.position === "top") {
    insertIndex = 0;
  } else {
    insertIndex = rest.length;
  }

  const ordered = [...rest.slice(0, insertIndex), story, ...rest.slice(insertIndex)];

  await db.$transaction(
    ordered.map((s, i) =>
      db.story.update({ where: { id: s.id }, data: { runOrder: i + 1 } })
    )
  );

  const oldIndex = column.findIndex((s) => s.id === storyId);
  if (oldIndex !== insertIndex) {
    await recordStoryEvent({
      storyId,
      kind: "RUN_ORDER_CHANGED",
      message: `Moved to position ${insertIndex + 1} of ${ordered.length} in the ${STATUS_LABELS[story.status as StoryStatus]} run order.`,
      actor: opts.actor,
    });
  }

  const updated = await getStory(storyId);
  return updated!;
}

export async function deleteStory(id: string): Promise<void> {
  const story = await db.story.findUnique({ where: { id } });
  if (!story) throw new StoryError(`Story ${id} not found.`, 404);
  await db.story.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function attachMedia(
  storyId: string,
  mediaId: string,
  opts: { caption?: string | null; altText?: string | null; isPrimary?: boolean; actor?: string } = {}
): Promise<StoryDTO> {
  const story = await db.story.findUnique({ where: { id: storyId } });
  if (!story) throw new StoryError(`Story ${storyId} not found.`, 404);
  if (story.status === "PUBLISHED") {
    throw new StoryError("Cannot attach media to a published story.", 409);
  }
  const media = await db.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!media) throw new StoryError(`Media asset ${mediaId} not found.`, 404);

  const existing = await db.storyMedia.findUnique({
    where: { storyId_mediaId: { storyId, mediaId } },
  });
  if (existing) {
    throw new StoryError(
      `"${media.title}" is already attached to this story.`,
      409
    );
  }

  const count = await db.storyMedia.count({ where: { storyId } });

  await db.storyMedia.create({
    data: {
      storyId,
      mediaId,
      caption: opts.caption?.trim() || null,
      altText: opts.altText?.trim() || null,
      isPrimary: opts.isPrimary ?? count === 0,
    },
  });

  // If explicitly marked primary, demote others
  if (opts.isPrimary) {
    await db.storyMedia.updateMany({
      where: { storyId, mediaId: { not: mediaId } },
      data: { isPrimary: false },
    });
  }

  await recordStoryEvent({
    storyId,
    kind: "MEDIA_ATTACHED",
    message: `Attached media "${media.title}"${opts.isPrimary ? " as the lead image" : ""}.`,
    actor: opts.actor,
  });

  const updated = await getStory(storyId);
  return updated!;
}

export async function detachMedia(
  storyId: string,
  mediaId: string,
  opts: { actor?: string; reason?: "removed" | "replaced" } = {}
): Promise<StoryDTO> {
  const link = await db.storyMedia.findUnique({
    where: { storyId_mediaId: { storyId, mediaId } },
  });
  if (!link) {
    throw new StoryError(
      `Media ${mediaId} is not attached to story ${storyId}.`,
      404
    );
  }
  const removed = await db.mediaAsset.findUnique({ where: { id: mediaId }, select: { title: true } });
  await db.storyMedia.delete({
    where: { storyId_mediaId: { storyId, mediaId } },
  });

  // If the primary was removed, promote the oldest remaining attachment.
  if (link.isPrimary) {
    const remaining = await db.storyMedia.findFirst({
      where: { storyId },
      orderBy: { attachedAt: "asc" },
    });
    if (remaining) {
      await db.storyMedia.update({
        where: { storyId_mediaId: { storyId, mediaId: remaining.mediaId } },
        data: { isPrimary: true },
      });
    }
  }

  if (removed) {
    await recordStoryEvent({
      storyId,
      kind: "MEDIA_DETACHED",
      message:
        opts.reason === "replaced"
          ? `Removed "${removed.title}" during a media replacement.`
          : `Removed media "${removed.title}".`,
      actor: opts.actor,
    });
  }

  const updated = await getStory(storyId);
  return updated!;
}

/**
 * Replace an attachment in one action: detach the old asset, attach the new
 * one, preserving caption and lead-image status. Used by the expired-rights
 * remediation flow in the UI and the replace_story_media WebMCP tool.
 */
export async function replaceStoryMedia(
  storyId: string,
  oldMediaId: string,
  newMediaId: string,
  opts: { caption?: string | null; altText?: string | null; actor?: string } = {}
): Promise<StoryDTO> {
  const story = await db.story.findUnique({ where: { id: storyId } });
  if (!story) throw new StoryError(`Story ${storyId} not found.`, 404);
  if (story.status === "PUBLISHED") {
    throw new StoryError("Cannot replace media on a published story.", 409);
  }
  if (oldMediaId === newMediaId) {
    throw new StoryError("Replacement asset must differ from the current asset.", 422);
  }
  const oldLink = await db.storyMedia.findUnique({
    where: { storyId_mediaId: { storyId, mediaId: oldMediaId } },
  });
  if (!oldLink) {
    throw new StoryError(`Media ${oldMediaId} is not attached to story ${storyId}.`, 404);
  }
  const newMedia = await db.mediaAsset.findUnique({ where: { id: newMediaId } });
  if (!newMedia) throw new StoryError(`Media asset ${newMediaId} not found.`, 404);
  const alreadyAttached = await db.storyMedia.findUnique({
    where: { storyId_mediaId: { storyId, mediaId: newMediaId } },
  });
  if (alreadyAttached) {
    throw new StoryError(`"${newMedia.title}" is already attached to this story.`, 409);
  }

  const wasPrimary = oldLink.isPrimary;
  const oldMedia = await db.mediaAsset.findUnique({
    where: { id: oldMediaId },
    select: { title: true },
  });

  await db.storyMedia.delete({
    where: { storyId_mediaId: { storyId, mediaId: oldMediaId } },
  });
  await db.storyMedia.create({
    data: {
      storyId,
      mediaId: newMediaId,
      caption: opts.caption === undefined ? oldLink.caption : opts.caption?.trim() || null,
      // The image content changed, so its text alternative no longer applies:
      // alt text resets unless an explicit new one is provided. This keeps the
      // handoff accessibility check honest after a replacement.
      altText: opts.altText === undefined ? null : opts.altText?.trim() || null,
      isPrimary: wasPrimary,
    },
  });

  await recordStoryEvent({
    storyId,
    kind: "MEDIA_REPLACED",
    message: `Replaced "${oldMedia?.title ?? oldMediaId}" with "${newMedia.title}".`,
    actor: opts.actor,
  });

  const updated = await getStory(storyId);
  return updated!;
}

export async function updateAttachment(
  storyId: string,
  mediaId: string,
  opts: { caption?: string | null; altText?: string | null; isPrimary?: boolean }
): Promise<StoryDTO> {
  const link = await db.storyMedia.findUnique({
    where: { storyId_mediaId: { storyId, mediaId } },
  });
  if (!link) {
    throw new StoryError(
      `Media ${mediaId} is not attached to story ${storyId}.`,
      404
    );
  }
  await db.storyMedia.update({
    where: { storyId_mediaId: { storyId, mediaId } },
    data: {
      caption: opts.caption === undefined ? undefined : opts.caption?.trim() || null,
      altText: opts.altText === undefined ? undefined : opts.altText?.trim() || null,
      isPrimary: opts.isPrimary,
    },
  });
  if (opts.isPrimary) {
    await db.storyMedia.updateMany({
      where: { storyId, mediaId: { not: mediaId } },
      data: { isPrimary: false },
    });
  }
  const updated = await getStory(storyId);
  return updated!;
}

// ---------------------------------------------------------------------------
// Alt-text suggestion — deterministic, editor-in-the-loop
// ---------------------------------------------------------------------------

export type AltSuggestionSource = "caption" | "description" | "title";

/**
 * Deterministic alt-text suggestion for a story attachment. No AI in the loop —
 * the suggestion is derived from the attachment caption, the asset description
 * or (last resort) the asset title, trimmed to its first sentence and capped at
 * 140 characters (screen-reader friendly). The editor always sees and can edit
 * the result before it is saved, and the same routine backs the WebMCP
 * `suggest_alt_text` tool so agents and humans get identical output.
 */
export async function suggestAltText(
  storyId: string,
  mediaId: string
): Promise<{
  storyId: string;
  mediaId: string;
  suggestion: string;
  source: AltSuggestionSource;
}> {
  const link = await db.storyMedia.findUnique({
    where: { storyId_mediaId: { storyId, mediaId } },
    include: { media: true },
  });
  if (!link) {
    throw new StoryError(
      `Media ${mediaId} is not attached to story ${storyId}.`,
      404
    );
  }

  const candidates: Array<{ text: string | null | undefined; source: AltSuggestionSource }> = [
    { text: link.caption, source: "caption" },
    { text: link.media.description, source: "description" },
    { text: link.media.title, source: "title" },
  ];

  for (const { text, source } of candidates) {
    const base = text?.trim();
    if (!base) continue;
    // First sentence only (sentence enders or a line break), then cap length.
    const firstSentence = base.split(/(?<=[.!?])\s+|\n+/)[0].trim() || base;
    const capped =
      firstSentence.length > 140
        ? `${firstSentence.slice(0, 137).trimEnd()}…`
        : firstSentence;
    if (capped) return { storyId, mediaId, suggestion: capped, source };
  }

  throw new StoryError(
    `No caption, description or title available to suggest alt text for media ${mediaId}.`,
    422
  );
}
