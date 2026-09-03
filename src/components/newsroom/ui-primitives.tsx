"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCheck,
  Eye,
  Globe2,
  Link2,
  Megaphone,
  MonitorPlay,
  Newspaper,
  Pencil,
  Radio,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Undo2,
} from "lucide-react";
import type { RightsStatus, StoryStatus } from "@/lib/newsroom/types";

// ---------------------------------------------------------------------------
// MediaImage — renders vault assets from either the local /media library
// (optimized next/image) or an external URL registered by URL (plain img,
// no remote-pattern configuration required).
// ---------------------------------------------------------------------------

export function isExternalMedia(asset: { externalUrl?: string | null }): boolean {
  return !!asset.externalUrl;
}

export function MediaImage({
  asset,
  alt,
  className,
  sizes,
  fill,
  width,
  height,
  priority,
}: {
  asset: { url: string; externalUrl?: string | null };
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  if (isExternalMedia(asset)) {
    return (
      <img
        src={asset.url}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className={cn(fill && "absolute inset-0 h-full w-full", className)}
        referrerPolicy="no-referrer"
      />
    );
  }
  if (fill) {
    return (
      <Image
        src={asset.url}
        alt={alt}
        fill
        sizes={sizes ?? "33vw"}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className={className}
      />
    );
  }
  return (
    <Image
      src={asset.url}
      alt={alt}
      width={width ?? 800}
      height={height ?? 533}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className={className}
    />
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<
  StoryStatus,
  { className: string; icon: React.ComponentType<{ className?: string }>; dot: string }
> = {
  DRAFT: {
    className:
      "bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-800/80 dark:text-stone-300 dark:border-stone-600",
    icon: Pencil,
    dot: "bg-stone-400",
  },
  IN_REVIEW: {
    className:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    icon: Eye,
    dot: "bg-amber-500",
  },
  REVISION_REQUESTED: {
    className:
      "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
    icon: Undo2,
    dot: "bg-orange-500",
  },
  APPROVED: {
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    icon: CheckCheck,
    dot: "bg-emerald-500",
  },
  PUBLISHED: {
    className:
      "bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100",
    icon: Newspaper,
    dot: "bg-stone-900 dark:bg-stone-100",
  },
};

export const STATUS_LABELS_UI: Record<StoryStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  REVISION_REQUESTED: "Revision Requested",
  APPROVED: "Approved",
  PUBLISHED: "Published",
};

// ---------------------------------------------------------------------------
// Status stepper — editorial pipeline visual for the story detail header.
// Mainline stages: Draft → In Review → Approved → Published. A story in
// "Revision Requested" is shown as a detour on the In Review stage.
// ---------------------------------------------------------------------------

const STEPPER_STAGES: Array<{ id: StoryStatus; label: string }> = [
  { id: "DRAFT", label: "Draft" },
  { id: "IN_REVIEW", label: "Review" },
  { id: "APPROVED", label: "Approved" },
  { id: "PUBLISHED", label: "Published" },
];

const STEPPER_ORDER: Record<StoryStatus, number> = {
  DRAFT: 0,
  IN_REVIEW: 1,
  REVISION_REQUESTED: 1,
  APPROVED: 2,
  PUBLISHED: 3,
};

export function StatusStepper({ status }: { status: StoryStatus }) {
  const current = STEPPER_ORDER[status];
  const revising = status === "REVISION_REQUESTED";
  return (
    <ol
      aria-label="Workflow progress"
      className="flex flex-wrap items-center gap-y-1"
    >
      {STEPPER_STAGES.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={stage.id} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-px w-6 sm:w-8",
                  done || active ? "bg-primary/60" : "bg-border"
                )}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              title={
                revising && active
                  ? "Revision requested — back with the writer"
                  : STATUS_LABELS_UI[stage.id]
              }
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors",
                active
                  ? revising
                    ? "text-orange-700 dark:text-orange-300"
                    : "text-primary"
                  : done
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground/60"
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold leading-none",
                  active
                    ? revising
                      ? "border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-300"
                      : "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-emerald-600/70 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                      : "border-border bg-transparent text-muted-foreground/50",
                  active && (status === "IN_REVIEW" || revising) && "animate-pulse"
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              {stage.label}
            </span>
          </li>
        );
      })}
      {revising && (
        <li className="ml-2 flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.08em] text-orange-700 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
          <Undo2 className="h-2.5 w-2.5" /> in revision
        </li>
      )}
    </ol>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const style = STATUS_STYLES[status as StoryStatus] ?? STATUS_STYLES.DRAFT;
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium tracking-wide", style.className, className)}
    >
      <Icon className="h-3 w-3" />
      {STATUS_LABELS_UI[status as StoryStatus] ?? status}
    </Badge>
  );
}

