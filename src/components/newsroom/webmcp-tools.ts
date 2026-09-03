"use client";

/**
 * WebMCP tool definitions for the Meridian Ledger newsroom.
 *
 * These tools are the machine-facing surface of the exact same REST API the
 * human UI uses, so an external browser agent mutating a story through
 * `update_story_status` changes the same state a human editor sees — and
 * vice versa. After every mutating call we emit a `newsroom:data-changed`
 * window event so the on-page UI refreshes immediately.
 */

import * as api from "@/lib/newsroom/client";
import type { ModelContextTool } from "@/types/webmcp";
import type { StoryDTO } from "@/lib/newsroom/types";
import { diffPayloads } from "@/lib/newsroom/payload-diff";

const DATA_CHANGED_EVENT = "newsroom:data-changed";

function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

/** Compact story projection used in list responses to keep outputs small. */
function storySummary(s: Awaited<ReturnType<typeof api.fetchStories>>["stories"][number]) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    status: s.status,
    desk: s.desk,
    author: s.author,
    assignee: s.assignee,
    priority: s.priority,
    wordCount: s.wordCount,
    runOrder: s.runOrder,
    mediaCount: s.media.length,
    hasExpiredMedia: s.media.some((m) => m.media.rights.status === "EXPIRED"),
    handoffCount: s.handoffCount,
    updatedAt: s.updatedAt,
  };
}

function mediaSummary(m: Awaited<ReturnType<typeof api.fetchMedia>>["media"][number]) {
  return {
    id: m.id,
    fileName: m.fileName,
    url: m.url,
    title: m.title,
    photographer: m.photographer,
    source: m.source,
    licenseType: m.licenseType,
    rightsStatus: m.rights.status,
    expiresAt: m.rights.expiresAt,
    allowedChannels: m.allowedChannels,
    webAllowed: m.rights.webAllowed,
    creditLine: m.creditLine,
    attachedToCount: m.attachedToCount,
  };
}

