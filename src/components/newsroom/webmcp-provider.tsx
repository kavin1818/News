"use client";

import { useEffect } from "react";
import { NEWSROOM_TOOLS } from "./webmcp-tools";

/**
 * Registers the newsroom WebMCP tools with the browser's model context
 * (`document.modelContext.registerTool`), making the application operable by
 * external browser agents. The page works exactly the same for humans when
 * the API is absent — registration is skipped silently in that case.
 */
export function WebMCPBridge() {
  useEffect(() => {
    const registry = document.modelContext;
    if (!registry || typeof registry.registerTool !== "function") {
      return;
    }

    // Expose the live tool surface for observability / QA (also used by the
    // "WebMCP" masthead affordance and automated verification):
    // - __NEWSROOM_WEBMCP_TOOLS__: ordered tool names
    // - __NEWSROOM_WEBMCP_HANDLES__: name -> RegisteredTool handle with .execute,
    //   so QA harnesses and agent operators can invoke a tool directly.
    const win = window as Record<string, unknown>;
    const registryNames = win.__NEWSROOM_WEBMCP_TOOLS__ as string[] | undefined;
    const liveRegistry: string[] = registryNames ?? [];
    const handles = (win.__NEWSROOM_WEBMCP_HANDLES__ as
      | Record<string, { execute: (input?: unknown) => Promise<unknown> }>
      | undefined) ?? {};
    win.__NEWSROOM_WEBMCP_TOOLS__ = liveRegistry;
    win.__NEWSROOM_WEBMCP_HANDLES__ = handles;

    const registered: string[] = [];
    for (const tool of NEWSROOM_TOOLS) {
      try {
        const result = registry.registerTool(tool) as
          | Promise<{ execute: (input?: unknown) => Promise<unknown> }>
          | undefined;
        registered.push(tool.name);
        if (!liveRegistry.includes(tool.name)) liveRegistry.push(tool.name);
        // Chromium currently resolves registerTool() to undefined (no
        // RegisteredTool handle exposed yet), so fall back to a wrapper around
        // the very same execute implementation. If a future build returns a
        // real handle, it takes precedence.
        void Promise.resolve(result)
          .then((handle) => {
            if (handle && typeof handle.execute === "function") {
              handles[tool.name] = handle;
            } else {
              handles[tool.name] = (input) => tool.execute(input ?? {});
            }
          })
          .catch(() => {
            handles[tool.name] = (input) => tool.execute(input ?? {});
          });
      } catch (err) {
        // A duplicate registration or a transient registry error should never
        // break the human-facing UI.
        console.warn(`WebMCP: could not register tool "${tool.name}"`, err);
        handles[tool.name] = (input) => tool.execute(input ?? {});
      }
    }

    return () => {
      if (typeof registry.removeTool === "function") {
        for (const name of registered) {
          try {
            registry.removeTool(name);
          } catch {
            /* ignore */
          }
        }
      }
      for (const name of registered) delete handles[name];
    };
  }, []);

  return null;
}
