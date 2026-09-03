"use client";

import { create } from "zustand";
import * as api from "@/lib/newsroom/client";
import type { PreviousPayload } from "@/lib/newsroom/handoff";
import type {
  HandoffDTO,
  HandoffResult,
  MediaAssetDTO,
  StoryDTO,
  StoryEventDTO,
  ValidationResult,
  WebHandoffPayload,
} from "@/lib/newsroom/types";

/**
 * Single client-side source of truth. Every view (Story Desk, Media Vault,
 * Handoff Engine) and the WebMCP-driven refresh cycle read from this store;
 * all mutations go through the same REST endpoints that external agents use.
 */

interface NewsroomState {
  stories: StoryDTO[];
  media: MediaAssetDTO[];
  handoffs: HandoffDTO[];
  storiesLoading: boolean;
  mediaLoading: boolean;
  handoffsLoading: boolean;
  lastError: string | null;

  refreshStories: () => Promise<void>;
  refreshMedia: () => Promise<void>;
  refreshHandoffs: () => Promise<void>;
  refreshAll: () => Promise<void>;

  createStory: (input: {
    title: string;
    summary?: string;
    body?: string;
    desk?: string;
    author?: string;
    priority?: string;
    assignee?: string | null;
    scheduledFor?: string | null;
  }) => Promise<StoryDTO>;

  updateStoryFields: (
    id: string,
    input: Record<string, unknown>
  ) => Promise<StoryDTO>;

  duplicateStory: (id: string) => Promise<StoryDTO>;
  setStoryStatus: (id: string, status: string) => Promise<StoryDTO>;
  approveStory: (id: string) => Promise<StoryDTO>;
  moveStoryRunOrder: (
    id: string,
    opts: { beforeStoryId?: string | null; position?: "top" | "bottom" | null }
  ) => Promise<StoryDTO>;

  attachMedia: (
    storyId: string,
    mediaId: string,
    opts?: { caption?: string | null; altText?: string | null; isPrimary?: boolean }
  ) => Promise<StoryDTO>;

  detachMedia: (storyId: string, mediaId: string) => Promise<StoryDTO>;

  updateAttachment: (
    storyId: string,
    mediaId: string,
    opts: { caption?: string | null; altText?: string | null; isPrimary?: boolean }
  ) => Promise<StoryDTO>;

  validatePublication: (storyId: string) => Promise<ValidationResult>;
  prepareHandoff: (
    storyId: string
  ) => Promise<{ payload: WebHandoffPayload; previous: PreviousPayload | null }>;
  executeHandoff: (storyId: string) => Promise<HandoffResult>;

  replaceMedia: (
    storyId: string,
    oldMediaId: string,
    newMediaId: string,
    opts?: { caption?: string | null; altText?: string | null }
  ) => Promise<StoryDTO>;

  createMediaAsset: (input: Record<string, unknown>) => Promise<MediaAssetDTO>;

  updateMediaAsset: (
    id: string,
    input: Record<string, unknown>
  ) => Promise<MediaAssetDTO>;

  bulkRenewLicenses: (input: {
    mediaIds: string[];
    expiresAt: string;
    note?: string;
  }) => Promise<MediaAssetDTO[]>;

  fetchTimeline: (storyId: string) => Promise<StoryEventDTO[]>;
}

export const useNewsroom = create<NewsroomState>((set, get) => ({
  stories: [],
  media: [],
  handoffs: [],
  storiesLoading: false,
  mediaLoading: false,
  handoffsLoading: false,
  lastError: null,

  refreshStories: async () => {
    set({ storiesLoading: true });
    try {
      const { stories } = await api.fetchStories();
      set({ stories, storiesLoading: false, lastError: null });
    } catch (e) {
      set({
        storiesLoading: false,
        lastError: e instanceof Error ? e.message : "Failed to load stories",
      });
    }
  },

  refreshMedia: async () => {
    set({ mediaLoading: true });
    try {
      const { media } = await api.fetchMedia();
      set({ media, mediaLoading: false, lastError: null });
    } catch (e) {
      set({
        mediaLoading: false,
        lastError: e instanceof Error ? e.message : "Failed to load media",
      });
    }
  },

  refreshHandoffs: async () => {
    set({ handoffsLoading: true });
    try {
      const { handoffs } = await api.fetchHandoffHistory();
      set({ handoffs, handoffsLoading: false });
    } catch (e) {
      set({
        handoffsLoading: false,
        lastError: e instanceof Error ? e.message : "Failed to load handoffs",
      });
    }
  },

  refreshAll: async () => {
    await Promise.all([
      get().refreshStories(),
      get().refreshMedia(),
      get().refreshHandoffs(),
    ]);
  },

  createStory: async (input) => {
    const { story } = await api.createStoryRequest(input);
    await get().refreshStories();
    return story;
  },

  updateStoryFields: async (id, input) => {
    const { story } = await api.updateStoryRequest(id, input);
    await get().refreshStories();
    return story;
  },

  duplicateStory: async (id) => {
    const { story } = await api.duplicateStoryRequest(id);
    await get().refreshStories();
    return story;
  },

  setStoryStatus: async (id, status) => {
    const { story } = await api.updateStoryRequest(id, { status });
    await get().refreshStories();
    return story;
  },

  approveStory: async (id) => {
    const { story } = await api.updateStoryRequest(id, { action: "approve" });
    await get().refreshStories();
    return story;
  },

  moveStoryRunOrder: async (id, opts) => {
    const { story } = await api.reorderRunOrderRequest(id, opts);
    await get().refreshStories();
    return story;
  },

  attachMedia: async (storyId, mediaId, opts = {}) => {
    const { story } = await api.attachMediaRequest(storyId, mediaId, opts);
    await Promise.all([get().refreshStories(), get().refreshMedia()]);
    return story;
  },

  detachMedia: async (storyId, mediaId) => {
    const { story } = await api.detachMediaRequest(storyId, mediaId);
    await Promise.all([get().refreshStories(), get().refreshMedia()]);
    return story;
  },

  updateAttachment: async (storyId, mediaId, opts) => {
    const { story } = await api.updateAttachmentRequest(storyId, mediaId, opts);
    await get().refreshStories();
    return story;
  },

  validatePublication: async (storyId) => {
    const { validation } = await api.validatePublicationRequest(storyId);
    return validation;
  },

  prepareHandoff: async (storyId) => {
    const { payload, previous } = await api.prepareHandoffRequest(storyId);
    return { payload, previous };
  },

  executeHandoff: async (storyId) => {
    const { result } = await api.executeHandoffRequest(storyId);
    await Promise.all([get().refreshStories(), get().refreshHandoffs()]);
    return result;
  },

  replaceMedia: async (storyId, oldMediaId, newMediaId, opts = {}) => {
    const { story } = await api.replaceMediaRequest(storyId, oldMediaId, newMediaId, opts);
    await Promise.all([get().refreshStories(), get().refreshMedia()]);
    return story;
  },

  createMediaAsset: async (input) => {
    const { media } = await api.createMediaAssetRequest(input);
    await get().refreshMedia();
    return media;
  },

  updateMediaAsset: async (id, input) => {
    const { media } = await api.updateMediaAssetRequest(id, input);
    await Promise.all([get().refreshMedia(), get().refreshStories()]);
    return media;
  },

  bulkRenewLicenses: async (input) => {
    const { media } = await api.bulkRenewLicensesRequest(input);
    await Promise.all([get().refreshMedia(), get().refreshStories()]);
    return media;
  },

  fetchTimeline: async (storyId) => {
    const { events } = await api.fetchStoryEvents(storyId);
    return events;
  },
}));