const ok = (data: Record<string, unknown>) => ({ ok: true as const, ...data });
const fail = (error: string, extra: Record<string, unknown> = {}) => ({
  ok: false as const,
  error,
  ...extra,
});

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function requireString(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Missing required string parameter "${key}".`);
  }
  return v.trim();
}

function run<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

const STORY_STATUS_ENUM = [
  "DRAFT",
  "IN_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "PUBLISHED",
];

export const NEWSROOM_TOOLS: ModelContextTool[] = [
  // ----------------------------------------------------------------- stories
  {
    name: "find_stories",
    description:
      "List newsroom stories with optional filters. Returns id, slug, title, editorial status, desk, author, assignee, word count, media count and whether any attached media has expired rights.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: STORY_STATUS_ENUM,
          description: "Filter by editorial status.",
        },
        desk: { type: "string", description: "Filter by desk, e.g. 'City Hall', 'Business', 'Tech', 'Climate', 'Sports', 'Culture'." },
        assignee: { type: "string", description: "Filter by desk editor assignment (exact name)." },
        query: { type: "string", description: "Free-text search across title, summary, body and author." },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Max stories to return (default 20)." },
      },
    },
    execute: async (input) =>
      run(async () => {
        const stories = await api.fetchStories({
          status: asString(input.status) ?? "any",
          desk: asString(input.desk) ?? "any",
          assignee: asString(input.assignee) ?? "any",
          query: asString(input.query),
        }).then((r) => r.stories);
        const limit =
          typeof input.limit === "number" && input.limit > 0
            ? Math.min(input.limit, 50)
            : 20;
        return ok({
          count: stories.length,
          shown: Math.min(stories.length, limit),
          stories: stories.slice(0, limit).map(storySummary),
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "get_story",
    description:
      "Get the full record of a single story: headline, standfirst, body, editorial status, assignment, timestamps and all attached media with their rights status.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string", description: "The story id." },
        slug: { type: "string", description: "Alternatively, the story slug (used when storyId is not known)." },
      },
      required: [],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = asString(input.storyId);
        const slug = asString(input.slug);
        if (!storyId && !slug) {
          throw new Error("Provide either 'storyId' or 'slug'.");
        }
        let story;
        if (storyId) {
          story = (await api.fetchStory(storyId)).story;
        } else {
          const all = (await api.fetchStories({ query: slug })).stories;
          story = all.find((s) => s.slug === slug);
          if (!story) throw new Error(`No story found with slug "${slug}".`);
        }
        return ok({ story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "create_story",
    description:
      "Create a new story in Draft status. Provide at least a title; summary, body and a publish deadline are recommended so the story can later pass publication validation.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 4, description: "Headline (4-140 characters)." },
        summary: { type: "string", description: "Standfirst/deck summary (30-300 characters for publish readiness)." },
        body: { type: "string", description: "Full body copy (at least 100 words for publish readiness)." },
        desk: { type: "string", enum: ["City Hall", "Business", "Tech", "Climate", "Sports", "Culture"] },
        author: { type: "string", description: "Byline author name. Defaults to 'Newsroom Staff'." },
        assignee: { type: "string", description: "Desk editor responsible for the story." },
        priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"] },
        scheduledFor: { type: "string", description: "Optional editorial publish deadline (ISO date, e.g. 2025-06-01)." },
      },
      required: ["title"],
    },
    execute: async (input) =>
      run(async () => {
        const story = await import("@/hooks/use-newsroom").then((m) =>
          m.useNewsroom.getState().createStory({
            title: requireString(input, "title"),
            summary: asString(input.summary),
            body: asString(input.body),
            desk: asString(input.desk),
            author: asString(input.author),
            assignee: asString(input.assignee) ?? null,
            priority: asString(input.priority),
            scheduledFor: asString(input.scheduledFor) ?? null,
          })
        );
        notifyDataChanged();
        return ok({ message: "Story created in Draft status.", storyId: story.id, story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "duplicate_story",
    description:
      "Pitch a follow-up: clone an existing story as a fresh Draft. Copies headline (suffixed with \"(Follow-up)\"), standfirst, body, desk, byline and priority; media, handoff history and the publish deadline start clean. Returns the new story.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string", description: "The id of the story to clone." },
      },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const story = await api.duplicateStoryRequest(storyId).then((r) => r.story);
        notifyDataChanged();
        return ok({
          message: `Follow-up story created in Draft status from ${storyId}.`,
          storyId: story.id,
          story,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "update_story",
    description:
      "Update editable fields of a story (title, summary, body, desk, assignee, priority, author, scheduledFor deadline). Published stories are locked. If an APPROVED story's copy (title/summary/body) changes, it is automatically reverted to Draft for re-review. All changes are recorded on the story's editorial timeline.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string", description: "The story id." },
        title: { type: "string", minLength: 4 },
        summary: { type: "string" },
        body: { type: "string" },
        desk: { type: "string", enum: ["City Hall", "Business", "Tech", "Climate", "Sports", "Culture"] },
        assignee: { type: "string", description: "Desk editor name, or empty string to unassign." },
        priority: { type: "string", enum: ["LOW", "NORMAL", "HIGH", "URGENT"] },
        author: { type: "string" },
        scheduledFor: { type: "string", description: "Editorial publish deadline as ISO date (e.g. 2025-06-01), or empty string to clear." },
      },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const patch: Record<string, unknown> = {};
        for (const key of ["title", "summary", "body", "desk", "assignee", "priority", "author", "scheduledFor"]) {
          if (key in input) {
            patch[key] =
              key === "scheduledFor" ? asString(input.scheduledFor) ?? null : input[key];
          }
        }
        if (Object.keys(patch).length === 0) {
          throw new Error("Provide at least one field to update.");
        }
        const story = await useNewsroom.getState().updateStoryFields(storyId, patch);
        notifyDataChanged();
        return ok({ message: "Story updated.", story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "update_story_status",
    description:
      "Move a story through the editorial workflow. Allowed transitions: Draft→In Review; In Review→Approved / Revision Requested / Draft; Revision Requested→In Review / Draft; Approved→In Review. Publishing is not allowed here — use prepare_web_handoff + execute_web_handoff.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        status: { type: "string", enum: STORY_STATUS_ENUM },
      },
      required: ["storyId", "status"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const status = requireString(input, "status");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story = await useNewsroom.getState().setStoryStatus(storyId, status);
        notifyDataChanged();
        return ok({ message: `Story status is now ${story.status}.`, story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "approve_story",
    description:
      "Approve a story that is currently In Review. Only In Review stories can be approved.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "string" } },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story = await useNewsroom.getState().approveStory(storyId);
        notifyDataChanged();
        return ok({ message: `Story "${story.title}" approved.`, story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "reorder_story",
    description:
      "Move a story within its current status column's run order (the editing priority inside that stage). Provide beforeStoryId to insert it immediately before another story in the same column, or position 'top'/'bottom'. The column is re-sequenced 1..n and the change is recorded on the story's timeline.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        beforeStoryId: {
          type: "string",
          description: "Insert before this story (must be in the same status column).",
        },
        position: {
          type: "string",
          enum: ["top", "bottom"],
          description: "Alternatively move to the top or bottom of the column (ignored when beforeStoryId is given).",
        },
      },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const beforeStoryId = asString(input.beforeStoryId) ?? null;
        const position =
          input.position === "top" || input.position === "bottom"
            ? (input.position as "top" | "bottom")
            : null;
        if (!beforeStoryId && !position) {
          throw new Error("Provide 'beforeStoryId' or position 'top'/'bottom'.");
        }
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story = await useNewsroom.getState().moveStoryRunOrder(storyId, {
          beforeStoryId,
          position,
        });
        notifyDataChanged();
        return ok({
          message: `Story is now at run-order position ${story.runOrder} in ${story.status}.`,
          runOrder: story.runOrder,
          story,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  // ------------------------------------------------------------------- media
  {
    name: "search_media",
    description:
      "Search the media vault. Filter by free-text query, license type, allowed channel or rights status. rightsStatus \"USABLE\" (default-friendly) returns every asset that can be published today: PERPETUAL or within its license window. Other statuses: VALID (dated license, not near expiry), EXPIRING_SOON, EXPIRED, PERPETUAL.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search across title, description, photographer and source." },
        licenseType: {
          type: "string",
          enum: ["Staff Original", "Rights-Managed", "Editorial Use Only", "Royalty-Free", "Creative Commons BY"],
        },
        channel: { type: "string", enum: ["web", "print", "social", "broadcast"] },
        rightsStatus: {
          type: "string",
          enum: ["USABLE", "VALID", "EXPIRING_SOON", "EXPIRED", "PERPETUAL"],
          description: "USABLE = publishable today (PERPETUAL or VALID).",
        },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
    execute: async (input) =>
      run(async () => {
        const requested = asString(input.rightsStatus) ?? "any";
        // "USABLE" is an agent-friendly umbrella: PERPETUAL + VALID. The API
        // filters on the exact computed status, so fetch unfiltered and apply
        // the umbrella here.
        const rightsStatus = requested === "USABLE" ? "any" : requested;
        const { media } = await api.fetchMedia({
          query: asString(input.query) ?? "",
          licenseType: asString(input.licenseType) ?? "any",
          channel: asString(input.channel) ?? "any",
          rightsStatus,
        });
        const usable =
          requested === "USABLE"
            ? media.filter((m) => m.rights.status === "VALID" || m.rights.status === "PERPETUAL")
            : media;
        const limit =
          typeof input.limit === "number" && input.limit > 0
            ? Math.min(input.limit, 50)
            : 20;
        return ok({
          count: usable.length,
          shown: Math.min(usable.length, limit),
          media: usable.slice(0, limit).map(mediaSummary),
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "get_media_metadata",
    description:
      "Get full metadata for one media asset: photographer, source, license type and notes, allowed channels, expiry, credit requirements, dimensions and which stories use it.",
    inputSchema: {
      type: "object",
      properties: { mediaId: { type: "string" } },
      required: ["mediaId"],
    },
    execute: async (input) =>
      run(async () => {
        const mediaId = requireString(input, "mediaId");
        const { media } = await api.fetchMediaAsset(mediaId);
        return ok({ media });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "check_media_rights",
    description:
      "Check licensing/rights for web publication. Pass mediaId for a single asset, or storyId to check every asset attached to a story. Reports expired licenses, channel restrictions and missing credits.",
    inputSchema: {
      type: "object",
      properties: {
        mediaId: { type: "string", description: "Check a single asset." },
        storyId: { type: "string", description: "Check all assets attached to this story." },
      },
      required: [],
    },
    execute: async (input) =>
      run(async () => {
        const mediaId = asString(input.mediaId);
        const storyId = asString(input.storyId);
        if (!mediaId && !storyId) {
          throw new Error("Provide 'mediaId' or 'storyId'.");
        }
        if (mediaId) {
          const { media } = await api.fetchMediaAsset(mediaId);
          const problems: string[] = [];
          if (media.rights.status === "EXPIRED") {
            problems.push(`License expired on ${media.rights.expiresAt?.slice(0, 10)}`);
          } else if (media.rights.status === "EXPIRING_SOON") {
            problems.push(`License expires in ${media.rights.daysUntilExpiry} day(s)`);
          }
          if (!media.rights.webAllowed) {
            problems.push(`Channel "web" not permitted (allowed: ${media.allowedChannels.join(", ") || "none"})`);
          }
          if (media.rights.creditRequired && !media.creditLine) {
            problems.push("Credit required but credit line is empty");
          }
          return ok({
            mediaId,
            title: media.title,
            usableForWeb: problems.length === 0,
            problems,
            rights: media.rights,
          });
        }
        const { story } = await api.fetchStory(storyId!);
        const reports = story.media.map((att) => {
          const r = att.media.rights;
          const problems: string[] = [];
          if (r.status === "EXPIRED") problems.push(`License expired on ${r.expiresAt?.slice(0, 10)}`);
          if (r.status === "EXPIRING_SOON") problems.push(`License expires in ${r.daysUntilExpiry} day(s)`);
          if (!r.webAllowed) problems.push("Channel \"web\" not permitted");
          if (r.creditRequired && !att.media.creditLine) problems.push("Credit line missing");
          return {
            mediaId: att.media.id,
            title: att.media.title,
            isPrimary: att.isPrimary,
            usableForWeb: problems.length === 0,
            problems,
            rights: r,
          };
        });
        return ok({
          storyId,
          storyTitle: story.title,
          allUsableForWeb: reports.every((r) => r.usableForWeb),
          reports,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "attach_media_to_story",
    description:
      "Attach a media asset to a story, with optional caption, alt text and primary (lead image) flag. The first attachment becomes primary automatically. Publication validation requires every attachment to carry alt text.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        mediaId: { type: "string" },
        caption: { type: "string", description: "Editorial caption shown with the image." },
        altText: {
          type: "string",
          description:
            "Text alternative for screen readers, delivered as the payload's alt attribute. Required before handoff.",
        },
        isPrimary: { type: "boolean", description: "Mark as the lead image (demotes other primaries)." },
      },
      required: ["storyId", "mediaId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const mediaId = requireString(input, "mediaId");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story = await useNewsroom.getState().attachMedia(storyId, mediaId, {
          caption: asString(input.caption) ?? null,
          altText: asString(input.altText) ?? null,
          // Explicit true forces lead; omitted defers to the auto-primary
          // rule ("the first attachment becomes primary automatically").
          isPrimary: input.isPrimary === true ? true : undefined,
        });
        notifyDataChanged();
        return ok({ message: "Media attached to story.", story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "detach_media_from_story",
    description:
      "Remove a media attachment from a story. If the removed asset was the primary image, the oldest remaining attachment is promoted.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        mediaId: { type: "string" },
      },
      required: ["storyId", "mediaId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const mediaId = requireString(input, "mediaId");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story = await useNewsroom.getState().detachMedia(storyId, mediaId);
        notifyDataChanged();
        return ok({ message: "Media detached from story.", story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "replace_story_media",
    description:
      "Replace an attached media asset in one action (e.g. swap an expired-rights image for a valid one). Detaches the old asset and attaches the new one, preserving caption and lead-image status; alt text resets because the image content changed — pass altText to set it in the same call. Returns the updated story.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        oldMediaId: { type: "string", description: "Currently attached asset to remove." },
        newMediaId: { type: "string", description: "Replacement asset (must not already be attached)." },
        caption: { type: "string", description: "Optional new caption; omitted keeps the existing caption." },
        altText: {
          type: "string",
          description: "Text alternative for the new image; omitted starts without one (handoff will flag it).",
        },
      },
      required: ["storyId", "oldMediaId", "newMediaId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const oldMediaId = requireString(input, "oldMediaId");
        const newMediaId = requireString(input, "newMediaId");
        const caption =
          typeof input.caption === "string" ? input.caption.trim() || null : undefined;
        const altText =
          typeof input.altText === "string" ? input.altText.trim() || null : undefined;
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story: StoryDTO = await useNewsroom
          .getState()
          .replaceMedia(storyId, oldMediaId, newMediaId, {
            ...(caption === undefined ? {} : { caption }),
            ...(altText === undefined ? {} : { altText }),
          });
        notifyDataChanged();
        return ok({ message: "Media replaced; caption and lead status preserved.", story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "register_media_asset",
    description:
      "Register a new media asset in the vault from an external image URL (agent-supplied or wire-service imagery). The image is referenced, not downloaded. Provide full licensing metadata — license type, allowed channels, expiry and credit line — so the Handoff Engine can gate publication on rights. Returns the created asset.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "http(s) URL of the image." },
        title: { type: "string", minLength: 3, description: "Vault title for the asset." },
        photographer: { type: "string", description: "Photographer or originating agency." },
        source: { type: "string", description: "Wire service / source name. Defaults to 'External wire'." },
        description: { type: "string", description: "What the image shows." },
        licenseType: {
          type: "string",
          enum: ["Staff Original", "Rights-Managed", "Editorial Use Only", "Royalty-Free", "Creative Commons BY"],
          description: "Defaults to 'Rights-Managed'.",
        },
        licenseNotes: { type: "string", description: "Free-form licensing notes/restrictions." },
        allowedChannels: {
          type: "array",
          items: { type: "string", enum: ["web", "print", "social", "broadcast"] },
          description: "Channels the license permits. Defaults to ['web'].",
        },
        expiresAt: { type: "string", description: "License expiry as ISO date (e.g. 2027-01-31); omit for perpetual rights." },
        creditRequired: { type: "boolean", description: "Whether attribution is mandatory (default true)." },
        creditLine: { type: "string", description: "The required credit line, e.g. 'Photo: K. Osei / Meridian'." },
        width: { type: "integer", description: "Image width in px, if known." },
        height: { type: "integer", description: "Image height in px, if known." },
      },
      required: ["url", "title", "photographer"],
    },
    execute: async (input) =>
      run(async () => {
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const channels = Array.isArray(input.allowedChannels)
          ? (input.allowedChannels as unknown[]).filter((c): c is string => typeof c === "string")
          : undefined;
        const media = await useNewsroom.getState().createMediaAsset({
          url: requireString(input, "url"),
          title: requireString(input, "title"),
          photographer: requireString(input, "photographer"),
          source: asString(input.source),
          description: asString(input.description),
          licenseType: asString(input.licenseType),
          licenseNotes: asString(input.licenseNotes),
          allowedChannels: channels,
          expiresAt: asString(input.expiresAt) ?? null,
          creditRequired:
            typeof input.creditRequired === "boolean" ? input.creditRequired : undefined,
          creditLine: asString(input.creditLine),
          width: typeof input.width === "number" ? input.width : undefined,
          height: typeof input.height === "number" ? input.height : undefined,
        });
        notifyDataChanged();
        return ok({
          message: `Asset "${media.title}" registered in the vault.`,
          mediaId: media.id,
          media,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "update_story_media",
    description:
      "Update an attachment's editorial fields on a story: caption, alt text (required for publication) and the lead-image flag. Only sent fields are changed; a caption/alt-only update never touches the lead flag.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        mediaId: { type: "string", description: "The attached media asset id." },
        caption: { type: "string", description: "Editorial caption; empty string clears it." },
        altText: {
          type: "string",
          description:
            "Text alternative for screen readers; empty string clears it. Publication validation requires one per attachment.",
        },
        isPrimary: { type: "boolean", description: "Explicitly set or unset the lead-image flag." },
      },
      required: ["storyId", "mediaId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const mediaId = requireString(input, "mediaId");
        const patch: { caption?: string | null; altText?: string | null; isPrimary?: boolean } = {};
        if (typeof input.caption === "string") patch.caption = input.caption.trim() || null;
        if (typeof input.altText === "string") patch.altText = input.altText.trim() || null;
        if (typeof input.isPrimary === "boolean") patch.isPrimary = input.isPrimary;
        if (Object.keys(patch).length === 0) {
          throw new Error("Provide at least one field to update (caption, altText, isPrimary).");
        }
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const story = await useNewsroom.getState().updateAttachment(storyId, mediaId, patch);
        notifyDataChanged();
        return ok({ message: "Attachment updated.", story });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "suggest_alt_text",
    description:
      "Get a deterministic alt-text suggestion for a story attachment (derived from the attachment caption, the asset description or the asset title, first sentence, max 140 chars). Use it before update_story_media to write a screen-reader-friendly alt — the same routine the editor-facing 'Suggest' button uses.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        mediaId: { type: "string", description: "The attached media asset id." },
      },
      required: ["storyId", "mediaId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const mediaId = requireString(input, "mediaId");
        const { suggestion, source } = await api.suggestAltTextRequest(storyId, mediaId);
        return ok({
          suggestion,
          source,
          message:
            "Deterministic suggestion — review it, then call update_story_media with altText to save it.",
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "renew_media_licenses",
    description:
      "Extend the license window of one or more dated media assets in a single action (bulk renewal). Sets a new expiry date for every given asset and records an optional renewal note in each asset's license notes. Typical use: renew every EXPIRING_SOON or EXPIRED asset found via search_media before a handoff.",
    inputSchema: {
      type: "object",
      properties: {
        mediaIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of the media assets to renew.",
        },
        expiresAt: {
          type: "string",
          description: "New license expiry date (ISO date string), e.g. '2027-09-02'.",
        },
        note: { type: "string", description: "Optional renewal note appended to each asset's license notes." },
      },
      required: ["mediaIds", "expiresAt"],
    },
    execute: async (input) =>
      run(async () => {
        const rawIds = Array.isArray(input.mediaIds) ? input.mediaIds : [];
        if (rawIds.length === 0) {
          throw new Error("mediaIds must be a non-empty array of media asset IDs.");
        }
        const mediaIds = rawIds.map(String);
        const expiresAt = requireString(input, "expiresAt");
        const note = typeof input.note === "string" ? input.note.trim() : undefined;
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const renewed = await useNewsroom.getState().bulkRenewLicenses({
          mediaIds,
          expiresAt,
          note: note || undefined,
        });
        notifyDataChanged();
        return ok({
          message: `Renewed ${renewed.length} license(s) through ${expiresAt.slice(0, 10)}.`,
          renewed: renewed.length,
          media: renewed,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "get_story_history",
    description:
      "Get the editorial timeline (audit trail) of a story: creation, status changes, edits, media attachments/replacements, deadline changes and handoffs, each with the actor and timestamp.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "string" } },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const events = await useNewsroom.getState().fetchTimeline(storyId);
        return ok({ storyId, count: events.length, events });
      }).catch((e: Error) => fail(e.message)),
  },

  // ----------------------------------------------------------------- handoff
  {
    name: "validate_publication",
    description:
      "Run full pre-publication validation for a story: approved status, editor assigned, headline/standfirst/body quality, media attached with primary set, licenses valid, web channel allowed, credits present and alt text on every attachment. Returns a checklist with pass/fail per requirement.",
    inputSchema: {
      type: "object",
      properties: { storyId: { type: "string" } },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const { useNewsroom } = await import("@/hooks/use-newsroom");
        const validation = await useNewsroom.getState().validatePublication(storyId);
        return ok({
          storyId,
          valid: validation.valid,
          failedCheckIds: validation.failedCheckIds,
          checks: validation.checks,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "prepare_web_handoff",
    description:
      "Generate the web publishing payload for a validated, approved story. Fails with the validation checklist when the story is not ready. Returns the payload plus a field-level diff against the previous prepared-but-undelivered draft (server-side memory), so callers can see exactly what a re-preparation changed. Review the payload before executing the handoff.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        requestedBy: { type: "string", description: "Identifier of the requester, e.g. 'editor-agent'." },
      },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const { payload, previous } = await api
          .prepareHandoffRequest(storyId)
          .catch(async (e: unknown) => {
            if (e instanceof api.ApiError && e.payload?.validation) {
              const validation = (
                e.payload as { validation: { checks: unknown[]; failedCheckIds: string[] } }
              ).validation;
              throw new Error(
                `Story is not ready for handoff. Failed checks: ${validation.failedCheckIds.join(", ")}. Run validate_publication for the full checklist.`
              );
            }
            throw e;
          });
        const diff = previous ? diffPayloads(previous.payload, payload) : [];
        return ok({
          message: previous
            ? `Payload generated. ${diff.length} field(s) differ from the previous draft ${previous.handoffRef}. Review it, then call execute_web_handoff.`
            : "Payload generated. Review it, then call execute_web_handoff.",
          payload,
          previousHandoffRef: previous?.handoffRef ?? null,
          changesSincePrevious: diff,
        });
      }).catch((e: Error) => fail(e.message)),
  },

  {
    name: "execute_web_handoff",
    description:
      "Perform the simulated web handoff: re-validates the story, delivers the payload to the (simulated) web CMS and marks the story Published. Blocked if validation fails.",
    inputSchema: {
      type: "object",
      properties: {
        storyId: { type: "string" },
        requestedBy: { type: "string", description: "Identifier of the requester, e.g. 'editor-agent'." },
      },
      required: ["storyId"],
    },
    execute: async (input) =>
      run(async () => {
        const storyId = requireString(input, "storyId");
        const { result } = await api.executeHandoffRequest(storyId);
        notifyDataChanged();
        if (!result.ok) {
          return {
            ok: false as const,
            status: "FAILED" as const,
            storyId,
            message: result.message,
            checks: result.checks,
          };
        }
        return ok({
          status: "SUCCESS" as const,
          handoffRef: result.handoffRef,
          deliveredAt: result.deliveredAt,
          previewUrl: result.previewUrl,
          message: result.message,
        });
      }).catch((e: Error) => fail(e.message)),
  },
];
// fast-refresh touch 1788351929
// touch 1788352703
