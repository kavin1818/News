"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useNewsroom } from "@/hooks/use-newsroom";
import { useQueryParam } from "@/hooks/use-url-state";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Copy,
  FileText,
  Images,
  LayoutList,
  KanbanSquare,
  Moon,
  Send,
  Sun,
} from "lucide-react";
import { StatusDot, DeskDot } from "./ui-primitives";

type View = "desk" | "vault" | "handoff";

/**
 * Editorial command palette (Ctrl/Cmd+K): jump between sections, open any
 * story on the desk, open a vault asset, switch the desk layout, or toggle the
 * day/night edition. Story/asset jumps write URL params so the destination is
 * deep-linkable and the back button stays truthful.
 */
export function CommandPalette({
  open,
  onOpenChange,
  view,
  onView,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  view: View;
  onView: (v: View) => void;
}) {
  const stories = useNewsroom((s) => s.stories);
  const media = useNewsroom((s) => s.media);
  const { resolvedTheme, setTheme } = useTheme();
  const [, setStoryParam] = useQueryParam("story", "");
  const [, setLayoutParam] = useQueryParam("layout", "list");
  const [, setAssetParam] = useQueryParam("asset", "");
  const [, setViewParam] = useQueryParam("view", "desk");
  const [copied, setCopied] = useState(false);

  const run = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search stories & media…" />
      <CommandList className="scrollbar-slim">
        <CommandEmpty>No matching commands or records.</CommandEmpty>

        <CommandGroup heading="Sections">
          <CommandItem onSelect={() => run(() => onView("desk"))}>
            <FileText className="h-4 w-4 text-muted-foreground" />
            Story Desk
            <span className="ml-auto text-[11px] text-muted-foreground">{stories.length} stories</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onView("vault"))}>
            <Images className="h-4 w-4 text-muted-foreground" />
            Media Vault
            <span className="ml-auto text-[11px] text-muted-foreground">{media.length} assets</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onView("handoff"))}>
            <Send className="h-4 w-4 text-muted-foreground" />
            Handoff Engine
            <span className="ml-auto text-[11px] text-muted-foreground">
              {stories.filter((s) => s.status === "APPROVED").length} ready
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Jump to story">
          {stories.slice(0, 8).map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.title} ${s.desk} ${s.status}`}
              onSelect={() =>
                run(() => {
                  setStoryParam(s.id);
                  setLayoutParam("list");
                  setViewParam("desk");
                  onView("desk");
                })
              }
            >
              <DeskDot desk={s.desk} />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <StatusDot status={s.status} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Open vault asset">
          {media.slice(0, 6).map((m) => (
            <CommandItem
              key={m.id}
              value={`${m.title} ${m.photographer} ${m.source}`}
              onSelect={() =>
                run(() => {
                  setAssetParam(m.id);
                  setViewParam("vault");
                  onView("vault");
                })
              }
            >
              <Images className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{m.title}</span>
              <span className="text-[11px] text-muted-foreground">{m.photographer}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {view === "desk" ? (
            <CommandItem onSelect={() => run(() => setLayoutParam("board"))}>
              <KanbanSquare className="h-4 w-4 text-muted-foreground" />
              Switch desk to board view
              <span className="ml-auto text-[11px] text-muted-foreground">run order</span>
            </CommandItem>
          ) : (
            <CommandItem
              onSelect={() =>
                run(() => {
                  setLayoutParam("list");
                  setViewParam("desk");
                  onView("desk");
                })
              }
            >
              <LayoutList className="h-4 w-4 text-muted-foreground" />
              Open desk in list view
            </CommandItem>
          )}
          <CommandItem
            onSelect={() =>
              run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground" />
            )}
            Switch to {resolvedTheme === "dark" ? "day" : "night"} edition
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                void navigator.clipboard.writeText(window.location.href).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              })
            }
          >
            <Copy className="h-4 w-4 text-muted-foreground" />
            {copied ? "Link copied" : "Copy link to current view"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
