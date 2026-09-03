// ---------------------------------------------------------------------------
// Shared domain types for the Meridian Ledger newsroom.
// Business logic (src/lib/newsroom/*), the REST API and the WebMCP tools all
// speak this exact language, so agent actions and human actions mutate the
// same state through the same rules.
// ---------------------------------------------------------------------------

export const STORY_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "PUBLISHED",
] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export const DESKS = [
  "City Hall",
  "Business",
  "Tech",
  "Climate",
  "Sports",
  "Culture",
] as const;
export type Desk = (typeof DESKS)[number];

export const CHANNELS = ["web", "print", "social", "broadcast"] as const;
export type Channel = (typeof CHANNELS)[number];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const LICENSE_TYPES = [
  "Staff Original",
  "Rights-Managed",
  "Editorial Use Only",
  "Royalty-Free",
  "Creative Commons BY",
] as const;

export type RightsStatus = "PERPETUAL" | "VALID" | "EXPIRING_SOON" | "EXPIRED";

export interface MediaRights {
  status: RightsStatus;
  webAllowed: boolean;
  allowedChannels: Channel[];
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  licenseType: string;
  licenseNotes: string;
  creditRequired: boolean;
  creditLine: string;
}

export interface MediaAssetDTO {
  id: string;
  fileName: string;
  url: string;
  /** Absolute external URL when the asset was registered by URL; null for local files. */
  externalUrl: string | null;
  title: string;
  description: string;
  photographer: string;
  source: string;
  licenseType: string;
  licenseNotes: string;
  allowedChannels: Channel[];
  expiresAt: string | null;
  creditRequired: boolean;
  creditLine: string;
  width: number | null;
  height: number | null;
  format: string;
  sizeKb: number;
  createdAt: string;
  rights: MediaRights;
  attachedToCount: number;
  attachedStoryTitles: string[];
}

export interface StoryAttachmentDTO {
  mediaId: string;
  isPrimary: boolean;
  caption: string | null;
  altText: string | null;
  attachedAt: string;
  media: MediaAssetDTO;
}

export interface StoryDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  status: StoryStatus;
  desk: string;
  author: string;
  assignee: string | null;
  priority: string;
  scheduledFor: string | null;
  /** Position within the status column on the run-order board (lower = higher). */
  runOrder: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  wordCount: number;
  media: StoryAttachmentDTO[];
  handoffCount: number;
}

export interface HandoffDTO {
  id: string;
  handoffRef: string;
  storyId: string;
  storyTitle: string;
  status: string;
  target: string;
  payload: Record<string, unknown>;
  issues: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Editorial status transitions. Note: APPROVED -> PUBLISHED is intentionally
// NOT allowed here; publishing must go through the Handoff Engine so that a
// payload is generated and media rights are re-checked at delivery time.
// ---------------------------------------------------------------------------

export const STATUS_TRANSITIONS: Record<StoryStatus, StoryStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REVISION_REQUESTED", "DRAFT"],
  REVISION_REQUESTED: ["IN_REVIEW", "DRAFT"],
  APPROVED: ["IN_REVIEW"],
  PUBLISHED: [],
};

export const STATUS_LABELS: Record<StoryStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  REVISION_REQUESTED: "Revision Requested",
  APPROVED: "Approved",
  PUBLISHED: "Published",
};

// ---------------------------------------------------------------------------
// Handoff validation
// ---------------------------------------------------------------------------

export type CheckStatus = "pass" | "fail";

export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ValidationResult {
  storyId: string;
  valid: boolean;
  checks: ValidationCheck[];
  failedCheckIds: string[];
}

export interface WebHandoffPayload {
  handoffType: "web-publish";
  handoffRef: string;
  generatedAt: string;
  sourceSystem: string;
  story: {
    id: string;
    slug: string;
    headline: string;
    standfirst: string;
    body: string;
    byline: string;
    desk: string;
    priority: string;
    wordCount: number;
    scheduledFor: string | null;
  };
  media: Array<{
    id: string;
    fileName: string;
    url: string;
    role: "primary" | "supporting";
    alt: string;
    caption: string | null;
    credit: string;
    license: string;
    width: number | null;
    height: number | null;
    format: string;
  }>;
  seo: {
    slug: string;
    metaDescription: string;
  };
  delivery: {
    target: string;
    channel: "web";
    requestedBy: string;
  };
}

export interface CreateMediaAssetInput {
  url: string;
  title: string;
  description?: string;
  photographer: string;
  source?: string;
  licenseType?: string;
  licenseNotes?: string;
  allowedChannels?: Channel[];
  expiresAt?: string | null;
  creditRequired?: boolean;
  creditLine?: string;
  width?: number | null;
  height?: number | null;
  format?: string;
}

export interface HandoffResult {
  ok: boolean;
  handoffRef?: string;
  storyId: string;
  status: "SUCCESS" | "FAILED";
  deliveredAt?: string;
  previewUrl?: string;
  message: string;
  checks?: ValidationCheck[];
}
