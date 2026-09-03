import { db } from "@/lib/db";

/**
 * Story-scoped editorial audit trail. Every meaningful mutation performed
 * through the business logic layer — by the UI or by a WebMCP agent — is
 * recorded here, so the Story Desk timeline shows the full editorial journey
 * of a story regardless of who acted on it.
 */

export type StoryEventKind =
  | "CREATED"
  | "STATUS_CHANGED"
  | "EDITED"
  | "MEDIA_ATTACHED"
  | "MEDIA_DETACHED"
  | "MEDIA_REPLACED"
  | "DEADLINE_SET"
  | "RUN_ORDER_CHANGED"
  | "HANDOFF_EXECUTED";

export interface StoryEventDTO {
  id: string;
  kind: StoryEventKind;
  message: string;
  actor: string;
  createdAt: string;
}

export async function recordStoryEvent(input: {
  storyId: string;
  kind: StoryEventKind;
  message: string;
  actor?: string;
}): Promise<void> {
  try {
    await db.storyEvent.create({
      data: {
        storyId: input.storyId,
        kind: input.kind,
        message: input.message,
        actor: input.actor?.trim() || "newsroom-ui",
      },
    });
  } catch (e) {
    // The timeline is an enhancement: never let logging break a mutation.
    console.error("recordStoryEvent failed", e);
  }
}

export async function listStoryEvents(
  storyId: string,
  limit = 50
): Promise<StoryEventDTO[]> {
  const events = await db.storyEvent.findMany({
    where: { storyId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return events.map((e) => ({
    id: e.id,
    kind: e.kind as StoryEventKind,
    message: e.message,
    actor: e.actor,
    createdAt: e.createdAt.toISOString(),
  }));
}

/** Human-friendly actor labels for API-originated actions. */
export function actorFromRequest(requested?: unknown, fallback = "newsroom-ui"): string {
  if (typeof requested === "string" && requested.trim()) return requested.trim();
  return fallback;
}
