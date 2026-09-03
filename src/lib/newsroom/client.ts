import type {
  HandoffDTO,
  HandoffResult,
  MediaAssetDTO,
  StoryDTO,
  StoryEventDTO,
  ValidationResult,
  WebHandoffPayload,
} from "./types";
import type { PreviousPayload } from "./handoff";

export class ApiError extends Error {
  status: number;
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: string }).error ?? `Request failed (${res.status})`,
      res.status,
      json
    );
  }
  return json as T;
}

/** Build a query string, skipping undefined/null/empty values. */
function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export function fetchStories(params: Record<string, string> = {}) {
  return request<{ stories: StoryDTO[]; count: number }>(
    `/api/stories${buildQuery(params)}`
  );
}

export function fetchStory(id: string) {
  return request<{ story: StoryDTO }>(`/api/stories/${id}`);
}

export function createStoryRequest(input: Record<string, unknown>) {
  return request<{ story: StoryDTO }>("/api/stories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateStoryRequest(id: string, input: Record<string, unknown>) {
  return request<{ story: StoryDTO }>(`/api/stories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function duplicateStoryRequest(id: string) {
  return request<{ story: StoryDTO }>(`/api/stories/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function reorderRunOrderRequest(
  id: string,
  opts: { beforeStoryId?: string | null; position?: "top" | "bottom" | null } = {}
) {
  return request<{ story: StoryDTO }>(`/api/stories/${id}/run-order`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export function attachMediaRequest(
  storyId: string,
  mediaId: string,
  opts: { caption?: string | null; altText?: string | null; isPrimary?: boolean } = {}
) {
  return request<{ story: StoryDTO }>(`/api/stories/${storyId}/media`, {
    method: "POST",
    body: JSON.stringify({ mediaId, ...opts }),
  });
}

export function detachMediaRequest(storyId: string, mediaId: string) {
  return request<{ story: StoryDTO }>(`/api/stories/${storyId}/media/${mediaId}`, {
    method: "DELETE",
  });
}

export function updateAttachmentRequest(
  storyId: string,
  mediaId: string,
  opts: { caption?: string | null; altText?: string | null; isPrimary?: boolean }
) {
  return request<{ story: StoryDTO }>(`/api/stories/${storyId}/media/${mediaId}`, {
    method: "PATCH",
    body: JSON.stringify(opts),
  });
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export function fetchMedia(params: Record<string, string> = {}) {
  return request<{ media: MediaAssetDTO[]; count: number }>(
    `/api/media${buildQuery(params)}`
  );
}

export function fetchStoryEvents(id: string) {
  return request<{ events: StoryEventDTO[]; count: number }>(
    `/api/stories/${id}/events`
  );
}

export function replaceMediaRequest(
  storyId: string,
  oldMediaId: string,
  newMediaId: string,
  opts: { caption?: string | null; altText?: string | null } = {}
) {
  return request<{ story: StoryDTO }>(`/api/stories/${storyId}/media/replace`, {
    method: "POST",
    body: JSON.stringify({ oldMediaId, newMediaId, ...opts }),
  });
}

export function fetchMediaAsset(id: string) {
  return request<{ media: MediaAssetDTO }>(`/api/media/${id}`);
}

export function createMediaAssetRequest(input: Record<string, unknown>) {
  return request<{ media: MediaAssetDTO }>("/api/media", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMediaAssetRequest(id: string, input: Record<string, unknown>) {
  return request<{ media: MediaAssetDTO }>(`/api/media/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function bulkRenewLicensesRequest(input: {
  mediaIds: string[];
  expiresAt: string;
  note?: string;
}) {
  return request<{ media: MediaAssetDTO[]; renewed: number }>("/api/media/bulk-renew", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---------------------------------------------------------------------------
// Handoff
// ---------------------------------------------------------------------------

export function validatePublicationRequest(storyId: string) {
  return request<{ validation: ValidationResult; storyTitle: string }>(
    "/api/handoff/validate",
    { method: "POST", body: JSON.stringify({ storyId }) }
  );
}

export function prepareHandoffRequest(storyId: string) {
  return request<{
    payload: WebHandoffPayload;
    validation: ValidationResult;
    previous: PreviousPayload | null;
  }>("/api/handoff/prepare", { method: "POST", body: JSON.stringify({ storyId }) });
}

export function executeHandoffRequest(storyId: string) {
  // A blocked handoff comes back as 409 with a structured result.
  return request<{ result: HandoffResult }>("/api/handoff/execute", {
    method: "POST",
    body: JSON.stringify({ storyId }),
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 409 && err.payload?.result) {
      return { result: (err.payload as { result: HandoffResult }).result };
    }
    throw err;
  });
}

export function fetchHandoffHistory() {
  return request<{ handoffs: HandoffDTO[]; count: number }>(
    "/api/handoff/history"
  );
}

export function fetchHandoffByRef(ref: string) {
  return request<{ handoff: HandoffDTO }>(
    `/api/handoff/${encodeURIComponent(ref)}`
  );
}

// ---------------------------------------------------------------------------
// Alt-text suggestion (deterministic, editor-in-the-loop)
// ---------------------------------------------------------------------------

export function suggestAltTextRequest(storyId: string, mediaId: string) {
  return request<{
    storyId: string;
    mediaId: string;
    suggestion: string;
    source: "caption" | "description" | "title";
  }>(
    `/api/stories/${storyId}/media/${mediaId}/suggest-alt`
  );
}
