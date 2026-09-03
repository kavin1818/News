"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNewsroom } from "@/hooks/use-newsroom";
import { LICENSE_TYPES } from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { ImageOff, Link2, Loader2, ShieldCheck } from "lucide-react";

const ALL_CHANNELS = ["web", "print", "social", "broadcast"] as const;

/**
 * Register a new vault asset from an external image URL. The image stays at
 * its source (the vault stores the reference); the licensing metadata captured
 * here is what the Handoff Engine later gates publication on.
 */
export function RegisterAssetDialog({
  open,
  onOpenChange,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegistered?: (assetId: string) => void;
}) {
  const createMediaAsset = useNewsroom((s) => s.createMediaAsset);
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [photographer, setPhotographer] = useState("");
  const [source, setSource] = useState("");
  const [description, setDescription] = useState("");
  const [licenseType, setLicenseType] = useState<string>("Rights-Managed");
  const [licenseNotes, setLicenseNotes] = useState("");
  const [channels, setChannels] = useState<string[]>(["web"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [creditRequired, setCreditRequired] = useState(true);
  const [creditLine, setCreditLine] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the whole form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setUrl("");
      setTitle("");
      setPhotographer("");
      setSource("");
      setDescription("");
      setLicenseType("Rights-Managed");
      setLicenseNotes("");
      setChannels(["web"]);
      setExpiresAt("");
      setCreditRequired(true);
      setCreditLine("");
      setWidth("");
      setHeight("");
      setPreviewOk(null);
    }
  }, [open]);

  const urlValid = /^https?:\/\/.+/i.test(url.trim());
  const canSubmit = urlValid && title.trim().length >= 3 && photographer.trim().length >= 2;

  const toggleChannel = (c: string) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const media = await createMediaAsset({
        url: url.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        photographer: photographer.trim(),
        source: source.trim() || undefined,
        licenseType,
        licenseNotes: licenseNotes.trim() || undefined,
        allowedChannels: channels.length ? channels : ["web"],
        expiresAt: expiresAt || null,
        creditRequired,
        creditLine: creditLine.trim() || undefined,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
      });
      toast({
        title: "Asset registered in the vault",
        description: `"${media.title}" — rights ${media.rights.status === "PERPETUAL" ? "perpetual" : `until ${media.rights.expiresAt?.slice(0, 10) ?? "—"}`}.`,
      });
      onRegistered?.(media.id);
    } catch (e) {
      toast({
        title: "Could not register asset",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline">
            <Link2 className="h-4 w-4 text-primary" /> Register asset by URL
          </DialogTitle>
          <DialogDescription>
            Add wire-service or agent-supplied imagery to the vault. The image stays at its
            source; the licensing metadata below is what the Handoff Engine gates publication on.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* preview + url */}
          <div className="space-y-3">
            <div className="relative aspect-[3/2] overflow-hidden rounded-lg border bg-muted">
              {urlValid ? (
                <img
                  key={url}
                  src={url.trim()}
                  alt="Preview of the asset to register"
                  className={cn(
                    "h-full w-full object-cover",
                    previewOk === false && "hidden"
                  )}
                  referrerPolicy="no-referrer"
                  onLoad={() => setPreviewOk(true)}
                  onError={() => setPreviewOk(false)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
                  <Link2 className="h-6 w-6" />
                  <p className="px-4 text-center text-[11px]">
                    Paste an http(s) image URL to preview it here
                  </p>
                </div>
              )}
              {previewOk === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted text-muted-foreground">
                  <ImageOff className="h-6 w-6" />
                  <p className="px-4 text-center text-[11px]">
                    The preview could not be loaded — the URL may block embedding. Registration is
                    still possible.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-url">Image URL</Label>
              <Input
                id="reg-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setPreviewOk(null);
                }}
                placeholder="https://…/photo.jpg"
                inputMode="url"
                aria-invalid={url.length > 0 && !urlValid}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-width">
                  Width <span className="text-muted-foreground">(px, optional)</span>
                </Label>
                <Input
                  id="reg-width"
                  value={width}
                  onChange={(e) => setWidth(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="1600"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-height">
                  Height <span className="text-muted-foreground">(px, optional)</span>
                </Label>
                <Input
                  id="reg-height"
                  value={height}
                  onChange={(e) => setHeight(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="1067"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          {/* metadata */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reg-title">
                Title <span className="text-red-600 dark:text-red-400">*</span>
              </Label>
              <Input
                id="reg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Harbor cleanup aerial"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-photographer">
                  Photographer <span className="text-red-600 dark:text-red-400">*</span>
                </Label>
                <Input
                  id="reg-photographer"
                  value={photographer}
                  onChange={(e) => setPhotographer(e.target.value)}
                  placeholder="Photographer or agency"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-source">Source</Label>
                <Input
                  id="reg-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Defaults to External wire"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-desc">Description</Label>
              <Textarea
                id="reg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the image shows, for the vault record…"
                rows={2}
                className="min-h-0"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>License type</Label>
                <Select value={licenseType} onValueChange={setLicenseType}>
                  <SelectTrigger aria-label="License type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSE_TYPES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-expiry">License expiry</Label>
                <Input
                  id="reg-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave empty for a perpetual license.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Allowed channels</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {ALL_CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm capitalize">
                    <Checkbox
                      checked={channels.includes(c)}
                      onCheckedChange={() => toggleChannel(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={creditRequired}
                  onCheckedChange={(v) => setCreditRequired(v === true)}
                />
                Credit required for publication
              </label>
              {creditRequired && (
                <Input
                  value={creditLine}
                  onChange={(e) => setCreditLine(e.target.value)}
                  placeholder="Credit line, e.g. Photo: K. Osei / Meridian"
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Registering…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Register Asset
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
