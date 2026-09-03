"use client";

import { useEffect, useState } from "react";
import { useNewsroom } from "@/hooks/use-newsroom";
import type { StoryEventDTO } from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDateTime, fmtRelative } from "./ui-primitives";
import {
  ArrowDownUp,
  CalendarClock,
  CheckCheck,
  FileText,
  History,
  ImagePlus,
  ImageOff,
  RefreshCcw,
  Rocket,
  Pencil,
} from "lucide-react";

const KIND_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; className: string; label: string }
> = {
  CREATED: { icon: FileText, className: "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800/80 dark:text-stone-300 dark:border-stone-600", label: "Created" },
  STATUS_CHANGED: { icon: RefreshCcw, className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800", label: "Workflow" },
  EDITED: { icon: Pencil, className: "bg-teal-50 text-teal-800 border-teal-200", label: "Edited" },
  MEDIA_ATTACHED: { icon: ImagePlus, className: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800", label: "Media" },
  MEDIA_DETACHED: { icon: ImageOff, className: "bg-orange-50 text-orange-800 border-orange-200", label: "Media" },
  MEDIA_REPLACED: { icon: RefreshCcw, className: "bg-violet-50 text-violet-800 border-violet-200", label: "Replaced" },
  DEADLINE_SET: { icon: CalendarClock, className: "bg-rose-50 text-rose-800 border-rose-200", label: "Deadline" },
  RUN_ORDER_CHANGED: { icon: ArrowDownUp, className: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800", label: "Run order" },
  HANDOFF_EXECUTED: { icon: Rocket, className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800", label: "Handoff" },
};

/**
 * Story-scoped editorial audit trail: every status change, edit, media
 * operation and handoff recorded by the business-logic layer — whether the
 * actor was a human editor or a WebMCP agent.
 */
export function StoryTimeline({ storyId }: { storyId: string }) {
  const stories = useNewsroom((s) => s.stories);
  const story = stories.find((s) => s.id === storyId);
  // Remount whenever the story changes, its fields update, OR its media
  // signature changes (attach/detach/replace don't bump story.updatedAt).
  const revisionKey = `${storyId}:${story?.updatedAt ?? ""}:${(story?.media ?? [])
    .map((m) => `${m.mediaId}:${m.attachedAt}:${m.isPrimary}`)
    .join("|")}`;
  return <StoryTimelineInner key={revisionKey} storyId={storyId} />;
}

function StoryTimelineInner({ storyId }: { storyId: string }) {
  const fetchTimeline = useNewsroom((s) => s.fetchTimeline);
  const [events, setEvents] = useState<StoryEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTimeline(storyId)
      .then((evs) => {
        if (!cancelled) setEvents(evs);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load timeline");
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, fetchTimeline]);

  return (
    <section aria-label="Editorial timeline" className="mt-5">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Editorial timeline
      </h4>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}

      {!error && events === null && (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {events && events.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </p>
      )}

      {events && events.length > 0 && (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {events.map((ev, idx) => {
            const meta = KIND_META[ev.kind] ?? KIND_META.EDITED;
            const Icon = meta.icon;
            const isAgent = ev.actor.startsWith("agent") || ev.actor.includes("agent") || ev.actor === "test-agent";
            return (
              <li key={ev.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[30px] top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border",
                    meta.className,
                    idx === 0 && "ring-2 ring-primary/20"
                  )}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div
                  className={cn(
                    "rounded-lg border bg-card px-3 py-2 transition-colors",
                    idx === 0 ? "border-primary/30" : "border-border"
                  )}
                >
                  <p className="text-sm leading-snug">{ev.message}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px font-medium",
                        isAgent ? "bg-violet-100 text-violet-700" : "bg-muted"
                      )}
                    >
                      {ev.actor}
                    </span>
                    <span title={fmtDateTime(ev.createdAt)}>{fmtRelative(ev.createdAt)}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
