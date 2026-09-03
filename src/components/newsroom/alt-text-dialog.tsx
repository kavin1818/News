"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNewsroom } from "@/hooks/use-newsroom";
import type { StoryAttachmentDTO } from "@/lib/newsroom/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
 * Edit the alt text (text alternative) of a story's media attachment. Alt text
 * is an accessibility requirement: the Handoff Engine's publication validation
 * blocks until every attached asset carries one, and the web payload delivers
 * it as the image's `alt` attribute.
 */
export function AltTextDialog({
  storyId,
  attachment,
  onClose,
}: {
  storyId: string;
  attachment: StoryAttachmentDTO;
  onClose: () => void;
}) {
  const updateAttachment = useNewsroom((s) => s.updateAttachment);
  const { toast } = useToast();
  const [value, setValue] = useState(attachment.altText ?? "");
  const [busy, setBusy] = useState(false);

  // Re-seed when a different attachment is opened.
  useEffect(() => {
    setValue(attachment.altText ?? "");
  }, [attachment.mediaId, attachment.altText]);

  const save = async () => {
    setBusy(true);
    try {
      await updateAttachment(storyId, attachment.mediaId, { altText: value });
      toast({
        title: value.trim() ? "Alt text saved" : "Alt text cleared",
        description: value.trim()
          ? `Accessibility check for "${attachment.media.title}" will pass.`
          : "The handoff validation will flag this asset until alt text is set.",
      });
      onClose();
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <PenLine className="h-4 w-4 text-primary" /> Alt text — {attachment.media.title}
          </DialogTitle>
          <DialogDescription>
            Describe the image for screen readers. Keep it factual and under ~125 characters —
            it is delivered as the image&rsquo;s <span className="font-mono text-xs">alt</span>{" "}
            attribute in the web payload.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border bg-muted">
            <MediaImage
              asset={attachment.media}
              alt={attachment.media.title}
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="alt-text-input">
              Text alternative{" "}
              <span
                className={
                  value.trim().length > 125
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
                }
              >
                ({value.trim().length}/125)
              </span>
            </Label>
            <Textarea
              id="alt-text-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Council members vote during the final reading of the housing package."
              rows={3}
              className="min-h-0"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save Alt Text"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
