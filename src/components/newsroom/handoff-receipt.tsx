"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import type { HandoffDTO, WebHandoffPayload } from "@/lib/newsroom/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BadgeCheck,
  ChevronRight,
  FileJson,
  Loader2,
  Printer,
  ReceiptText,
} from "lucide-react";
import { fmtDateTime } from "./ui-primitives";
import { fetchHandoffByRef } from "@/lib/newsroom/client";

/**
 * Shareable handoff receipt — a print-ready artifact for a delivered payload.
 * Opened from the execution result panel, from any history row, or directly
 * through the ?receipt=<ref> deep link so the exact delivery record can be
 * re-opened (and printed) by a colleague or an agent operator.
 */
export function HandoffReceiptDialog({
  handoffRef,
  onClose,
}: {
  handoffRef: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [handoff, setHandoff] = useState<HandoffDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    // Reset happens in the async body (not synchronously in the effect) so a
    // ref change refetches without the set-state-in-effect anti-pattern.
    fetchHandoffByRef(handoffRef)
      .then(({ handoff: h }) => {
        if (alive) {
          setHandoff(h);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [handoffRef]);

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-slim">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-headline">
              <ReceiptText className="h-4 w-4 text-primary" /> Handoff receipt
            </DialogTitle>
            <DialogDescription>
              Delivery record for <span className="font-mono text-xs">{handoffRef}</span> —
              print it, or share the link to this view.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
            </div>
          ) : error || !handoff ? (
            <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error ?? "Receipt not found."}
            </div>
          ) : (
            <ReceiptSheet handoff={handoff} jsonOpen={jsonOpen} onToggleJson={() => setJsonOpen((v) => !v)} />
          )}

          <div className="receipt-no-print flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(`${window.location.origin}/?view=handoff&receipt=${encodeURIComponent(handoffRef)}`)
                  .then(() => toast({ title: "Receipt link copied" }))
                  .catch(() => toast({ title: "Could not copy link", variant: "destructive" }));
              }}
            >
              Copy link
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print twin — portaled straight to <body> (no Radix chrome, no
          transforms) and hidden on screen. When the user prints with the
          receipt open, the print stylesheet hides everything except this
          branch, so the artifact flows cleanly onto paper. */}
      {handoff &&
        createPortal(
          <div className="receipt-print-only">
            <ReceiptSheet handoff={handoff} jsonOpen={false} onToggleJson={() => {}} />
          </div>,
          document.body
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The printed artifact itself — editorial sheet, survives @media print
// ---------------------------------------------------------------------------

function ReceiptSheet({
  handoff,
  jsonOpen,
  onToggleJson,
}: {
  handoff: HandoffDTO;
  jsonOpen: boolean;
  onToggleJson: () => void;
}) {
  const p = handoff.payload as unknown as WebHandoffPayload;
  const primary = p.media.find((m) => m.role === "primary");
  const supporting = p.media.filter((m) => m.role !== "primary");

  return (
    <div className="receipt-print-sheet rounded-lg border-2 border-stone-900 bg-white p-5 text-stone-900 shadow-sm dark:border-stone-300">
      {/* masthead */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-stone-900 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center bg-stone-900 font-headline text-lg font-bold text-white print:bg-black">
            M
          </span>
          <div>
            <p className="font-headline text-sm font-bold uppercase tracking-[0.18em]">
              The Meridian Ledger
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
              Web publishing receipt · simulated delivery
            </p>
          </div>
        </div>
        <span className="receipt-stamp flex rotate-2 items-center gap-1 rounded-sm border-2 border-emerald-700 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 print:border-green-800 print:text-green-800">
          <BadgeCheck className="h-3.5 w-3.5" /> Delivered
        </span>
      </div>

      {/* reference grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-stone-300 py-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-[9px] uppercase tracking-[0.16em] text-stone-500">Reference</dt>
          <dd className="font-mono text-[11px] font-bold">{handoff.handoffRef}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.16em] text-stone-500">Delivered</dt>
          <dd className="font-medium">{fmtDateTime(handoff.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.16em] text-stone-500">Target</dt>
          <dd className="font-mono text-[11px] font-medium">{handoff.target}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.16em] text-stone-500">Requested by</dt>
          <dd className="font-mono text-[11px] font-medium">{p.delivery.requestedBy}</dd>
        </div>
      </dl>

      {/* story summary */}
      <div className="border-b border-stone-300 py-3">
        <p className="text-[9px] uppercase tracking-[0.16em] text-stone-500">Story</p>
        <h3 className="mt-0.5 font-headline text-lg font-bold leading-snug">
          {p.story.headline}
        </h3>
        <p className="mt-1 text-xs italic text-stone-600">{p.story.standfirst}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-600">
          <span className="font-medium text-stone-800">{p.story.byline}</span>
          <span>{p.story.desk} desk · priority {p.story.priority}</span>
          <span>{p.story.wordCount} words</span>
          <span className="font-mono">/{p.story.slug}</span>
          {p.story.scheduledFor && (
            <span>Scheduled {fmtDateTime(p.story.scheduledFor)}</span>
          )}
        </div>
      </div>

      {/* media manifest */}
      <div className="border-b border-stone-300 py-3">
        <p className="text-[9px] uppercase tracking-[0.16em] text-stone-500">
          Media manifest ({p.media.length})
        </p>
        <table className="mt-1.5 w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-stone-300 text-[9px] uppercase tracking-[0.14em] text-stone-500">
              <th className="w-16 py-1 font-semibold">Role</th>
              <th className="py-1 font-semibold">Alt / caption</th>
              <th className="py-1 font-semibold">Credit</th>
              <th className="w-20 py-1 font-semibold">License</th>
            </tr>
          </thead>
          <tbody>
            {[primary, ...supporting].filter(Boolean).map((m) => (
              <tr key={m.id} className="border-b border-stone-200 align-top last:border-0">
                <td className="py-1.5 pr-2">
                  <span
                    className={cn(
                      "inline-block rounded-sm px-1 py-px text-[9px] font-bold uppercase tracking-wide",
                      m.role === "primary"
                        ? "bg-stone-900 text-white print:bg-black"
                        : "bg-stone-200 text-stone-700"
                    )}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="py-1.5 pr-2">
                  <span className="block font-medium">{m.alt}</span>
                  {m.caption && (
                    <span className="block text-[10px] text-stone-500">Caption: {m.caption}</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-[10px] text-stone-600">{m.credit}</td>
                <td className="py-1.5 text-[10px] text-stone-600">{m.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* delivery footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[10px] text-stone-500">
        <span className="font-mono">
          {p.sourceSystem} → {p.delivery.target} ({p.delivery.channel})
        </span>
        <span>Preview: {`https://cms.meridianledger.example/preview/${p.story.slug}`}</span>
      </div>
      <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-stone-400">
        · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
      </p>

      {/* payload appendix — screen only, collapsed by default */}
      <div className="receipt-no-print mt-3">
        <button
          type="button"
          onClick={onToggleJson}
          aria-expanded={jsonOpen}
          className="flex w-full items-center gap-1.5 rounded-md border bg-muted/60 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted"
        >
          <FileJson className="h-3.5 w-3.5 text-primary" />
          Delivered payload (JSON)
          <ChevronRight className={cn("ml-auto h-3.5 w-3.5 transition-transform", jsonOpen && "rotate-90")} />
        </button>
        {jsonOpen && (
          <pre className="payload-json scrollbar-slim mt-2 max-h-56 overflow-auto rounded-md border bg-stone-950 p-3 text-stone-100">
            {JSON.stringify(p, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
