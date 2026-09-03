"use client";

import { useState } from "react";
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
import { Loader2, PenLine } from "lucide-react";
import { MediaImage } from "./ui-primitives";

/**
 * Fix every attachment of a story that is missing alt text in one dialog —
 * offered directly from the Handoff Engine's validation remediation panel so
 * the editor never has to leave the tab to clear the accessibility blocker.
 */
export function AltTextFixDialog({
  story,
  onClose,
  onFixed,
}: {
  story: StoryDTO;
  onClose: () => void;
  /** Called after at least one alt text was saved (re-validate the story). */
  onFixed?: () => void;
}) {
  const updateAttachment = useNewsroom((s) => s.updateAttachment);
  const { toast } = useToast();
  // Mount-on-open: the parent renders this dialog only while fixing, so the
  // working copy can be initialized directly from props (no reset effects).
  const missing = story.media.filter((m) => !m.altText?.trim());
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(missing.map((m) => [m.mediaId, ""]))
  );
  const [busy, setBusy] = useState(false);

  const setValue = (mediaId: string, v: string) =>
    setValues((prev) => ({ ...prev, [mediaId]: v }));

  const filledCount = missing.filter((m) => (values[m.mediaId] ?? "").trim()).length;

  const save = async () => {
    const toSave = missing.filter((m) => (values[m.mediaId] ?? "").trim());
    if (toSave.length === 0) return;
    setBusy(true);
    try {
      for (const m of toSave) {
        await updateAttachment(story.id, m.mediaId, {
          altText: (values[m.mediaId] ?? "").trim(),
        });
      }
      toast({
        title: `Alt text saved for ${toSave.length} asset${toSave.length > 1 ? "s" : ""}`,
        description: "Re-running publication validation…",
      });
      onClose();
      onFixed?.();
    } catch (e) {
      toast({
        title: "Could not save alt text",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <PenLine className="h-4 w-4 text-primary" /> Add missing alt text
          </DialogTitle>
          <DialogDescription>
            {missing.length === 0
              ? "Every attachment already has a text alternative."
              : `${missing.length} attachment${missing.length > 1 ? "s" : ""} on “${story.title}” need${missing.length > 1 ? "" : "s"} a text alternative before handoff.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {missing.map((m) => (
            <li key={m.mediaId} className="flex gap-3">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                <MediaImage
                  asset={m.media}
                  alt={m.media.title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`fix-alt-${m.mediaId}`} className="min-w-0">
                  <span className="block truncate font-medium">{m.media.title}</span>
                </Label>
                <Input
                  id={`fix-alt-${m.mediaId}`}
                  value={values[m.mediaId] ?? ""}
                  onChange={(e) => setValue(m.mediaId, e.target.value)}
                  placeholder={`Describe the image for screen readers…`}
                  autoFocus={missing.length === 1}
                />
                <p
                  className={cn(
                    "text-[11px]",
                    (values[m.mediaId] ?? "").trim().length > 125
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  {(values[m.mediaId] ?? "").trim().length}/125 characters
                </p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || filledCount === 0}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              `Save ${filledCount > 0 ? filledCount : ""} ${filledCount === 1 ? "Alt Text" : "Alt Texts"} & Re-validate`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
