"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNewsroom } from "@/hooks/use-newsroom";
import { useQueryParam } from "@/hooks/use-url-state";
import { DESKS, PRIORITIES, STORY_STATUSES, STATUS_TRANSITIONS, type StoryDTO } from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  CopyPlus,
  Eye,
  FileText,
  ImageIcon,
  Images,
  PenLine,
  Plus,
  Search,
  Send,
  Undo2,
  UserRound,
  X,
  ArrowRightLeft,
  ArrowDownUp,
  Clock3,
  Newspaper,
  KanbanSquare,
  LayoutList,
  Loader2,
} from "lucide-react";
import {
  ChannelChips,
  MediaImage,
  RightsBadge,
  StatusBadge,
  StatusDot,
  DeskDot,
  StatusStepper,
  STATUS_LABELS_UI,
  deadlineState,
  fmtRelative,
  fmtDateTime,
  fmtDate,
} from "./ui-primitives";
import { StoryTimeline } from "./story-timeline";
import { ReplaceMediaDialog } from "./replace-media-dialog";
import { ReaderPreviewDialog } from "./reader-preview";
import { AltTextDialog } from "./alt-text-dialog";

// ---------------------------------------------------------------------------
// Story Desk
// ---------------------------------------------------------------------------

export function StoryDesk({ onSendToHandoff }: { onSendToHandoff: (id: string) => void }) {
  const stories = useNewsroom((s) => s.stories);
  const loading = useNewsroom((s) => s.storiesLoading);
  // Desk layout + selection persist in the URL (?layout=&story=…) so views are
  // deep-linkable, survive reloads, and no longer reset when switching sections.
  const [layoutParam, setLayoutParam] = useQueryParam("layout", "list");
  const layout: "list" | "board" = layoutParam === "board" ? "board" : "list";
  const [storyParam, setStoryParam] = useQueryParam("story", "");
  // List ordering: most-recently-touched first, or the print run order
  // (stage by stage, runOrder within the stage — same sequence as the board).
  const [sortParam, setSortParam] = useQueryParam("sort", "recent");
  const sort: "recent" | "run-order" = sortParam === "run-order" ? "run-order" : "recent";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [deskFilter, setDeskFilter] = useState("any");
  const [assigneeFilter, setAssigneeFilter] = useState("any");
  const [newOpen, setNewOpen] = useState(false);
  const selectedId = storyParam || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter((s) => {
      if (statusFilter !== "any" && s.status !== statusFilter) return false;
      if (deskFilter !== "any" && s.desk !== deskFilter) return false;
      if (assigneeFilter !== "any" && (s.assignee ?? "") !== assigneeFilter) return false;
      if (q) {
        const hay = `${s.title} ${s.summary} ${s.author} ${s.assignee ?? ""} ${s.slug}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stories, query, statusFilter, deskFilter, assigneeFilter]);

  const assignees = useMemo(
    () =>
      Array.from(new Set(stories.map((s) => s.assignee).filter((a): a is string => Boolean(a)))).sort(),
    [stories]
  );

  const selected =
    (selectedId ? stories.find((s) => s.id === selectedId) : undefined) ??
    filtered[0] ??
    null;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { any: stories.length };
    for (const s of stories) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [stories]);

  // Run-order grouping: workflow stages in canonical order, each stage's
  // stories in runOrder sequence — the same ordering the board enforces.
  const runOrderGroups = useMemo(
    () =>
      STORY_STATUSES.map((status) => ({
        status,
        items: filtered
          .filter((s) => s.status === status)
          .sort((a, b) => a.runOrder - b.runOrder || b.updatedAt.localeCompare(a.updatedAt)),
      })).filter((g) => g.items.length > 0),
    [filtered]
  );

  // Print run queue: the approved stories in board run-order — the next
  // stories out of the door, shown as a summary strip above the desk.
  const printRun = useMemo(
    () =>
      stories
        .filter((s) => s.status === "APPROVED")
        .sort((a, b) => a.runOrder - b.runOrder || b.updatedAt.localeCompare(a.updatedAt)),
    [stories]
  );

  return (
    <div className="rise-in">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline text-2xl font-bold">Story Desk</h2>
          <p className="text-sm text-muted-foreground">
            Write, assign, review and move stories through the editorial workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* list ordering — only meaningful in list layout (the board is
              always run-order) */}
          {layout === "list" && (
            <div
              role="group"
              aria-label="List ordering"
              className="flex rounded-md border bg-card p-0.5 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setSortParam("recent")}
                aria-pressed={sort === "recent"}
                title="Most recently updated first"
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                  sort === "recent"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock3 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Recent</span>
              </button>
              <button
                type="button"
                onClick={() => setSortParam("run-order")}
                aria-pressed={sort === "run-order"}
                title="Print run order — stage by stage, like the board"
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                  sort === "run-order"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Run order</span>
              </button>
            </div>
          )}
          <div
            role="group"
            aria-label="Desk layout"
            className="flex rounded-md border bg-card p-0.5 shadow-sm"
          >
            <button
              type="button"
              onClick={() => setLayoutParam("list")}
              aria-pressed={layout === "list"}
              title="List view"
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                layout === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutParam("board")}
              aria-pressed={layout === "board"}
              title="Board view — stories grouped by workflow stage"
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                layout === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
          </div>
          <Button onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Story
          </Button>
        </div>
      </div>

      {printRun.length > 0 && (
        <PrintRunStrip
          queue={printRun}
          onOpen={(id) => {
            setStoryParam(id);
            setLayoutParam("list");
          }}
          onSendToHandoff={onSendToHandoff}
        />
      )}

      {layout === "board" ? (
        <StoryBoard
          stories={filtered}
          loading={loading && stories.length === 0}
          onOpen={(id) => {
            setStoryParam(id);
            setLayoutParam("list");
          }}
          onSendToHandoff={onSendToHandoff}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-5">
        {/* ------------------------------------------------------ list pane */}
        <section aria-label="Story list" className="min-w-0 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories…"
                className="pl-8"
                aria-label="Search stories"
              />
            </div>
            <Select value={deskFilter} onValueChange={setDeskFilter}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by desk">
                <SelectValue placeholder="All desks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All desks</SelectItem>
                {DESKS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger
                className="w-[132px]"
                aria-label="Filter by desk editor"
                title="Filter by desk editor"
              >
                <SelectValue placeholder="All editors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">All editors</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="scrollbar-slim mt-3 flex flex-wrap gap-1.5 pb-1">
            {[
              { id: "any", label: "All" },
              { id: "DRAFT", label: "Draft" },
              { id: "IN_REVIEW", label: "In Review" },
              { id: "REVISION_REQUESTED", label: "Revision" },
              { id: "APPROVED", label: "Approved" },
              { id: "PUBLISHED", label: "Published" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
                  statusFilter === st.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {st.label}
                <span className={cn("ml-1", statusFilter === st.id ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                  {statusCounts[st.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="scrollbar-slim mt-3 max-h-[calc(100vh-16rem)] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-19rem)]">
            {loading && stories.length === 0 && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <Skeleton className="h-14 w-20 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-4/5" />
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card/50 py-10 text-center">
                <FileText className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No stories match the current search and filters.
                </p>
                {(query || statusFilter !== "any" || deskFilter !== "any" || assigneeFilter !== "any") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("any");
                      setDeskFilter("any");
                      setAssigneeFilter("any");
                    }}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Clear filters
                  </Button>
                )}
              </div>
            )}
            {sort === "run-order"
              ? runOrderGroups.map((group) => (
                  <section key={group.status} aria-label={`${STATUS_LABELS_UI[group.status]} stage`}>
                    <header className="flex items-center gap-2 border-b border-border px-0.5 pb-1.5">
                      <StatusDot status={group.status} />
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">
                        {STATUS_LABELS_UI[group.status]}
                      </h3>
                      <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold leading-none text-muted-foreground">
                        {group.items.length}
                      </span>
                    </header>
                    <div className="mt-2 space-y-2">
                      {group.items.map((story, idx) => (
                        <StoryListItem
                          key={story.id}
                          story={story}
                          position={idx + 1}
                          active={story.id === selectedId}
                          onSelect={() => setStoryParam(story.id)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              : filtered.map((story) => (
                  <StoryListItem
                    key={story.id}
                    story={story}
                    active={story.id === selectedId}
                    onSelect={() => setStoryParam(story.id)}
                  />
                ))}
            {/* keep the selected card visible after deep-links / agent actions */}
            {selectedId && (
              <SelectedStoryScrollAnchor selectedId={selectedId} />
            )}
          </div>
          {sort === "run-order" && filtered.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowDownUp className="h-3 w-3" />
              Print run order — stage by stage, same sequence as the board.
              Re-sequence by dragging cards on the board.
            </p>
          )}
        </section>

        {/* ----------------------------------------------------- detail pane */}
        <section aria-label="Story detail" className="min-w-0 lg:col-span-3">
          {selected ? (
            <StoryDetail
              key={selected.id}
              story={selected}
              onSendToHandoff={onSendToHandoff}
              onDuplicated={setStoryParam}
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card/50 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Select a story from the desk, or create a new one.
              </p>
            </div>
          )}
        </section>
      </div>
      )}

      <NewStoryDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => setStoryParam(id)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print run strip — the approved queue in run order, at a glance
// ---------------------------------------------------------------------------

function PrintRunStrip({
  queue,
  onOpen,
  onSendToHandoff,
}: {
  queue: StoryDTO[];
  onOpen: (id: string) => void;
  onSendToHandoff: (id: string) => void;
}) {
  const maxShow = 5;
  const shown = queue.slice(0, maxShow);
  const rest = queue.length - shown.length;
  const withSchedule = queue.filter((s) => s.scheduledFor);
  const firstRun = withSchedule.length
    ? [...withSchedule].sort(
        (a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()
      )[0]
    : null;

  return (
    <section
      aria-label="Print run queue"
      className="print-run mb-5 overflow-hidden rounded-lg border bg-card shadow-sm"
    >
      <div className="flex items-stretch">
        {/* label rail */}
        <div className="hidden shrink-0 flex-col items-center justify-center gap-1 border-r bg-stone-900 px-3 py-3 text-center dark:bg-stone-950 sm:flex sm:w-24">
          <Newspaper className="h-4 w-4 text-stone-400" aria-hidden />
          <p className="font-headline text-[10px] font-bold uppercase leading-tight tracking-[0.2em] text-stone-200">
            Print
            <br />
            run
          </p>
          <p className="text-[9px] uppercase tracking-[0.14em] text-stone-500">
            {queue.length} queued
          </p>
        </div>

        <div className="min-w-0 flex-1">
          {/* strip header */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="sm:hidden">
                <Newspaper className="h-3.5 w-3.5" aria-hidden />
              </span>
              Next up on the run
            </h3>
            {firstRun?.scheduledFor && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <CalendarClock className="h-3 w-3" />
                First run {fmtDate(firstRun.scheduledFor)}
              </span>
            )}
            <span className="ml-auto hidden text-[11px] text-muted-foreground md:inline">
              Approved queue in board run-order — resequence on the board
            </span>
          </div>

          {/* queue cards */}
          <ol className="scrollbar-slim flex divide-x overflow-x-auto">
            {shown.map((s, i) => (
              <li key={s.id} className="min-w-0 flex-1 basis-44 shrink-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(s.id);
                    }
                  }}
                  className="group relative flex h-full cursor-pointer flex-col gap-1 px-3.5 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  aria-label={`Open ${s.title}`}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      aria-hidden
                      className="run-position-chip flex h-4.5 w-4.5 min-w-[18px] items-center justify-center rounded-full bg-stone-900 font-mono text-[9px] font-bold leading-none text-white dark:bg-stone-100 dark:text-stone-900"
                    >
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <DeskDot desk={s.desk} /> {s.desk}
                    </span>
                    {s.scheduledFor && (
                      <span
                        className={cn(
                          "ml-auto inline-flex shrink-0 items-center gap-0.5 pl-1 text-[10px] font-medium",
                          deadlineState(s.scheduledFor) === "past"
                            ? "text-red-700 dark:text-red-400"
                            : deadlineState(s.scheduledFor) === "soon"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                        )}
                      >
                        <CalendarClock className="h-3 w-3" /> {fmtDate(s.scheduledFor)}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 font-headline text-[13px] font-semibold leading-snug">
                    {s.title}
                  </span>
                  <span className="mt-auto flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {s.media.length} media · {s.wordCount}w
                    </span>
                    <button
                      type="button"
                      title={`Send “${s.title}” to the Handoff Engine`}
                      aria-label={`Send ${s.title} to the Handoff Engine`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToHandoff(s.id);
                      }}
                      className="ml-auto rounded-sm p-1 text-muted-foreground opacity-0 transition-all hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
            {rest > 0 && (
              <li
                aria-hidden
                className="flex w-12 shrink-0 items-center justify-center text-[11px] font-semibold text-muted-foreground"
              >
                +{rest}
              </li>
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

function StoryListItem({
  story,
  active,
  position,
  onSelect,
}: {
  story: StoryDTO;
  active: boolean;
  /** 1-based run-order position within the story's stage (run-order view). */
  position?: number;
  onSelect: () => void;
}) {
  const primary = story.media.find((m) => m.isPrimary) ?? story.media[0];
  const hasExpired = story.media.some((m) => m.media.rights.status === "EXPIRED");

  return (
    <button
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      data-story-id={story.id}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all active:scale-[0.99]",
        active
          ? "border-primary/60 bg-card shadow-[0_1px_0_0_var(--primary)] ring-1 ring-primary/40"
          : "border-border bg-card hover:border-foreground/25 hover:shadow-sm"
      )}
    >
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {primary ? (
          <MediaImage
            asset={primary.media}
            alt={primary.media.title}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
        {typeof position === "number" && (
          <span
            aria-hidden
            title={`Run order position ${position}`}
            className="absolute left-1 top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-stone-900/85 px-1 font-mono text-[9px] font-bold leading-none text-white shadow-sm dark:bg-stone-200/90 dark:text-stone-900"
          >
            {position}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-headline text-[15px] font-semibold leading-snug transition-colors group-hover:text-primary">
          {story.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={story.status} />
          {(story.priority === "HIGH" || story.priority === "URGENT") && (
            <Badge
              variant="outline"
              className={cn(
                "px-1.5 py-0 text-[10px] font-bold",
                story.priority === "URGENT"
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              )}
            >
              {story.priority}
            </Badge>
          )}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground/70">
            <DeskDot desk={story.desk} />
            {story.desk}
          </span>
          <span aria-hidden>·</span>
          <span>{story.author}</span>
          <span aria-hidden>·</span>
          <span>{fmtRelative(story.updatedAt)}</span>
          {hasExpired && (
            <span className="inline-flex items-center gap-0.5 font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> expired media
            </span>
          )}
          {story.scheduledFor &&
            story.status !== "PUBLISHED" &&
            deadlineState(story.scheduledFor) === "past" && (
              <span className="inline-flex items-center gap-0.5 font-medium text-red-700 dark:text-red-400">
                <CalendarClock className="h-3 w-3" /> past due
              </span>
            )}
          {story.scheduledFor &&
            story.status !== "PUBLISHED" &&
            deadlineState(story.scheduledFor) === "soon" && (
              <span className="inline-flex items-center gap-0.5 font-medium text-amber-700 dark:text-amber-400">
                <CalendarClock className="h-3 w-3" /> due soon
              </span>
            )}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Desk board — editorial run-order board, stories grouped by workflow stage.
// ---------------------------------------------------------------------------

const BOARD_QUICK_ACTION: Partial<
  Record<(typeof STORY_STATUSES)[number], { label: string; icon: React.ComponentType<{ className?: string }> }>
> = {
  DRAFT: { label: "Submit", icon: Eye },
  IN_REVIEW: { label: "Approve", icon: CheckCheck },
  REVISION_REQUESTED: { label: "Resubmit", icon: Eye },
  APPROVED: { label: "Handoff", icon: Send },
};

function StoryBoard({
  stories,
  loading,
  onOpen,
  onSendToHandoff,
}: {
  stories: StoryDTO[];
  loading: boolean;
  onOpen: (id: string) => void;
  onSendToHandoff: (id: string) => void;
}) {
  const setStoryStatus = useNewsroom((s) => s.setStoryStatus);
  const approveStory = useNewsroom((s) => s.approveStory);
  const moveStoryRunOrder = useNewsroom((s) => s.moveStoryRunOrder);
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  // Card currently hovered during a same-column reorder drag — draws the
  // insertion line above that card.
  const [overCardId, setOverCardId] = useState<string | null>(null);

  const dragStory = dragId ? (stories.find((s) => s.id === dragId) ?? null) : null;
  const legalTargets = dragStory ? (STATUS_TRANSITIONS[dragStory.status as (typeof STORY_STATUSES)[number]] ?? []) : [];

  const attemptMove = async (story: StoryDTO, target: string) => {
    if (story.status === target) return;
    const legal = (STATUS_TRANSITIONS[story.status as (typeof STORY_STATUSES)[number]] ?? []).includes(
      target as (typeof STORY_STATUSES)[number]
    );
    if (!legal) {
      toast({
        title: "Move not allowed",
        description: `${STATUS_LABELS_UI[story.status as (typeof STORY_STATUSES)[number]]} → ${STATUS_LABELS_UI[target as (typeof STORY_STATUSES)[number]]} is outside the workflow. Publishing goes through the Handoff Engine.`,
        variant: "destructive",
      });
      return;
    }
    setBusyId(story.id);
    try {
      if (target === "APPROVED") {
        await approveStory(story.id);
        toast({ title: "Story approved" });
      } else {
        await setStoryStatus(story.id, target);
        toast({ title: `Moved to ${STATUS_LABELS_UI[target as (typeof STORY_STATUSES)[number]]}` });
      }
    } catch (e) {
      toast({
        title: "Move failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  /** Same-column drop: place the dragged story at the end of that column. */
  const moveToBottom = async (story: StoryDTO) => {
    setBusyId(story.id);
    try {
      await moveStoryRunOrder(story.id, { position: "bottom" });
    } catch (e) {
      toast({
        title: "Reorder failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  /** Same-column drop on a card: insert the dragged story before that card. */
  const insertBefore = async (draggedId: string, beforeStoryId: string) => {
    if (draggedId === beforeStoryId) return;
    setBusyId(draggedId);
    try {
      await moveStoryRunOrder(draggedId, { beforeStoryId });
    } catch (e) {
      toast({
        title: "Reorder failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const runQuick = async (story: StoryDTO) => {
    setBusyId(story.id);
    try {
      if (story.status === "DRAFT") {
        await setStoryStatus(story.id, "IN_REVIEW");
        toast({ title: "Story submitted for review" });
      } else if (story.status === "IN_REVIEW") {
        await approveStory(story.id);
        toast({ title: "Story approved" });
      } else if (story.status === "REVISION_REQUESTED") {
        await setStoryStatus(story.id, "IN_REVIEW");
        toast({ title: "Resubmitted for review" });
      } else if (story.status === "APPROVED") {
        onSendToHandoff(story.id);
        return;
      }
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rise-in">
      <p className="mb-3 text-xs text-muted-foreground">
        Run-order board — the desk at a glance. Drag between stages (workflow rules apply),
        or drop a card onto another card in the same stage to re-sequence the run order.
        Click to open, or use the inline next step.
      </p>
      {loading ? (
        <div className="flex gap-3">
          {STORY_STATUSES.map((s) => (
            <div key={s} className="board-column w-[230px] shrink-0 space-y-2 pb-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="scrollbar-slim flex gap-3 overflow-x-auto pb-2">
          {STORY_STATUSES.map((status) => {
            // Run order: explicit position first, then recency.
            const column = stories
              .filter((s) => s.status === status)
              .sort(
                (a, b) =>
                  a.runOrder - b.runOrder ||
                  b.updatedAt.localeCompare(a.updatedAt)
              );
            const isSource = dragStory?.status === status;
            const isLegalTarget = legalTargets.includes(status);
            const isOver = overStatus === status;
            return (
              <section
                key={status}
                aria-label={`${STATUS_LABELS_UI[status]} column`}
                onDragOver={(e) => {
                  // Gate on the drag payload, not React state: dragstart may
                  // not have flushed state yet when the first dragover fires.
                  if (!e.dataTransfer.types.includes("text/plain")) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overStatus !== status) setOverStatus(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverStatus((s) => (s === status ? null : s));
                    setOverCardId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  const story = id ? stories.find((s) => s.id === id) : null;
                  setOverStatus(null);
                  setOverCardId(null);
                  setDragId(null);
                  if (!story) return;
                  if (story.status === status) {
                    // Dropped on the column (not a card) → send to the bottom.
                    void moveToBottom(story);
                  } else {
                    void attemptMove(story, status);
                  }
                }}
                className={cn(
                  "board-column w-[236px] shrink-0 rounded-b-lg transition-all sm:w-[252px]",
                  dragStory && isLegalTarget &&
                    "rounded-lg ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background",
                  dragStory && isLegalTarget && isOver && "bg-emerald-500/5",
                  dragStory && !isSource && !isLegalTarget && "opacity-45",
                  isSource && "opacity-90"
                )}
              >
                <header className="board-column-head flex items-center gap-2 px-1 pb-2 pt-1.5">
                  <StatusDot status={status} />
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">
                    {STATUS_LABELS_UI[status]}
                  </h3>
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold leading-none text-muted-foreground">
                    {column.length}
                  </span>
                </header>
                <div className="mt-2 min-h-[80px] space-y-2">
                  {column.map((story, idx) => (
                    <BoardCard
                      key={story.id}
                      story={story}
                      position={idx + 1}
                      busy={busyId === story.id}
                      dragging={dragId === story.id}
                      dropBefore={
                        !!dragStory &&
                        isSource &&
                        overCardId === story.id &&
                        dragId !== story.id
                      }
                      onDragStart={() => setDragId(story.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStatus(null);
                        setOverCardId(null);
                      }}
                      onCardDragOver={(e) => {
                        // Only intercept the pointer for same-column reorders;
                        // cross-column drops must bubble to the column handler.
                        if (!dragStory || dragStory.status !== status) return;
                        if (!e.dataTransfer.types.includes("text/plain")) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        if (overCardId !== story.id) setOverCardId(story.id);
                      }}
                      onCardDrop={(e) => {
                        if (!dragStory || dragStory.status !== status) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const id = e.dataTransfer.getData("text/plain") || dragId;
                        setOverCardId(null);
                        setDragId(null);
                        if (id && id !== story.id) void insertBefore(id, story.id);
                      }}
                      onOpen={() => onOpen(story.id)}
                      onQuick={() => void runQuick(story)}
                    />
                  ))}
                  {column.length === 0 && (
                    <div
                      className={cn(
                        "rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground/70 transition-colors",
                        dragStory && isLegalTarget && isOver &&
                          "border-emerald-500/60 text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      {dragStory && isLegalTarget
                        ? `Drop to move to ${STATUS_LABELS_UI[status]}`
                        : "Nothing here right now."}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BoardCard({
  story,
  position,
  busy,
  dragging,
  dropBefore,
  onDragStart,
  onDragEnd,
  onCardDragOver,
  onCardDrop,
  onOpen,
  onQuick,
}: {
  story: StoryDTO;
  /** 1-based position within the column (rendered as a run-order chip). */
  position: number;
  busy: boolean;
  dragging: boolean;
  /** True while another card is hovered above this one in a same-column drag. */
  dropBefore?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCardDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onCardDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onOpen: () => void;
  onQuick: () => void;
}) {
  const hasExpired = story.media.some((m) => m.media.rights.status === "EXPIRED");
  const deadline = deadlineState(story.scheduledFor);
  const quick = BOARD_QUICK_ACTION[story.status as (typeof STORY_STATUSES)[number]];

  return (
    <div
      draggable
      data-board-card={story.id}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", story.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={onCardDragOver}
      onDrop={onCardDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative cursor-grab rounded-lg border bg-card p-2.5 shadow-sm transition-all hover:shadow-md hover:border-foreground/25 active:cursor-grabbing active:scale-[0.99]",
        hasExpired && "border-red-300 dark:border-red-800/70",
        dragging && "opacity-40 ring-2 ring-primary/40",
        dropBefore &&
          "before:absolute before:-top-[7px] before:left-1 before:right-1 before:h-[3px] before:rounded-full before:bg-primary before:content-['']"
      )}
    >
      <span
        aria-hidden
        title={`Run order position ${position}`}
        className="absolute -left-1 -top-1 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-stone-900 px-1 font-mono text-[9px] font-bold leading-none text-white shadow-sm ring-1 ring-background dark:bg-stone-200 dark:text-stone-900"
      >
        {position}
      </span>
      <button onClick={onOpen} className="block w-full text-left" title="Open story in list view">
        <p className="line-clamp-2 font-headline text-[13px] font-semibold leading-snug transition-colors group-hover:text-primary">
          {story.title}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground/70">
            <DeskDot desk={story.desk} />
            {story.desk}
          </span>
          <span aria-hidden>·</span>
          <span>{story.author}</span>
          {(story.priority === "HIGH" || story.priority === "URGENT") && (
            <Badge
              variant="outline"
              className={cn(
                "px-1 py-0 text-[9px] font-bold",
                story.priority === "URGENT"
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              )}
            >
              {story.priority}
            </Badge>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/80">
          {story.media.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ImageIcon className="h-2.5 w-2.5" /> {story.media.length}
            </span>
          )}
          {hasExpired && (
            <span className="inline-flex items-center gap-0.5 font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="h-2.5 w-2.5" /> expired media
            </span>
          )}
          {story.scheduledFor && story.status !== "PUBLISHED" && deadline === "past" && (
            <span className="inline-flex items-center gap-0.5 font-medium text-red-700 dark:text-red-400">
              <CalendarClock className="h-2.5 w-2.5" /> past due
            </span>
          )}
          {story.scheduledFor && story.status !== "PUBLISHED" && deadline === "soon" && (
            <span className="inline-flex items-center gap-0.5 font-medium text-amber-700 dark:text-amber-400">
              <CalendarClock className="h-2.5 w-2.5" /> due soon
            </span>
          )}
          {story.scheduledFor && deadline === null && (
            <span
              className="inline-flex items-center gap-0.5 text-foreground/60"
              title={`Scheduled for ${fmtDate(story.scheduledFor)}`}
            >
              <CalendarClock className="h-2.5 w-2.5" /> {fmtDate(story.scheduledFor)}
            </span>
          )}
        </p>
      </button>
      {quick && (
        <div className="mt-2 border-t pt-2">
          <QuickActionButton story={story} quick={quick} busy={busy} onQuick={onQuick} />
        </div>
      )}
    </div>
  );
}

function QuickActionButton({
  story,
  quick,
  busy,
  onQuick,
}: {
  story: StoryDTO;
  quick: { label: string; icon: React.ComponentType<{ className?: string }> };
  busy: boolean;
  onQuick: () => void;
}) {
  const Icon = quick.icon;
  return (
    <Button
      size="sm"
      variant={story.status === "IN_REVIEW" ? "default" : "outline"}
      className={cn(
        "h-7 w-full gap-1 text-[11px]",
        story.status === "IN_REVIEW" && "bg-emerald-700 hover:bg-emerald-800"
      )}
      disabled={busy}
      onClick={onQuick}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {quick.label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function StoryDetail({
  story,
  onSendToHandoff,
  onDuplicated,
}: {
  story: StoryDTO;
  onSendToHandoff: (id: string) => void;
  onDuplicated: (id: string) => void;
}) {
  const { toast } = useToast();
  const setStoryStatus = useNewsroom((s) => s.setStoryStatus);
  const approveStory = useNewsroom((s) => s.approveStory);
  const duplicateStory = useNewsroom((s) => s.duplicateStory);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [replaceMediaId, setReplaceMediaId] = useState<string | null>(null);

  const deadline = deadlineState(story.scheduledFor);
  const deadlineOverdue =
    deadline === "past" && story.status !== "PUBLISHED";

  const runAction = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyAction(id);
    try {
      await fn();
      toast({ title: success });
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <article className="rise-in rounded-lg border bg-card">
      {/* header */}
      <div className="border-b p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={story.status} />
          <Badge variant="outline" className="gap-1.5 text-xs">
            <DeskDot desk={story.desk} />
            {story.desk} desk
          </Badge>
          {story.priority !== "NORMAL" && (
            <Badge variant="outline" className="text-xs">
              {story.priority}
            </Badge>
          )}
          {story.handoffCount > 0 && (
            <Badge variant="outline" className="gap-1 border-primary/40 text-[11px] text-primary">
              <Send className="h-3 w-3" /> {story.handoffCount} handoff(s)
            </Badge>
          )}
          {story.scheduledFor && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-[11px]",
                deadlineOverdue
                  ? "border-red-300 bg-red-50 font-medium text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
                  : deadline === "soon" && story.status !== "PUBLISHED"
                    ? "border-amber-300 bg-amber-50 font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    : "text-muted-foreground"
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {story.status !== "PUBLISHED" && deadline === "past"
                ? "past due "
                : story.status !== "PUBLISHED" && deadline === "soon"
                  ? "due soon "
                  : "target "}
              {fmtDate(story.scheduledFor)}
            </Badge>
          )}
        </div>

        <h3 className="mt-3 font-headline text-2xl font-bold leading-tight">
          {story.title}
        </h3>
        {story.summary && (
          <p className="mt-2 border-l-2 border-primary/50 pl-3 text-sm italic leading-relaxed text-muted-foreground">
            {story.summary}
          </p>
        )}

        {/* pipeline visual: where this story sits in the workflow */}
        <div className="mt-4 border-y border-dashed border-border/70 py-2.5">
          <StatusStepper status={story.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
          <Meta label="Byline" value={story.author} />
          <Meta label="Desk editor" value={story.assignee ?? "Unassigned"} warn={!story.assignee} />
          <Meta label="Slug" value={story.slug} mono />
          <Meta label="Words" value={`${story.wordCount.toLocaleString()} · ≈${Math.max(1, Math.round(story.wordCount / 220))} min read`} />
          <Meta label="Created" value={fmtDateTime(story.createdAt)} />
          <Meta label="Updated" value={fmtRelative(story.updatedAt)} />
          {story.publishedAt && <Meta label="Published" value={fmtDateTime(story.publishedAt)} />}
        </dl>
      </div>

      {/* workflow actions */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-5 py-3">
        {story.status === "DRAFT" && (
          <Button
            size="sm"
            disabled={busyAction !== null}
            onClick={() =>
              runAction(
                "submit",
                () => setStoryStatus(story.id, "IN_REVIEW"),
                "Story submitted for review"
              )
            }
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Submit for Review
          </Button>
        )}
        {story.status === "IN_REVIEW" && (
          <>
            <Button
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={busyAction !== null}
              onClick={() => runAction("approve", () => approveStory(story.id), "Story approved")}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction !== null}
              onClick={() =>
                runAction(
                  "revise",
                  () => setStoryStatus(story.id, "REVISION_REQUESTED"),
                  "Revision requested"
                )
              }
            >
              <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Request Revision
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyAction !== null}
              onClick={() => runAction("draft", () => setStoryStatus(story.id, "DRAFT"), "Sent back to Draft")}
            >
              <PenLine className="mr-1.5 h-3.5 w-3.5" /> Back to Draft
            </Button>
          </>
        )}
        {story.status === "REVISION_REQUESTED" && (
          <>
            <Button
              size="sm"
              disabled={busyAction !== null}
              onClick={() =>
                runAction("resubmit", () => setStoryStatus(story.id, "IN_REVIEW"), "Resubmitted for review")
              }
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Resubmit for Review
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyAction !== null}
              onClick={() => runAction("draft", () => setStoryStatus(story.id, "DRAFT"), "Sent back to Draft")}
            >
              <PenLine className="mr-1.5 h-3.5 w-3.5" /> Back to Draft
            </Button>
          </>
        )}
        {story.status === "APPROVED" && (
          <>
            <Button size="sm" className="gap-1.5" disabled={busyAction !== null} onClick={() => onSendToHandoff(story.id)}>
              <Send className="h-3.5 w-3.5" /> Take to Handoff
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction !== null}
              onClick={() => runAction("reopen", () => setStoryStatus(story.id, "IN_REVIEW"), "Review reopened")}
            >
              <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Reopen Review
            </Button>
          </>
        )}
        {story.status === "PUBLISHED" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4 text-primary" />
            Published to the web — handed off {fmtRelative(story.publishedAt ?? story.updatedAt)}.
          </p>
        )}

        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={busyAction !== null}
            title="Pitch a follow-up story from this one"
            onClick={async () => {
              setBusyAction("duplicate");
              try {
                const created = await duplicateStory(story.id);
                toast({
                  title: "Follow-up pitched",
                  description: `“${created.title}” created as a Draft on the ${created.desk} desk.`,
                });
                onDuplicated(created.id);
              } catch (e) {
                toast({
                  title: "Duplicate failed",
                  description: e instanceof Error ? e.message : "Unknown error",
                  variant: "destructive",
                });
              } finally {
                setBusyAction(null);
              }
            }}
          >
            <CopyPlus className="h-3.5 w-3.5" /> Follow-up
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setPreviewOpen(true)}
          >
            <Newspaper className="h-3.5 w-3.5" /> Reader Preview
          </Button>
          {story.status !== "PUBLISHED" && (
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
              <PenLine className="mr-1.5 h-3.5 w-3.5" />
              {editing ? "Close Editor" : "Edit Story"}
            </Button>
          )}
        </div>
      </div>

      {/* body */}
      <div className="p-5">
        {editing ? (
          <EditStoryForm
            story={story}
            onDone={() => setEditing(false)}
          />
        ) : (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Body copy
            </h4>
            <div className="max-h-72 space-y-3 overflow-y-auto scrollbar-slim pr-1 text-[15px] leading-relaxed">
              {story.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {!story.body && (
                <p className="text-sm italic text-muted-foreground">
                  No body copy yet — open the editor to start writing.
                </p>
              )}
            </div>
          </div>
        )}

        <Separator className="my-5" />

        {/* media */}
        <StoryMediaSection
          story={story}
          attachOpen={attachOpen}
          setAttachOpen={setAttachOpen}
          onReplace={(mediaId) => setReplaceMediaId(mediaId)}
        />

        <Separator className="my-5" />

        <StoryTimeline storyId={story.id} />
      </div>

      <ReaderPreviewDialog story={story} open={previewOpen} onOpenChange={setPreviewOpen} />
      {replaceMediaId && (
        <ReplaceMediaDialog
          story={story}
          mediaId={replaceMediaId}
          open={replaceMediaId !== null}
          onOpenChange={(v) => {
            if (!v) setReplaceMediaId(null);
          }}
        />
      )}
    </article>
  );
}

function Meta({
  label,
  value,
  mono,
  warn,
}: {
  label: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-medium", mono && "font-mono text-[11px]", warn && "text-amber-700 dark:text-amber-400")}>
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media section of the story detail
// ---------------------------------------------------------------------------

function StoryMediaSection({
  story,
  attachOpen,
  setAttachOpen,
  onReplace,
}: {
  story: StoryDTO;
  attachOpen: boolean;
  setAttachOpen: (v: boolean) => void;
  onReplace: (mediaId: string) => void;
}) {
  const { toast } = useToast();
  const detachMedia = useNewsroom((s) => s.detachMedia);
  const updateAttachment = useNewsroom((s) => s.updateAttachment);
  const [busy, setBusy] = useState<string | null>(null);
  const [altEditId, setAltEditId] = useState<string | null>(null);

  const altEditing = story.media.find((m) => m.mediaId === altEditId) ?? null;

  const doDetach = async (mediaId: string, title: string) => {
    setBusy(mediaId);
    try {
      await detachMedia(story.id, mediaId);
      toast({ title: `Removed "${title}" from the story` });
    } catch (e) {
      toast({
        title: "Could not remove media",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const makePrimary = async (mediaId: string) => {
    setBusy(mediaId);
    try {
      await updateAttachment(story.id, mediaId, { isPrimary: true });
      toast({ title: "Lead image updated" });
    } catch (e) {
      toast({
        title: "Could not set lead image",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Attached media">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Attached media ({story.media.length})
        </h4>
        {story.status !== "PUBLISHED" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAttachOpen(true)}>
            <Images className="h-3.5 w-3.5" /> Attach from Vault
          </Button>
        )}
      </div>

      {story.media.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
          <Images className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No media attached. Publication requires at least one cleared asset.
          </p>
          {story.status !== "PUBLISHED" && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAttachOpen(true)}>
              <Images className="h-3.5 w-3.5" /> Browse the Vault
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {story.media.map((att) => {
            const expired = att.media.rights.status === "EXPIRED";
            return (
              <div
                key={att.mediaId}
                className={cn(
                  "group flex gap-3 rounded-lg border p-2.5 transition-colors",
                  expired
                    ? "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/40"
                    : "bg-card hover:border-foreground/25"
                )}
              >
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                  <MediaImage
                    asset={att.media}
                    alt={att.altText || att.media.title}
                    fill
                    sizes="112px"
                    className={cn("object-cover", expired && "grayscale")}
                  />
                  {expired && (
                    <div className="absolute inset-0 expired-hatch" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {att.isPrimary && (
                      <Badge className="bg-primary px-1.5 py-0 text-[10px] text-primary-foreground">
                        Lead
                      </Badge>
                    )}
                    <RightsBadge status={att.media.rights.status} />
                    {!att.altText?.trim() && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        title="Screen readers and the web payload need a text alternative for this image"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" /> missing alt
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm font-medium">{att.media.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {att.caption || att.media.description}
                  </p>
                  {att.altText?.trim() && (
                    <p className="line-clamp-1 text-[11px] italic text-muted-foreground/90" title={att.altText}>
                      alt: {att.altText}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {att.media.photographer} · {att.media.licenseType}
                  </p>
                  {story.status !== "PUBLISHED" && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {!att.isPrimary && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          disabled={busy === att.mediaId}
                          onClick={() => makePrimary(att.mediaId)}
                        >
                          Make lead
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-6 gap-1 px-2 text-[11px]",
                          !att.altText?.trim() &&
                            "font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                        )}
                        onClick={() => setAltEditId(att.mediaId)}
                        title="Edit the text alternative for screen readers"
                      >
                        <PenLine className="h-3 w-3" /> Alt text
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-6 gap-1 px-2 text-[11px]",
                          expired ? "font-medium text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" : ""
                        )}
                        onClick={() => onReplace(att.mediaId)}
                        title="Swap this asset for a web-cleared replacement"
                      >
                        <ArrowRightLeft className="h-3 w-3" /> Replace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={busy === att.mediaId}
                        onClick={() => doDetach(att.mediaId, att.media.title)}
                      >
                        <X className="mr-0.5 h-3 w-3" /> Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AttachMediaDialog
        story={story}
        open={attachOpen}
        onOpenChange={setAttachOpen}
      />

      {altEditing && (
        <AltTextDialog
          storyId={story.id}
          attachment={altEditing}
          onClose={() => setAltEditId(null)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Attach media dialog
// ---------------------------------------------------------------------------

function AttachMediaDialog({
  story,
  open,
  onOpenChange,
}: {
  story: StoryDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const media = useNewsroom((s) => s.media);
  const attachMedia = useNewsroom((s) => s.attachMedia);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [altText, setAltText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attachedIds = useMemo(
    () => new Set(story.media.map((m) => m.mediaId)),
    [story.media]
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media
      .filter((m) => !attachedIds.has(m.id))
      .filter((m) => {
        if (!q) return true;
        return `${m.title} ${m.description} ${m.photographer} ${m.source}`.toLowerCase().includes(q);
      });
  }, [media, query, attachedIds]);

  const doAttach = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await attachMedia(story.id, selectedId, {
        caption: caption.trim() || null,
        altText: altText.trim() || null,
        isPrimary: story.media.length === 0,
      });
      toast({
        title: "Media attached to story",
        description: altText.trim()
          ? undefined
          : "Add alt text on the attachment card before handoff.",
      });
      onOpenChange(false);
      setCaption("");
      setAltText("");
      setSelectedId(null);
      setQuery("");
    } catch (e) {
      toast({
        title: "Could not attach media",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Attach media to story</DialogTitle>
          <DialogDescription>
            Pick an asset from the vault. Rights are re-checked automatically before publication.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the vault…"
            className="pl-8"
          />
        </div>

        <div className="scrollbar-slim grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {candidates.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={cn(
                "rounded-lg border p-1.5 text-left transition-all",
                selectedId === m.id
                  ? "border-primary ring-1 ring-primary/50"
                  : "hover:border-foreground/30"
              )}
            >
              <div className="relative aspect-[3/2] overflow-hidden rounded bg-muted">
                <MediaImage asset={m} alt={m.title} fill sizes="200px" className="object-cover" />
              </div>
              <p className="mt-1 line-clamp-1 text-xs font-medium">{m.title}</p>
              <div className="mt-1 flex items-center justify-between gap-1">
                <RightsBadge status={m.rights.status} label={m.rights.status === "PERPETUAL" ? "Perpetual" : undefined} />
              </div>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Every vault asset is already attached, or nothing matches.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption</Label>
          <Input
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Editorial caption shown with the image…"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attach-dialog-alt" className="flex items-center gap-1.5">
            Alt text
            <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              required for handoff
            </span>
          </Label>
          <Input
            id="attach-dialog-alt"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Describe the image for screen readers…"
          />
          <p className="text-[11px] text-muted-foreground">
            Publication validation checks this — you can also set it later on the attachment card.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={doAttach} disabled={!selectedId || busy}>
            {busy ? "Attaching…" : "Attach to Story"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------------------

function EditStoryForm({ story, onDone }: { story: StoryDTO; onDone: () => void }) {
  const updateStoryFields = useNewsroom((s) => s.updateStoryFields);
  const { toast } = useToast();
  const [title, setTitle] = useState(story.title);
  const [summary, setSummary] = useState(story.summary);
  const [body, setBody] = useState(story.body);
  const [desk, setDesk] = useState(story.desk);
  const [assignee, setAssignee] = useState(story.assignee ?? "");
  const [priority, setPriority] = useState(story.priority);
  const [deadline, setDeadline] = useState(
    story.scheduledFor ? story.scheduledFor.slice(0, 10) : ""
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updateStoryFields(story.id, {
        title,
        summary,
        body,
        desk,
        assignee,
        priority,
        scheduledFor: deadline ? new Date(`${deadline}T12:00:00`).toISOString() : null,
      });
      if (story.status === "APPROVED" && updated.status === "DRAFT") {
        toast({
          title: "Story saved — reverted to Draft",
          description:
            "Approval applies to the version that was reviewed. Approved copy changed, so the story must be re-approved before handoff.",
        });
      } else {
        toast({ title: "Story saved" });
      }
      onDone();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-title">Headline</Label>
        <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-summary">Standfirst / summary</Label>
        <Textarea id="edit-summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-body">Body</Label>
        <Textarea
          id="edit-body"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-serif text-[15px] leading-relaxed"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Desk</Label>
          <Select value={desk} onValueChange={setDesk}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESKS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-assignee">Desk editor</Label>
          <div className="relative">
            <UserRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="edit-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Unassigned"
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-deadline">Publish deadline</Label>
          <Input
            id="edit-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New story dialog
// ---------------------------------------------------------------------------

function NewStoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const createStory = useNewsroom((s) => s.createStory);
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [desk, setDesk] = useState<string>("City Hall");
  const [author, setAuthor] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const story = await createStory({
        title,
        desk,
        author: author || undefined,
        priority,
        scheduledFor: deadline ? new Date(`${deadline}T12:00:00`).toISOString() : null,
      });
      toast({ title: "Story created in Draft" });
      onCreated(story.id);
      onOpenChange(false);
      setTitle("");
      setAuthor("");
      setPriority("NORMAL");
      setDeadline("");
      setDesk("City Hall");
    } catch (e) {
      toast({
        title: "Could not create story",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">New story</DialogTitle>
          <DialogDescription>
            Starts as a Draft on the selected desk. Add body copy in the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-title">Headline *</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Council Committee Advances Stadium Financing Plan"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Desk</Label>
              <Select value={desk} onValueChange={setDesk}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESKS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-author">Author / byline</Label>
            <Input
              id="new-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Newsroom Staff"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-deadline">Publish deadline (optional)</Label>
            <Input
              id="new-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={title.trim().length < 4 || busy}>
            {busy ? "Creating…" : "Create Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Scroll anchor — nudges the selected story card into view when the selection
// arrives from a deep link, the vault cross-links or an agent action.
// ---------------------------------------------------------------------------

function SelectedStoryScrollAnchor({ selectedId }: { selectedId: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLButtonElement>(
        `section[aria-label="Story list"] button[data-story-id="${selectedId}"]`
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedId]);
  return null;
}
