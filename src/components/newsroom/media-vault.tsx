"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNewsroom } from "@/hooks/use-newsroom";
import {
  LICENSE_TYPES,
  type MediaAssetDTO,
  type RightsStatus,
} from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  AlertTriangle,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ClipboardCopy,
  ImagePlus,
  Link2,
  Loader2,
  Search,
  ShieldX,
  ZoomIn,
} from "lucide-react";
import {
  ChannelChips,
  DeskDot,
  MediaImage,
  RightsBadge,
  StatusBadge,
  expiryText,
  fmtDate,
} from "./ui-primitives";
import { useQueryParam } from "@/hooks/use-url-state";
import { RegisterAssetDialog } from "./register-asset-dialog";

// ---------------------------------------------------------------------------
// Media Vault
// ---------------------------------------------------------------------------

export function MediaVault() {
  const media = useNewsroom((s) => s.media);
  const stories = useNewsroom((s) => s.stories);
  const loading = useNewsroom((s) => s.mediaLoading);
  const [query, setQuery] = useState("");
  const [rights, setRights] = useState("any");
  const [license, setLicense] = useState("any");
  const [channel, setChannel] = useState("any");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  // Deep-linkable asset detail: /?view=vault&asset=<id> opens the dialog.
  const [assetParam, setAssetParam] = useQueryParam("asset", "");
  const openDetailId = detailId ?? assetParam ?? null;

  // Cross-tab navigation: open a story on the desk straight from the vault.
  // Switches to the list layout so the story's detail pane is visible.
  const [, setViewParam] = useQueryParam("view", "desk");
  const [, setStoryParam] = useQueryParam("story", "");
  const [, setLayoutParam] = useQueryParam("layout", "list");
  const openStoryOnDesk = (storyId: string) => {
    setStoryParam(storyId);
    setLayoutParam("list");
    setViewParam("desk");
    setDetailId(null);
    setAssetParam(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return media.filter((m) => {
      if (rights === "USABLE") {
        if (m.rights.status !== "VALID" && m.rights.status !== "PERPETUAL") return false;
      } else if (rights !== "any" && m.rights.status !== rights) {
        return false;
      }
      if (license !== "any" && m.licenseType !== license) return false;
      if (channel !== "any" && !m.allowedChannels.includes(channel)) return false;
      if (q) {
        const hay = `${m.title} ${m.description} ${m.photographer} ${m.source} ${m.fileName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [media, query, rights, license, channel]);

  const expiredCount = media.filter((m) => m.rights.status === "EXPIRED").length;
  const expiringCount = media.filter((m) => m.rights.status === "EXPIRING_SOON").length;
  // Dated assets whose license window needs attention — the bulk-renewal pool.
  const renewCandidates = useMemo(
    () =>
      media.filter(
        (m) => m.rights.status === "EXPIRING_SOON" || m.rights.status === "EXPIRED"
      ),
    [media]
  );

  const detail = media.find((m) => m.id === openDetailId) ?? null;
  const zoomAsset = media.find((m) => m.id === lightboxId) ?? null;
  const closeDetail = () => {
    setDetailId(null);
    setAssetParam(null);
  };

  return (
    <div className="rise-in">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline text-2xl font-bold">Media Vault</h2>
          <p className="text-sm text-muted-foreground">
            Photographs with licensing, usage rights and attribution requirements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1 bg-card">
            <Camera className="h-3 w-3" /> {media.length} assets
          </Badge>
          {expiringCount > 0 && (
            <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> {expiringCount} expiring soon
            </Badge>
          )}
          {expiredCount > 0 && (
            <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
              <ShieldX className="h-3 w-3" /> {expiredCount} expired
            </Badge>
          )}
          {renewCandidates.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
              onClick={() => setRenewOpen(true)}
              title="Extend the license window of expiring/expired assets"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Renew licenses ({renewCandidates.length})
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRegisterOpen(true)}>
            <ImagePlus className="h-3.5 w-3.5" /> Register asset
          </Button>
        </div>
      </div>

      {/* filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, photographers, sources…"
            className="pl-8"
            aria-label="Search media"
          />
        </div>
        <Select value={rights} onValueChange={setRights}>
          <SelectTrigger aria-label="Filter by rights status">
            <SelectValue placeholder="Rights status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any rights status</SelectItem>
            <SelectItem value="USABLE">Usable now (valid or perpetual)</SelectItem>
            <SelectItem value="VALID">Rights valid (dated)</SelectItem>
            <SelectItem value="EXPIRING_SOON">Expiring soon</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="PERPETUAL">Perpetual (no expiry)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={license} onValueChange={setLicense}>
          <SelectTrigger aria-label="Filter by license type">
            <SelectValue placeholder="License" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any license</SelectItem>
            {LICENSE_TYPES.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger aria-label="Filter by channel">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any channel</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="print">Print</SelectItem>
            <SelectItem value="social">Social</SelectItem>
            <SelectItem value="broadcast">Broadcast</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* grid */}
      {loading && media.length === 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border bg-card">
              <Skeleton className="aspect-[3/2] rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Camera className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No assets match these filters.</p>
          {(query || rights !== "any" || license !== "any" || channel !== "any") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery("");
                setRights("any");
                setLicense("any");
                setChannel("any");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m, i) => (
            <MediaCard
              key={m.id}
              asset={m}
              // First two rows load eagerly: at 4-col widths the LCP element
              // can sit in the second row, and next/image warns about it.
              eager={i < 8}
              onOpen={() => setDetailId(m.id)}
              onZoom={() => setLightboxId(m.id)}
            />
          ))}
        </div>
      )}

      {detail && (
        <MediaDetailDialog
          key={detail.id}
          asset={detail}
          stories={stories.map((s) => ({ id: s.id, title: s.title, status: s.status }))}
          usedIn={stories
            .filter((s) => s.media.some((m) => m.mediaId === detail.id))
            .map((s) => ({ id: s.id, title: s.title, status: s.status, desk: s.desk }))}
          onOpenStory={openStoryOnDesk}
          onZoom={() => setLightboxId(detail.id)}
          onClose={closeDetail}
        />
      )}

      {zoomAsset && (
        <MediaLightbox asset={zoomAsset} onClose={() => setLightboxId(null)} />
      )}

      <RegisterAssetDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={(id) => {
          setRegisterOpen(false);
          setAssetParam(id);
        }}
      />

      {renewOpen && (
        <BulkRenewDialog
          candidates={renewCandidates}
          onClose={() => setRenewOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function MediaCard({
  asset,
  eager,
  onOpen,
  onZoom,
}: {
  asset: MediaAssetDTO;
  /** Above-the-fold cards load eagerly (LCP hint from the framework). */
  eager?: boolean;
  onOpen: () => void;
  onZoom: () => void;
}) {
  const expired = asset.rights.status === "EXPIRED";
  return (
    <button
      onClick={onOpen}
      className="group overflow-hidden rounded-lg border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-muted">
        <MediaImage
          asset={asset}
          alt={asset.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          priority={eager}
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-[1.03]",
            expired && "grayscale"
          )}
        />
        {expired && <div className="absolute inset-0 expired-hatch" />}
        <div className="absolute right-2 top-2">
          <RightsBadge status={asset.rights.status} />
        </div>
        {asset.externalUrl && (
          <div className="absolute left-2 top-2">
            <Badge className="gap-1 bg-stone-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              <Link2 className="h-2.5 w-2.5" /> External
            </Badge>
          </div>
        )}
        {asset.attachedToCount > 0 && (
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-stone-900/80 px-1.5 py-0.5 text-[10px] text-white backdrop-blur dark:bg-stone-900/80">
              In {asset.attachedToCount} story{asset.attachedToCount > 1 ? "s" : ""}
            </Badge>
          </div>
        )}
        <span
          role="button"
          tabIndex={0}
          aria-label={`Zoom ${asset.title}`}
          title="View full size"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              e.preventDefault();
              onZoom();
            }
          }}
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-stone-900/70 text-white opacity-0 shadow-sm backdrop-blur transition-all hover:bg-stone-900 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-1 font-headline text-[15px] font-semibold">{asset.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {asset.photographer} · {asset.source}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px] font-medium">
            {asset.licenseType}
          </Badge>
          <span
            className={cn(
              "text-[11px]",
              expired ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground"
            )}
          >
            {expiryText(asset.rights.expiresAt, asset.rights.status)}
          </span>
        </div>
        <Separator className="my-2" />
        <ChannelChips channels={asset.allowedChannels} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail dialog
// ---------------------------------------------------------------------------

/** Default renewal offer: one year out (date-input friendly yyyy-mm-dd). */
function defaultRenewalDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function MediaDetailDialog({
  asset,
  stories,
  usedIn,
  onOpenStory,
  onZoom,
  onClose,
}: {
  asset: MediaAssetDTO;
  stories: Array<{ id: string; title: string; status: string }>;
  usedIn: Array<{ id: string; title: string; status: string; desk: string }>;
  onOpenStory: (storyId: string) => void;
  onZoom: () => void;
  onClose: () => void;
}) {
  const attachMedia = useNewsroom((s) => s.attachMedia);
  const updateMediaAsset = useNewsroom((s) => s.updateMediaAsset);
  const { toast } = useToast();
  const [storyId, setStoryId] = useState("");
  const [caption, setCaption] = useState("");
  const [altText, setAltText] = useState("");
  const [asPrimary, setAsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  // License renewal working copy (mount-on-open via the key on the dialog).
  const [renewDate, setRenewDate] = useState(() =>
    defaultRenewalDate()
  );
  const [renewNote, setRenewNote] = useState("");
  const [renewBusy, setRenewBusy] = useState(false);

  // Reset form each time a new asset is opened
  useEffect(() => {
    setStoryId("");
    setCaption("");
    setAltText("");
    setAsPrimary(false);
  }, [asset.id]);

  const expired = asset.rights.status === "EXPIRED";
  const datedLicense = asset.rights.expiresAt !== null;

  const doRenew = async () => {
    if (!renewDate) return;
    const d = new Date(`${renewDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    setRenewBusy(true);
    try {
      await updateMediaAsset(asset.id, {
        expiresAt: d.toISOString(),
        ...(renewNote.trim()
          ? {
              licenseNotes: asset.licenseNotes
                ? `${asset.licenseNotes} · Renewed ${d.toISOString().slice(0, 10)}: ${renewNote.trim()}`
                : `Renewed ${d.toISOString().slice(0, 10)}: ${renewNote.trim()}`,
            }
          : {}),
      });
      toast({
        title: "License renewed",
        description: `${asset.title} is now licensed through ${d.toISOString().slice(0, 10)}.`,
      });
      setRenewNote("");
    } catch (e) {
      toast({
        title: "Renewal failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRenewBusy(false);
    }
  };

  // Stories that don't yet have this asset and aren't published
  const attachable = stories.filter(
    (s) => s.status !== "PUBLISHED" && !asset.attachedStoryTitles.includes(s.title)
  );

  const doAttach = async () => {
    if (!storyId) return;
    setBusy(true);
    try {
      await attachMedia(storyId, asset.id, {
        caption: caption.trim() || null,
        altText: altText.trim() || null,
        isPrimary: asPrimary,
      });
      const storyTitle = stories.find((s) => s.id === storyId)?.title ?? "story";
      toast({ title: `Attached to "${storyTitle}"` });
      onClose();
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="font-headline pr-6 text-xl">{asset.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            <RightsBadge status={asset.rights.status} />
            <Badge variant="outline">{asset.licenseType}</Badge>
            <Badge variant="outline">
              {asset.width && asset.height
                ? `${asset.width}×${asset.height}`
                : "dimensions unknown"}{' '}
              · {asset.format.toUpperCase()} · {asset.sizeKb > 0 ? `${asset.sizeKb} KB` : "linked asset"}
            </Badge>
            {asset.externalUrl && (
              <Badge variant="outline" className="gap-1">
                <Link2 className="h-3 w-3" /> External source
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* image */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={onZoom}
              title="View full size"
              className="group relative block aspect-[7/4] w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
            >
              <MediaImage
                asset={asset}
                alt={asset.title}
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                priority
                className={cn("object-cover transition-transform duration-300 group-hover:scale-[1.02]", expired && "grayscale")}
              />
              {expired && <div className="absolute inset-0 expired-hatch" />}
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-stone-900/70 text-white opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                <ZoomIn className="h-3.5 w-3.5" />
              </span>
            </button>
            <p className="text-sm leading-relaxed text-muted-foreground">{asset.description}</p>
            <ChannelChips channels={asset.allowedChannels} className="justify-start" />
          </div>

          {/* metadata */}
          <div>
            {expired && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  License expired {fmtDate(asset.rights.expiresAt)} — this asset cannot be handed
                  off for web publication until replaced or renewed.
                </span>
              </div>
            )}
            {!expired && asset.rights.status === "EXPIRING_SOON" && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  License expires in {asset.rights.daysUntilExpiry} day(s) — schedule a renewal
                  before republishing.
                </span>
              </div>
            )}

            <dl className="space-y-2.5 text-sm">
              <Row label="Photographer" value={asset.photographer} />
              <Row label="Source" value={asset.source} />
              {asset.externalUrl && <Row label="Source URL" value={asset.externalUrl} />}
              <Row label="License type" value={asset.licenseType} />
              <Row label="License notes" value={asset.licenseNotes} />
              <Row
                label="Expires"
                value={expiryText(asset.rights.expiresAt, asset.rights.status)}
                warn={expired}
              />
              <Row
                label="Attribution"
                value={
                  asset.creditRequired
                    ? `Required — ${asset.creditLine || "missing credit line"}`
                    : "Not required"
                }
                warn={asset.creditRequired && !asset.creditLine}
                extra={
                  asset.creditLine ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(asset.creditLine);
                          toast({ title: "Credit line copied" });
                        } catch {
                          toast({
                            title: "Could not copy",
                            description: "Your browser blocked clipboard access.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <ClipboardCopy className="h-3 w-3" /> Copy credit
                    </Button>
                  ) : undefined
                }
              />
              <Row
                label="Used in"
                value={
                  usedIn.length
                    ? usedIn.map((s) => s.title).join(", ")
                    : "Not attached to any story"
                }
              />
            </dl>

            {usedIn.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Usage — jump to story
                </h4>
                <ul className="space-y-1.5">
                  {usedIn.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onOpenStory(s.id)}
                        title="Open this story on the Story Desk"
                        className="flex w-full items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-xs transition-colors hover:border-foreground/30 hover:bg-accent"
                      >
                        <DeskDot desk={s.desk} />
                        <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
                        <StatusBadge status={s.status} className="scale-90" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {datedLicense && (
              <div className="mt-4 rounded-lg border bg-muted/40 p-3">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <CalendarPlus className="h-3.5 w-3.5" /> License renewal
                </h4>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="renew-date" className="text-[11px] text-muted-foreground">
                      New expiry date
                    </Label>
                    <Input
                      id="renew-date"
                      type="date"
                      value={renewDate}
                      onChange={(e) => setRenewDate(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => setRenewDate(defaultRenewalDate())}
                    title="One year from today"
                  >
                    + 1 year
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => void doRenew()}
                    disabled={renewBusy || !renewDate || renewDate === (asset.rights.expiresAt ?? "").slice(0, 10)}
                  >
                    {renewBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    Renew
                  </Button>
                </div>
                <Input
                  value={renewNote}
                  onChange={(e) => setRenewNote(e.target.value)}
                  placeholder="Optional renewal note, appended to the license notes…"
                  className="mt-2 h-8 text-xs"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {expired
                    ? "Renewing re-clears the asset for handoff — attached stories will validate again."
                    : "Extends the current license window; the rights badge updates immediately."}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* attach flow */}
        {attachable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This asset is attached to every eligible story (published stories are locked).
          </p>
        ) : (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Attach to story
            </h4>
            {expired && (
              <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Attaching an expired asset is allowed for layout, but the Handoff Engine will block
                publication.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Story</Label>
                <Select value={storyId} onValueChange={setStoryId}>
                  <SelectTrigger aria-label="Choose a story">
                    <SelectValue placeholder="Choose a story…" />
                  </SelectTrigger>
                  <SelectContent>
                    {attachable.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attach-caption">Caption</Label>
                <Input
                  id="attach-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Editorial caption…"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attach-alt" className="flex items-center gap-1.5">
                Alt text
                <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  required for handoff
                </span>
              </Label>
              <Input
                id="attach-alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for screen readers…"
              />
              <p className="text-[11px] text-muted-foreground">
                The handoff validation blocks publication until every attached asset has one.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={asPrimary} onCheckedChange={(v) => setAsPrimary(v === true)} />
                Set as lead image
              </label>
              <Button onClick={doAttach} disabled={!storyId || busy}>
                {busy ? "Attaching…" : "Attach to Story"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  warn,
  extra,
}: {
  label: string;
  value: string;
  warn?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium leading-snug", warn ? "text-red-700 dark:text-red-400" : "")}>
        {value}
        {extra}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox — full-size view of an asset
// ---------------------------------------------------------------------------

function MediaLightbox({ asset, onClose }: { asset: MediaAssetDTO; onClose: () => void }) {
  const expired = asset.rights.status === "EXPIRED";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden bg-stone-950/95 p-3 text-stone-100 sm:p-4">
        <DialogHeader className="sr-only">
          <DialogTitle>{asset.title} — full size</DialogTitle>
          <DialogDescription>Full-size preview of {asset.title}</DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-0 flex-col gap-3">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-black/40">
            <MediaImage
              asset={asset}
              alt={asset.title}
              width={asset.width ?? 1600}
              height={asset.height ?? 1000}
              priority
              className={cn(
                "mx-auto max-h-[68vh] w-auto max-w-full bg-transparent object-contain",
                expired && "grayscale"
              )}
            />
            {expired && <div className="absolute inset-0 expired-hatch" />}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-1 pb-1 text-xs text-stone-300">
            <span className="font-headline text-sm font-semibold text-stone-50">{asset.title}</span>
            <span aria-hidden className="text-stone-500">·</span>
            <span>{asset.photographer}</span>
            {asset.width && asset.height && (
              <>
                <span aria-hidden className="text-stone-500">·</span>
                <span>
                  {asset.width}×{asset.height}
                </span>
              </>
            )}
            <span className="ml-auto flex items-center gap-2">
              <RightsBadge status={asset.rights.status} />
              {asset.creditRequired && asset.creditLine && (
                <span className="hidden max-w-[280px] truncate text-[11px] text-stone-400 sm:inline">
                  Credit: {asset.creditLine}
                </span>
              )}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bulk license renewal — extend several dated license windows in one action
// (mounted on open, working state initialized from props, no reset effects).
// ---------------------------------------------------------------------------

function BulkRenewDialog({
  candidates,
  onClose,
}: {
  candidates: MediaAssetDTO[];
  onClose: () => void;
}) {
  const bulkRenew = useNewsroom((s) => s.bulkRenewLicenses);
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.id))
  );
  const [renewDate, setRenewDate] = useState<string>(() => defaultRenewalDate());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const dateValid = !!renewDate && !Number.isNaN(new Date(`${renewDate}T12:00:00`).getTime());
  const allSelected = selected.size === candidates.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doRenew = async () => {
    if (!dateValid || selected.size === 0) return;
    setBusy(true);
    try {
      const d = new Date(`${renewDate}T12:00:00`);
      const renewed = await bulkRenew({
        mediaIds: Array.from(selected),
        expiresAt: d.toISOString(),
        note: note.trim() || undefined,
      });
      toast({
        title: `Renewed ${renewed.length} license${renewed.length > 1 ? "s" : ""}`,
        description: `Licensed through ${renewDate} — recorded in each asset's license notes.`,
      });
      onClose();
    } catch (e) {
      toast({
        title: "Bulk renewal failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Renew media licenses</DialogTitle>
          <DialogDescription>
            Extend the license window of dated assets in one go. Each renewal is recorded
            in the asset&rsquo;s license notes.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-slim max-h-[38vh] space-y-2 overflow-y-auto rounded-lg border bg-card/60 p-2">
          {candidates.map((asset) => {
            const checked = selected.has(asset.id);
            const expired = asset.rights.status === "EXPIRED";
            return (
              <label
                key={asset.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border p-2 transition-colors",
                  checked
                    ? "border-primary/40 bg-background shadow-sm"
                    : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(asset.id)}
                  aria-label={`Select ${asset.title} for renewal`}
                />
                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
                  <MediaImage
                    asset={asset}
                    alt={asset.title}
                    fill
                    sizes="64px"
                    className={cn("object-cover", expired && "grayscale")}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[13px] font-semibold leading-tight">
                    {asset.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {asset.photographer} · {asset.licenseType}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RightsBadge status={asset.rights.status} />
                  <span
                    className={cn(
                      "text-[10px]",
                      expired
                        ? "font-medium text-red-700 dark:text-red-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {expiryText(asset.rights.expiresAt, asset.rights.status)}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {selected.size} of {candidates.length} selected
          </span>
          <span className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
              disabled={allSelected}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              Clear
            </Button>
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-renew-date">New expiry date</Label>
            <Input
              id="bulk-renew-date"
              type="date"
              value={renewDate}
              onChange={(e) => setRenewDate(e.target.value)}
              aria-invalid={!dateValid}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-renew-note">Renewal note (optional)</Label>
            <Input
              id="bulk-renew-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Renewed with agency for the autumn election cycle"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={doRenew}
            disabled={busy || !dateValid || selected.size === 0}
            className="gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Renew {selected.size > 0 ? `${selected.size} ` : ""}license{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
