"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNewsroom } from "@/hooks/use-newsroom";
import type {
  HandoffDTO,
  HandoffResult,
  StoryDTO,
  ValidationResult,
  WebHandoffPayload,
} from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { suggestAltTextRequest } from "@/lib/newsroom/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  ArrowRightLeft,
  Accessibility,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Download,
  FileJson,
  GitCompareArrows,
  Images,
  ListChecks,
  Loader2,
  PenLine,
  ReceiptText,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { StatusBadge, fmtDateTime, fmtRelative, MediaImage } from "./ui-primitives";
import { ReplaceMediaDialog } from "./replace-media-dialog";
import { AltTextFixDialog } from "./alt-text-fix-dialog";
import {
  diffPayloads,
  type PayloadDiffRow,
} from "@/lib/newsroom/payload-diff";

// ---------------------------------------------------------------------------
// Handoff Engine
// ---------------------------------------------------------------------------

export function HandoffEngine({
  preselectedStoryId,
  onConsumePreselection,
  onOpenVault,
  onOpenStoryDesk,
  onOpenReceipt,
}: {
  preselectedStoryId: string | null;
  onConsumePreselection: () => void;
  onOpenVault: () => void;
  onOpenStoryDesk: (storyId: string) => void;
  onOpenReceipt: (ref: string) => void;
}) {
  const stories = useNewsroom((s) => s.stories);
  const handoffs = useNewsroom((s) => s.handoffs);
  const validatePublication = useNewsroom((s) => s.validatePublication);
  const prepareHandoff = useNewsroom((s) => s.prepareHandoff);
  const executeHandoff = useNewsroom((s) => s.executeHandoff);
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(preselectedStoryId);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [payload, setPayload] = useState<WebHandoffPayload | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState<HandoffResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [replaceMediaId, setReplaceMediaId] = useState<string | null>(null);
  const [altFixOpen, setAltFixOpen] = useState(false);
  const [diff, setDiff] = useState<PayloadDiffRow[] | null>(null);
  const [diffAgainst, setDiffAgainst] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(true);
  const [manifestOpen, setManifestOpen] = useState(true);

  // Accept preselection coming from the Story Desk
  useEffect(() => {
    if (preselectedStoryId) {
      setSelectedId(preselectedStoryId);
      onConsumePreselection();
    }
  }, [preselectedStoryId, onConsumePreselection]);

  const story = stories.find((s) => s.id === selectedId) ?? null;

  const expiredMediaId =
    story?.media.find((m) => m.media.rights.status === "EXPIRED")?.mediaId ?? null;

  const approved = useMemo(
    () => stories.filter((s) => s.status === "APPROVED"),
    [stories]
  );
  const others = useMemo(
    () => stories.filter((s) => s.status !== "APPROVED" && s.status !== "PUBLISHED"),
    [stories]
  );
  const publishedList = useMemo(
    () => stories.filter((s) => s.status === "PUBLISHED"),
    [stories]
  );

  const runValidation = async (storyId: string) => {
    setValidating(true);
    setPayload(null);
    setResult(null);
    setDiff(null);
    setDiffAgainst(null);
    try {
      const v = await validatePublication(storyId);
      setValidation(v);
    } catch (e) {
      toast({
        title: "Validation failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

  // Auto-validate whenever the selected story changes
  useEffect(() => {
    setValidation(null);
    setPayload(null);
    setResult(null);
    setDiff(null);
    setDiffAgainst(null);
    if (selectedId) void runValidation(selectedId);
  }, [selectedId]);

  const doPrepare = async () => {
    if (!story) return;
    setPreparing(true);
    try {
      // The server keeps the last prepared-but-undelivered payload per story,
      // so the diff works across reloads, new tabs and agent preparations.
      const { payload: p, previous } = await prepareHandoff(story.id);
      setPayload(p);
      setDiff(previous ? diffPayloads(previous.payload, p) : null);
      setDiffAgainst(previous?.handoffRef ?? null);
      setDiffOpen(true);
      toast({ title: "Publishing payload generated" });
    } catch (e) {
      toast({
        title: "Cannot generate payload",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPreparing(false);
    }
  };

  const doExecute = async () => {
    if (!story) return;
    setConfirmOpen(false);
    setExecuting(true);
    try {
      const r = await executeHandoff(story.id);
      setResult(r);
      if (r.ok) {
        toast({ title: `Handoff ${r.handoffRef} delivered to the web CMS` });
        if (r.handoffRef) onOpenReceipt(r.handoffRef);
      } else {
        toast({ title: "Handoff blocked", description: r.message, variant: "destructive" });
      }
    } catch (e) {
      toast({
        title: "Handoff failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="rise-in">
      <div className="mb-5">
        <h2 className="font-headline text-2xl font-bold">Handoff Engine</h2>
        <p className="text-sm text-muted-foreground">
          Validate an approved story, review the web payload, and hand off to the CMS.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ------------------------------------------------------ picker pane */}
        <section aria-label="Story picker" className="min-w-0 space-y-4 lg:col-span-2">
          <PickerGroup
            title="Approved — ready to hand off"
            emptyText="No approved stories right now."
            items={approved}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <PickerGroup
            title="Still in the workflow"
            emptyText=""
            items={others}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <PickerGroup
            title="Already published"
            emptyText=""
            items={publishedList}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {/* history */}
          <div className="rounded-lg border bg-card">
            <h3 className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recent handoffs ({handoffs.length})
            </h3>
            {handoffs.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No handoffs yet. Completed deliveries appear here.
              </p>
            ) : (
              <ul className="scrollbar-slim max-h-64 divide-y overflow-y-auto">
                {handoffs.map((h) => (
                  <HandoffHistoryItem
                    key={h.id}
                    handoff={h}
                    onOpenReceipt={onOpenReceipt}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------- workflow pane */}
        <section aria-label="Handoff workflow" className="min-w-0 lg:col-span-3">
          {!story ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card/50">
              <Send className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Select a story to validate and hand off.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* selected story header */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={story.status} />
                  <Badge variant="outline" className="text-xs">
                    {story.desk} desk
                  </Badge>
                  {story.media.some((m) => m.media.rights.status === "EXPIRED") && (
                    <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" /> expired media attached
                    </Badge>
                  )}
                </div>
                <h3 className="mt-2 font-headline text-xl font-bold leading-snug">
                  {story.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {story.media.length} media asset(s) · {story.wordCount} words · editor:{" "}
                  {story.assignee ?? "unassigned"}
                </p>
              </div>

              {/* step 1 — validate */}
              <StepCard
                step={1}
                title="Validate publication requirements"
                subtitle="Editorial status, assignment, copy quality and media rights."
                done={!!validation && validation.valid}
                blocked={!!validation && !validation.valid}
              >
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runValidation(story.id)}
                    disabled={validating}
                  >
                    {validating ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Validating…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Re-run Validation
                      </>
                    )}
                  </Button>
                  {validation && (
                    <span
                      className={cn(
                        "text-sm font-medium",
                        validation.valid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                      )}
                    >
                      {validation.valid
                        ? "All checks passed"
                        : `${validation.failedCheckIds.length} blocker(s) found`}
                    </span>
                  )}
                </div>

                {validation && (
                  <ul className="mt-3 space-y-2">
                    {validation.checks.map((c) => (
                      <li
                        key={c.id}
                        className={cn(
                          "flex items-start gap-2.5 rounded-md border p-2.5 text-sm",
                          c.status === "pass"
                            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/30"
                            : "border-red-200 bg-red-50/60 dark:border-red-800/60 dark:bg-red-950/30"
                        )}
                      >
                        {c.status === "pass" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                        )}
                        <div>
                          <p className="font-medium leading-tight">{c.label}</p>
                          <p
                            className={cn(
                              "mt-0.5 text-xs",
                              c.status === "pass" ? "text-emerald-800/80 dark:text-emerald-300/80" : "text-red-800 dark:text-red-300"
                            )}
                          >
                            {c.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {validation &&
                  !validation.valid &&
                  validation.failedCheckIds.includes("media-rights") && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                      <Images className="h-4 w-4 shrink-0" />
                      <span>Expired assets must be replaced with cleared images.</span>
                      <div className="ml-auto flex gap-1.5">
                        {expiredMediaId && story.status !== "PUBLISHED" && (
                          <Button
                            size="sm"
                            className="h-7 gap-1"
                            onClick={() => setReplaceMediaId(expiredMediaId)}
                          >
                            <ArrowRightLeft className="h-3 w-3" /> Replace expired media
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={onOpenVault}
                        >
                          Open Media Vault
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                {validation &&
                  !validation.valid &&
                  validation.failedCheckIds.includes("media-alt-text") && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                      <Accessibility className="h-4 w-4 shrink-0" />
                      <span>Every attached image needs a text alternative for screen readers.</span>
                      <div className="ml-auto flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 gap-1"
                          onClick={() => setAltFixOpen(true)}
                        >
                          <PenLine className="h-3 w-3" /> Fix alt text here
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => onOpenStoryDesk(story.id)}
                        >
                          Story Desk
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
              </StepCard>

              {/* step 2 — prepare payload */}
              <StepCard
                step={2}
                title="Generate the web publishing payload"
                subtitle="A structured JSON payload for the CMS, including media credits."
                done={!!payload}
                blocked={!validation?.valid}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={doPrepare}
                    disabled={!validation?.valid || validating || preparing || !!payload}
                  >
                    {preparing ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Building…
                      </>
                    ) : (
                      <>
                        <FileJson className="mr-1.5 h-3.5 w-3.5" /> Generate Payload
                      </>
                    )}
                  </Button>
                  {!validation?.valid && (
                    <span className="text-xs text-muted-foreground">
                      Resolve the blockers above to enable payload generation.
                    </span>
                  )}
                </div>

                {payload && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {payload.handoffRef}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        target: {payload.delivery.target}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {payload.media.length} media asset(s)
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {payload.story.wordCount} words
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7 gap-1 text-xs"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(JSON.stringify(payload, null, 2))
                            .then(() => toast({ title: "Payload copied to clipboard" }));
                        }}
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" /> Copy JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        title="Download the payload as a .json file"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(payload, null, 2)], {
                            type: "application/json",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${payload.handoffRef}.json`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                          toast({ title: `Payload ${payload.handoffRef} downloaded` });
                        }}
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                    </div>

                    {/* media manifest — pre-delivery alt-text editor */}
                    <PayloadMediaManifest
                      story={story}
                      payload={payload}
                      open={manifestOpen}
                      onToggle={() => setManifestOpen((v) => !v)}
                      onAltSaved={doPrepare}
                    />

                    <pre
                      className="payload-json scrollbar-slim max-h-80 overflow-auto rounded-lg border bg-stone-950 p-4 text-stone-100"
                      dangerouslySetInnerHTML={{
                        __html: highlightJson(JSON.stringify(payload, null, 2)),
                      }}
                    />
                    {diff && diffAgainst && (
                      <PayloadDiffPanel
                        rows={diff}
                        against={diffAgainst}
                        open={diffOpen}
                        onToggle={() => setDiffOpen((v) => !v)}
                      />
                    )}
                  </div>
                )}
              </StepCard>

              {/* step 3 — execute */}
              <StepCard
                step={3}
                title="Execute the web handoff"
                subtitle="Re-validates server-side, delivers the payload and publishes the story."
                done={result?.ok === true}
                blocked={result !== null && !result.ok}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!payload || executing}
                  >
                    {executing ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Handing off…
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-1.5 h-3.5 w-3.5" /> Execute Handoff
                      </>
                    )}
                  </Button>
                  {!payload && (
                    <span className="text-xs text-muted-foreground">
                      Generate and review the payload first.
                    </span>
                  )}
                </div>

                {result && (
                  <div
                    className={cn(
                      "mt-3 rounded-lg border p-4",
                      result.ok
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                        : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {result.ok ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                      <p
                        className={cn(
                          "font-semibold",
                          result.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                        )}
                      >
                        {result.ok ? `Handoff complete — ${result.handoffRef}` : "Handoff blocked"}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">{result.message}</p>
                    {result.ok && (
                      <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="inline text-muted-foreground">Delivered: </dt>
                          <dd className="inline font-medium">{fmtDateTime(result.deliveredAt)}</dd>
                        </div>
                        <div className="truncate">
                          <dt className="inline text-muted-foreground">Preview: </dt>
                          <dd className="inline font-mono text-[11px]">{result.previewUrl}</dd>
                        </div>
                      </dl>
                    )}
                    {result.ok && result.handoffRef && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onOpenReceipt(result.handoffRef!)}
                        >
                          <ReceiptText className="h-3.5 w-3.5" /> View receipt
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </StepCard>
            </div>
          )}
        </section>
      </div>

      {/* replace dialog — re-validate on success */}
      {replaceMediaId && story && (
        <ReplaceMediaDialog
          story={story}
          mediaId={replaceMediaId}
          open={replaceMediaId !== null}
          onOpenChange={(v) => {
            if (!v) setReplaceMediaId(null);
          }}
          onReplaced={() => {
            setPayload(null);
            setResult(null);
            setDiff(null);
            setDiffAgainst(null);
            if (selectedId) void runValidation(selectedId);
          }}
        />
      )}

      {/* bulk alt-text fix — re-validate on save */}
      {altFixOpen && story && (
        <AltTextFixDialog
          story={story}
          onClose={() => setAltFixOpen(false)}
          onFixed={() => {
            setPayload(null);
            setResult(null);
            setDiff(null);
            setDiffAgainst(null);
            if (selectedId) void runValidation(selectedId);
          }}
        />
      )}

      {/* confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">
              Execute web handoff?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The payload <span className="font-mono text-xs">{payload?.handoffRef}</span> will be
              delivered to the web CMS and <strong>{story?.title}</strong> will be marked Published.
              This is a simulated delivery — no external system is called.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doExecute}>Execute Handoff</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picker group
// ---------------------------------------------------------------------------

function PickerGroup({
  title,
  items,
  selectedId,
  onSelect,
  emptyText,
}: {
  title: string;
  items: Array<{ id: string; title: string; status: string; desk: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
}) {
  if (items.length === 0) {
    return emptyText ? (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      </div>
    ) : null;
  }
  return (
    <div className="rounded-lg border bg-card">
      <h3 className="border-b px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title} ({items.length})
      </h3>
      <ul className="divide-y">
        {items.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                selectedId === s.id ? "bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0",
                  selectedId === s.id ? "text-primary" : "text-transparent"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 font-headline text-sm font-semibold">
                  {s.title}
                </span>
                <span className="text-xs text-muted-foreground">{s.desk} desk</span>
              </span>
              <StatusBadge status={s.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

function StepCard({
  step,
  title,
  subtitle,
  done,
  blocked,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  done?: boolean;
  blocked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        blocked && "opacity-95"
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            done
              ? "bg-emerald-600 text-white"
              : blocked
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                : "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
          )}
        >
          {done ? <Check className="h-4 w-4" /> : step}
        </span>
        <div>
          <h3 className="font-headline text-base font-bold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History item
// ---------------------------------------------------------------------------

function HandoffHistoryItem({
  handoff,
  onOpenReceipt,
}: {
  handoff: HandoffDTO;
  onOpenReceipt: (ref: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-4 py-2.5">
      <div className="flex w-full items-center gap-2">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 font-mono text-[10px]",
              handoff.status === "SUCCESS"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
            )}
          >
            {handoff.handoffRef}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{handoff.storyTitle}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {fmtRelative(handoff.createdAt)}
          </span>
        </button>
        <button
          type="button"
          title={`Open the receipt for ${handoff.handoffRef}`}
          aria-label={`Open the receipt for ${handoff.handoffRef}`}
          onClick={() => onOpenReceipt(handoff.handoffRef)}
          className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ReceiptText className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <pre className="payload-json scrollbar-slim mt-2 max-h-48 overflow-auto rounded-md border bg-stone-950 p-3 text-stone-100">
          {JSON.stringify(handoff.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Payload media manifest — pre-delivery alt-text editor
// ---------------------------------------------------------------------------

const ALT_SUGGESTION_SOURCE_LABEL: Record<string, string> = {
  caption: "from caption",
  description: "from asset description",
  title: "from asset title",
};

function PayloadMediaManifest({
  story,
  payload,
  open,
  onToggle,
  onAltSaved,
}: {
  story: StoryDTO;
  payload: WebHandoffPayload;
  open: boolean;
  onToggle: () => void;
  /** Called after an alt text was saved — re-prepares the payload. */
  onAltSaved: () => Promise<void>;
}) {
  const updateAttachment = useNewsroom((s) => s.updateAttachment);
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [suggestion, setSuggestion] = useState<{ text: string; source: string } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // An alt in the payload is "inferred" when the editor never wrote one and the
  // payload fell back to the caption or the asset title.
  const attachmentFor = (mediaId: string) =>
    story.media.find((m) => m.mediaId === mediaId);

  const startEdit = (mediaId: string, currentAlt: string) => {
    setEditingId(mediaId);
    setDraft(currentAlt);
    setSuggestion(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
    setSuggestion(null);
  };

  const loadSuggestion = async (mediaId: string) => {
    setSuggesting(true);
    try {
      const r = await suggestAltTextRequest(story.id, mediaId);
      setDraft(r.suggestion);
      setSuggestion({ text: r.suggestion, source: r.source });
    } catch (e) {
      toast({
        title: "No suggestion available",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSuggesting(false);
    }
  };

  const saveAlt = async (mediaId: string) => {
    const value = draft.trim();
    if (!value) return;
    setSaving(true);
    try {
      await updateAttachment(story.id, mediaId, { altText: value });
      toast({ title: "Alt text saved", description: "Rebuilding the payload…" });
      cancelEdit();
      await onAltSaved();
    } catch (e) {
      toast({
        title: "Could not save alt text",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Accessibility review hint: an alt that verbatim duplicates the caption or
  // the asset title is an anti-pattern (screen readers announce the same string
  // twice, or announce a filename). Flag those for a quick rewrite before the
  // payload is delivered — the "Suggest" flow offers a real description.
  const duplicateSourceFor = (m: WebHandoffPayload["media"][number]) => {
    const att = attachmentFor(m.id);
    if (!att) return null;
    const alt = m.alt.trim().toLowerCase();
    if (att.caption?.trim().toLowerCase() === alt) return "caption";
    if (att.media.title.trim().toLowerCase() === alt) return "title";
    return null;
  };

  const flagged = payload.media
    .map((m) => duplicateSourceFor(m))
    .filter(Boolean).length;

  return (
    <div className="overflow-hidden rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-muted/60 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted"
      >
        <ListChecks className="h-3.5 w-3.5 text-primary" />
        Media manifest &amp; alt text
        {flagged > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <Accessibility className="h-2.5 w-2.5" />
            {flagged} duplicate{flagged > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <CheckCircle2 className="h-2.5 w-2.5" />
            all distinct
          </span>
        )}
        <ChevronRight className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <ul className="divide-y border-t">
          {payload.media.map((m) => {
            const duplicateSource = duplicateSourceFor(m);
            const flagged = duplicateSource !== null;
            const editing = editingId === m.id;
            return (
              <li key={m.id} className="flex gap-3 px-3 py-2.5">
                <div className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded-md border bg-muted">
                  <MediaImage
                    asset={{
                      url: m.url,
                      externalUrl: attachmentFor(m.id)?.media.externalUrl ?? null,
                    }}
                    alt={m.alt}
                    fill
                    sizes="72px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block rounded-sm px-1 py-px text-[9px] font-bold uppercase tracking-wide",
                        m.role === "primary"
                          ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {m.role}
                    </span>
                    <span className="min-w-0 truncate text-xs font-medium">{m.fileName}</span>
                    {duplicateSource && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        <Accessibility className="h-2.5 w-2.5" /> same as {duplicateSource}
                      </span>
                    )}
                  </div>

                  {editing ? (
                    <div className="mt-1.5 space-y-1.5">
                      <Textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        aria-label={`Alt text for ${m.fileName}`}
                        className="min-h-0 text-xs"
                        autoFocus
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-[11px]"
                          onClick={() => void loadSuggestion(m.id)}
                          disabled={suggesting}
                          title="Deterministic suggestion from the caption, asset description or title"
                        >
                          {suggesting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 text-primary" />
                          )}
                          Suggest
                        </Button>
                        <span className="text-[10px] text-muted-foreground">{draft.trim().length} chars</span>
                        <span className="ml-auto flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 gap-1 px-2 text-[11px]"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 gap-1 px-2 text-[11px]"
                            onClick={() => void saveAlt(m.id)}
                            disabled={saving || !draft.trim()}
                          >
                            {saving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Save &amp; rebuild
                          </Button>
                        </span>
                      </div>
                      {suggestion && (
                        <p className="text-[10px] text-muted-foreground">
                          Suggestion {ALT_SUGGESTION_SOURCE_LABEL[suggestion.source] ?? suggestion.source} —
                          edit freely before saving.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 flex items-start gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 text-[11px] leading-snug",
                          flagged
                            ? "text-amber-800 dark:text-amber-300"
                            : "text-muted-foreground"
                        )}
                      >
                        <span className="font-medium text-foreground">alt:</span> {m.alt}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 shrink-0 gap-1 px-2 text-[11px]"
                        onClick={() => startEdit(m.id, m.alt)}
                      >
                        <PenLine className="h-3 w-3" /> Edit
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payload diff panel — what changed vs the previous preparation
// ---------------------------------------------------------------------------

function PayloadDiffPanel({
  rows,
  against,
  open,
  onToggle,
}: {
  rows: PayloadDiffRow[];
  against: string;
  open: boolean;
  onToggle: () => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        No content changes vs previous preparation <span className="font-mono">{against}</span> — only
        the handoff reference was regenerated.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-muted/60 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted"
      >
        <GitCompareArrows className="h-3.5 w-3.5 text-primary" />
        {rows.length} field{rows.length === 1 ? "" : "s"} changed vs previous preparation
        <span className="font-mono text-[11px] text-muted-foreground">{against}</span>
        <ChevronRight
          className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {rows.map((r) => (
            <li key={r.path} className="grid gap-x-3 gap-y-0.5 px-3 py-2 text-xs sm:grid-cols-[minmax(140px,auto)_1fr]">
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                {r.path}
              </span>
              <span className="min-w-0 space-y-0.5">
                {r.before !== null && (
                  <span className="payload-diff-before block break-words font-mono text-[11px]">
                    − {r.before}
                  </span>
                )}
                {r.after !== null && (
                  <span className="payload-diff-after block break-words font-mono text-[11px]">
                    + {r.after}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny JSON syntax highlighter
// ---------------------------------------------------------------------------

function highlightJson(json: string): string {
  const esc = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "num";
      if (match.startsWith('"')) cls = match.trimEnd().endsWith(":") ? "key" : "str";
      else if (match === "true" || match === "false") cls = "bool";
      else if (match === "null") cls = "null";
      return `<span class="${cls}">${match}</span>`;
    }
  );
}
