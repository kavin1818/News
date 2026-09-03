"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useNewsroom } from "@/hooks/use-newsroom";
import { useQueryParam } from "@/hooks/use-url-state";
import { StoryDesk } from "./story-desk";
import { MediaVault } from "./media-vault";
import { HandoffEngine } from "./handoff-engine";
import { HandoffReceiptDialog } from "./handoff-receipt";
import { WebMCPBridge } from "./webmcp-provider";
import { CommandPalette } from "./command-palette";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Check, Copy, FileText, Images, Moon, Search, Send, Sun } from "lucide-react";

type View = "desk" | "vault" | "handoff";

const VIEW_ORDER: View[] = ["desk", "vault", "handoff"];

const subscribeNoop = () => () => {};

export function NewsroomApp() {
  // The active section lives in the URL (?view=…) so any desk combination is
  // deep-linkable and survives reloads; defaults to the Story Desk.
  const [viewParam, setViewParam] = useQueryParam("view", "desk");
  const view = (VIEW_ORDER as string[]).includes(viewParam) ? (viewParam as View) : "desk";
  const setView = (v: View) => setViewParam(v);
  const [handoffStoryId, setHandoffStoryId] = useState<string | null>(null);
  // Command palette (Ctrl/Cmd+K): navigation, jump-to-story/media, actions.
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Story selection is URL-backed, so the palette / handoff can deep-link into
  // the Story Desk detail pane.
  const [, setStoryParam] = useQueryParam("story", "");
  // A delivered handoff can be reopened as a printable receipt via
  // ?receipt=<ref> — every receipt is shareable by URL.
  const [receiptParam, setReceiptParam] = useQueryParam("receipt", "");
  const receiptRef = receiptParam || null;
  // Render the data-driven panes only after mount: every pane is populated
  // from client-side state, so gating removes any SSR/client tree drift
  // (e.g. Radix Select ids) and gives us a proper editorial loading state.
  // useSyncExternalStore is the hydration-safe way to detect "client now".
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  const stories = useNewsroom((s) => s.stories);
  const media = useNewsroom((s) => s.media);
  const refreshAll = useNewsroom((s) => s.refreshAll);

  // Rendered per paint; date text is hydration-stable for the day granularity.
  const today = new Date();

  // Initial load + live refresh when WebMCP tools (or anything else) mutate
  // the shared backend state.
  useEffect(() => {
    void useNewsroom.getState().refreshAll();
    const onDataChanged = () => void useNewsroom.getState().refreshAll();
    window.addEventListener("newsroom:data-changed", onDataChanged);
    return () => window.removeEventListener("newsroom:data-changed", onDataChanged);
  }, []);

  // Keyboard shortcuts: 1/2/3 switch sections, "/" jumps to story search.
  // Ignored while typing, with modifiers held, or when a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const editable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "/" && !editable) {
        e.preventDefault();
        setView("desk");
        window.setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('input[aria-label="Search stories"]');
          input?.focus();
        }, 60);
        return;
      }
      if (editable) return;
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx >= 0) setView(VIEW_ORDER[idx]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl/Cmd+K opens the command palette (works even while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const readyToHandoff = stories.filter((s) => s.status === "APPROVED").length;
  const expiredAssets = media.filter((m) => m.rights.status === "EXPIRED").length;

  const tabs: Array<{
    id: View;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    countTitle?: string;
  }> = [
    { id: "desk", label: "Story Desk", shortLabel: "Desk", icon: FileText, count: stories.length, countTitle: "stories in play" },
    {
      id: "vault",
      label: "Media Vault",
      shortLabel: "Vault",
      icon: Images,
      count: media.length,
      countTitle: `${expiredAssets} expired`,
    },
    {
      id: "handoff",
      label: "Handoff Engine",
      shortLabel: "Handoff",
      icon: Send,
      count: readyToHandoff,
      countTitle: "approved & ready",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* ------------------------------------------------------- top strip */}
      <div className="border-b border-stone-800/60 bg-stone-900 text-stone-300 dark:bg-stone-950">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-1.5 text-[11px] tracking-wide sm:px-6 lg:px-8">
          <span suppressHydrationWarning>{format(today, "EEEE · MMMM d, yyyy")}</span>
          <span className="flex items-center gap-3">
            <span className="uppercase tracking-[0.18em]">Metro Edition</span>
            <span className="hidden sm:inline text-stone-500">|</span>
            <span className="hidden sm:inline uppercase tracking-[0.18em] text-stone-400">
              Internal Newsroom Portal
            </span>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              title="Command palette (Ctrl+K)"
              className="hidden h-6 items-center gap-1 rounded-sm px-1.5 text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-100 sm:inline-flex"
            >
              <Search className="h-3 w-3" />
              <Kbd>⌘K</Kbd>
            </button>
            <CopyViewLink />
            <ThemeToggle />
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------- masthead */}
      <header className="border-b bg-card">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary font-headline text-2xl font-bold text-primary-foreground shadow-sm">
                M
              </div>
              <div>
                <h1 className="font-headline text-2xl font-bold leading-none sm:text-3xl">
                  The Meridian Ledger
                </h1>
                <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                  Agent-Native Newsroom Portal
                </p>
              </div>
            </div>

            <dl className="hidden items-end divide-x divide-border/70 md:flex">
              <Stat label="Stories in play" value={stories.length} />
              <Stat label="Vault assets" value={media.length} />
              <Stat label="Ready to hand off" value={readyToHandoff} accent />
              <Stat label="Expired rights" value={expiredAssets} danger={expiredAssets > 0} />
            </dl>
          </div>

          {/* ---------------------------------------------------- nav tabs */}
          <nav
            aria-label="Newsroom sections"
            className="masthead-rule scrollbar-slim flex gap-1 overflow-x-auto sm:gap-2"
          >
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  aria-current={active ? "page" : undefined}
                  title={t.countTitle}
                  className={cn(
                    "relative -mb-px flex shrink-0 items-center gap-1.5 border-b-[3px] px-2 py-3 text-xs font-semibold uppercase tracking-[0.06em] transition-colors sm:gap-2 sm:px-4 sm:text-sm sm:tracking-[0.14em]",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.shortLabel}</span>
                  {typeof t.count === "number" && (
                    <span
                      className={cn(
                        "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------ main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {!mounted ? (
          <AppSkeleton />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {view === "desk" && (
                <StoryDesk
                  onSendToHandoff={(storyId) => {
                    setHandoffStoryId(storyId);
                    setView("handoff");
                  }}
                />
              )}
              {view === "vault" && <MediaVault />}
              {view === "handoff" && (
                <HandoffEngine
                  preselectedStoryId={handoffStoryId}
                  onConsumePreselection={() => setHandoffStoryId(null)}
                  onOpenVault={() => setView("vault")}
                  onOpenStoryDesk={(storyId) => {
                    setStoryParam(storyId);
                    setView("desk");
                  }}
                  onOpenReceipt={(ref) => setReceiptParam(ref)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* --------------------------------------------------------- footer */}
      <footer className="mt-auto border-t bg-stone-900 text-stone-400 dark:bg-stone-950">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} The Meridian Ledger — internal newsroom demo. Sample content, MIT-licensed code.
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 uppercase tracking-[0.2em]">
            <span className="hidden md:inline">Story Desk · Media Vault · Handoff Engine</span>
            <span className="hidden items-center gap-1 text-stone-500 normal-case tracking-normal md:inline-flex">
              <Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd> sections
              <span className="mx-1 text-stone-600">·</span>
              <Kbd>/</Kbd> search
            </span>
          </p>
        </div>
      </footer>

      {receiptRef && (
        <HandoffReceiptDialog
          handoffRef={receiptRef}
          onClose={() => setReceiptParam("")}
        />
      )}

      <WebMCPBridge />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        view={view}
        onView={setView}
      />
    </div>
  );
}

/** Editorial loading state shown for the first paint before client data mounts. */
function AppSkeleton() {
  return (
    <div aria-hidden className="rise-in">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-[140px]" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-full" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg border p-3">
                <Skeleton className="h-14 w-20 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-4 lg:col-span-3 lg:block">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-9 w-11/12" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-stone-700 bg-stone-800 px-1 py-px font-mono text-[10px] leading-none text-stone-300">
      {children}
    </kbd>
  );
}

/** Copies the current deep-link (?view=&story=&layout=…) so a colleague (or an
 *  agent operator) can reopen the exact same view. Hydration-safe: icon swap
 *  happens only after a copy event. */
function CopyViewLink() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast({
        title: "View link copied",
        description: "This link reopens the exact desk, filters and selection.",
      });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Could not copy the link", variant: "destructive" });
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label="Copy link to this view"
      title="Copy link to this view"
      className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-100"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle day/night edition"
      title="Day / night edition"
      className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-sm text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-100"
    >
      {/* Both icons rendered; CSS decides — hydration-safe, no theme-derived attributes */}
      <Sun className="hidden h-3.5 w-3.5 dark:block" />
      <Moon className="h-3.5 w-3.5 dark:hidden" />
    </button>
  );
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="px-8 text-right first:pl-0 last:pr-0">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      {/* keyed by value so the pop animation replays whenever the count changes */}
      <dd
        key={value}
        className={cn(
          "stat-pop font-headline text-2xl font-bold leading-tight transition-colors",
          danger ? "text-red-700 dark:text-red-400" : accent ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
