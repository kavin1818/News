/**
 * Minimal TypeScript surface for the WebMCP browser API
 * (https://webmachinelearning.github.io/webmcp/).
 *
 * At runtime we only rely on `document.modelContext.registerTool(...)`,
 * which this app uses to expose newsroom capabilities to external
 * browser agents. When the API is not present, everything is skipped
 * silently and the app keeps working for humans.
 */

export {};

declare global {
  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    execute?: (input: Record<string, unknown>) => unknown | Promise<unknown>;
  }

  interface ModelContextRegistry {
    registerTool: (tool: ModelContextTool) => void;
    removeTool?: (name: string) => void;
    tools?: Map<string, ModelContextTool>;
    addEventListener?: (
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => void;
    removeEventListener?: (
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => void;
  }

  interface Document {
    modelContext?: ModelContextRegistry;
  }
}
