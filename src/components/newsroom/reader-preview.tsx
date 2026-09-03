"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { StoryDTO } from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Link2,
  Printer,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { MediaImage, fmtDate, fmtRelative } from "./ui-primitives";

/**
 * Reader preview: renders the story the way it would appear on the consumer
 * site — editorial typography, lead image with credit, drop cap. Read-only
 * and print-friendly.
 */
export function ReaderPreviewDialog({
  story,
  open,
  onOpenChange,
}: {
  story: StoryDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const primary = story.media.find((m) => m.isPrimary) ?? story.media[0];
  const support = story.media.filter((m) => m !== primary);
  const overdue =
    story.scheduledFor &&
    story.status !== "PUBLISHED" &&
    new Date(story.scheduledFor).getTime() < Date.now();

  const copyLink = () => {
    const url = `${window.location.origin}/preview/${story.slug}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: "Permalink copied", description: url });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto scrollbar-slim p-0">
        <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-2 space-y-0 border-b bg-card/95 px-6 py-3 backdrop-blur">
          <DialogTitle className="font-headline text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Reader preview — {story.status.toLowerCase()}
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
              Permalink
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </DialogHeader>

        {/* article body */}
        <article className="px-6 pb-8 pt-5 sm:px-10">
          <div className="mx-auto max-w-[68ch]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-primary text-[11px] font-semibold uppercase tracking-wider text-primary-foreground">
                {story.desk}
              </Badge>
              {overdue && (
                <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3" /> past deadline
                </Badge>
              )}
              {story.scheduledFor && !overdue && story.status !== "PUBLISHED" && (
                <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" /> targeted {fmtDate(story.scheduledFor)}
                </Badge>
              )}
            </div>

            <h1 className="mt-3 font-headline text-3xl font-bold leading-[1.15] tracking-tight sm:text-[2.4rem]">
              {story.title}
            </h1>
            {story.summary && (
              <p className="mt-4 font-headline text-lg italic leading-relaxed text-stone-600 dark:text-stone-300">
                {story.summary}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-y py-3 text-xs text-stone-500 dark:text-stone-400">
              <span className="font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">
                By {story.author}
              </span>
              <span>
                {story.publishedAt
                  ? `Published ${fmtDate(story.publishedAt)}`
                  : `Updated ${fmtRelative(story.updatedAt)}`}
                {" · "}
                {story.wordCount} words · {Math.max(1, Math.round(story.wordCount / 200))} min read
              </span>
            </div>

            {primary && (
              <figure className="mt-6">
                <div className="relative aspect-[7/4] overflow-hidden rounded-md bg-muted">
                  <MediaImage
                    asset={primary.media}
                    alt={primary.altText || primary.caption || primary.media.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 720px"
                    className={cn(
                      "object-cover",
                      primary.media.rights.status === "EXPIRED" && "grayscale"
                    )}
                    priority
                  />
                </div>
                <figcaption className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                  {primary.caption || primary.media.title}
                  <span className="ml-2 font-medium text-stone-600 dark:text-stone-300">
                    ({primary.media.creditLine || "Credit required"})
                  </span>
                </figcaption>
              </figure>
            )}

            <div className="article-preview mt-6 text-[1.05rem] leading-[1.85] text-stone-800 dark:text-stone-200">
              {story.body.split("\n\n").map((para, i) => (
                <p key={i} className={cn(i === 0 && "first-para")}>
                  {para}
                </p>
              ))}
              {!story.body && (
                <p className="italic text-stone-400 dark:text-stone-500">Body copy not written yet.</p>
              )}
            </div>

            {support.length > 0 && (
              <div className="mt-8 grid grid-cols-2 gap-3">
                {support.map((m) => (
                  <figure key={m.mediaId}>
                    <div className="relative aspect-[3/2] overflow-hidden rounded-md bg-muted">
                      <MediaImage
                        asset={m.media}
                        alt={m.altText || m.caption || m.media.title}
                        fill
                        sizes="320px"
                        className={cn(
                          "object-cover",
                          m.media.rights.status === "EXPIRED" && "grayscale"
                        )}
                      />
                    </div>
                    <figcaption className="mt-1.5 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
                      {m.caption || m.media.title}
                      <span className="ml-1 font-medium text-stone-600 dark:text-stone-300">
                        ({m.media.creditLine})
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            <div className="mt-8 border-t pt-3 text-[11px] uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
              The Meridian Ledger · {story.desk} desk · preview generated in the newsroom portal
            </div>
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}
