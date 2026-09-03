"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNewsroom } from "@/hooks/use-newsroom";
import type { StoryDTO } from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { MediaImage, RightsBadge, fmtDate } from "./ui-primitives";

/**
 * Replacement picker for an attached asset — primarily used to swap out
 * expired-rights imagery. Lists only web-cleared, non-expired assets that are
 * not already attached to the story; keeps caption + lead status on swap.
 */
export function ReplaceMediaDialog({
  story,
  mediaId,
  open,
  onOpenChange,
  onReplaced,
}: {
  story: StoryDTO;
  mediaId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReplaced?: () => void;
}) {
  const media = useNewsroom((s) => s.media);
  const replaceMedia = useNewsroom((s) => s.replaceMedia);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | undefined>(undefined);
  const [altText, setAltText] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const current = story.media.find((m) => m.mediaId === mediaId);
  const attachedIds = useMemo(
    () => new Set(story.media.map((m) => m.mediaId)),
    [story.media]
  );

  const usable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media
      .filter((m) => !attachedIds.has(m.id))
      .filter((m) => m.rights.status === "VALID" || m.rights.status === "PERPETUAL")
      .filter((m) => m.rights.webAllowed)
      .filter((m) => {
        if (!q) return true;
        return `${m.title} ${m.description} ${m.photographer} ${m.source}`
          .toLowerCase()
          .includes(q);
      });
  }, [media, attachedIds, query]);

  const doReplace = async () => {
    if (!selectedId || !current) return;
    setBusy(true);
    try {
      await replaceMedia(story.id, mediaId, selectedId, {
        // Untouched caption keeps the existing one (undefined is not serialized);
        // alt text resets with a new image unless the editor supplies one.
        ...(caption === undefined ? {} : { caption: caption.trim() || null }),
        ...(altText.trim() ? { altText: altText.trim() } : {}),
      });
      toast({
        title: "Media replaced",
        description: altText.trim()
          ? "Caption and lead-image status were preserved; alt text set."
          : "Caption and lead-image status were preserved. Add alt text for the new image on the Story Desk.",
      });
      onOpenChange(false);
      onReplaced?.();
      setSelectedId(null);
      setQuery("");
      setCaption(undefined);
      setAltText("");
    } catch (e) {
      toast({
        title: "Replacement failed",
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
          <DialogTitle className="flex items-center gap-2 font-headline">
            <ArrowRightLeft className="h-4 w-4 text-primary" /> Replace media
          </DialogTitle>
          <DialogDescription>
            Swap out <span className="font-medium text-foreground">{current?.media.title}</span>.
            Only web-cleared assets with valid rights are listed; caption and lead-image status are
            preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search usable replacements…"
            className="pl-8"
          />
        </div>

        <div className="scrollbar-slim grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {usable.map((m) => (
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
                <RightsBadge
                  status={m.rights.status}
                  label={m.rights.status === "PERPETUAL" ? "Perpetual" : `→ ${fmtDate(m.rights.expiresAt)}`}
                />
              </div>
            </button>
          ))}
          {usable.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No web-cleared replacements available — the vault may need new licensing.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="replace-caption">
            Caption {caption === undefined && <span className="text-muted-foreground">(keeps existing)</span>}
          </Label>
          <Input
            id="replace-caption"
            value={caption ?? current?.caption ?? ""}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={current?.caption || "Editorial caption…"}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="replace-alt" className="flex items-center gap-1.5">
            Alt text
            <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              required for handoff
            </span>
          </Label>
          <Input
            id="replace-alt"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder={`Describe the new image…`}
          />
          <p className="text-[11px] text-muted-foreground">
            Read by screen readers and delivered in the web payload. The replacement starts without
            alt text — the handoff validation will remind you until it is set.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={doReplace} disabled={!selectedId || busy} className="gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            {busy ? "Replacing…" : "Replace Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