export function StatusDot({ status }: { status: string }) {
  const style = STATUS_STYLES[status as StoryStatus] ?? STATUS_STYLES.DRAFT;
  return <span className={cn("h-2 w-2 rounded-full", style.dot)} />;
}

// ---------------------------------------------------------------------------
// Desk color coding — a warm dot per desk for fast scanning across views.
// ---------------------------------------------------------------------------

const DESK_DOT: Record<string, string> = {
  "City Hall": "bg-red-600",
  Business: "bg-amber-500",
  Tech: "bg-teal-500",
  Climate: "bg-emerald-600",
  Sports: "bg-orange-500",
  Culture: "bg-violet-500",
};

export function DeskDot({ desk, className }: { desk: string; className?: string }) {
  return (
    <span
      aria-hidden
      title={`${desk} desk`}
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20",
        DESK_DOT[desk] ?? "bg-stone-400",
        className
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Rights badge
// ---------------------------------------------------------------------------

const RIGHTS_STYLES: Record<
  RightsStatus,
  { className: string; label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PERPETUAL: {
    className:
      "bg-stone-800 text-white border-stone-800 dark:bg-stone-200 dark:text-stone-900 dark:border-stone-200",
    label: "No expiry",
    icon: ShieldCheck,
  },
  VALID: {
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    label: "Rights valid",
    icon: ShieldCheck,
  },
  EXPIRING_SOON: {
    className:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    label: "Expiring soon",
    icon: ShieldAlert,
  },
  EXPIRED: {
    className:
      "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
    label: "Expired",
    icon: ShieldX,
  },
};

export function RightsBadge({
  status,
  className,
  label,
}: {
  status: RightsStatus;
  className?: string;
  label?: string;
}) {
  const style = RIGHTS_STYLES[status];
  if (!style) return null;
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", style.className, className)}
    >
      <Icon className="h-3 w-3" />
      {label ?? style.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

const CHANNEL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  web: Globe2,
  print: Newspaper,
  social: Megaphone,
  broadcast: MonitorPlay,
};

export function ChannelChips({
  channels,
  className,
}: {
  channels: string[];
  className?: string;
}) {
  if (!channels.length) {
    return <span className={cn("text-xs italic text-muted-foreground", className)}>No channels</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {channels.map((c) => {
        const Icon = CHANNEL_ICONS[c] ?? Radio;
        return (
          <span
            key={c}
            title={`Channel: ${c}`}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            <Icon className="h-2.5 w-2.5" />
            {c}
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy");
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy · HH:mm");
}

export function fmtRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/** "past" = deadline already passed, "soon" = within 48 hours, null = fine. */
export function deadlineState(iso: string | null | undefined): "past" | "soon" | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = t - Date.now();
  if (diff < 0) return "past";
  if (diff <= 48 * 3600 * 1000) return "soon";
  return null;
}

export function expiryText(iso: string | null, status: RightsStatus): string {
  if (!iso) return "Perpetual license";
  if (status === "EXPIRED") return `Expired ${fmtDate(iso)}`;
  return `${status === "EXPIRING_SOON" ? "Expires" : "Expires"} ${fmtDate(iso)}`;
}
