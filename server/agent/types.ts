import type { AuthedRequest } from '../auth';
import type { OrgContext } from '../org';
import type { Area, LatLng } from '../geo';

/** What the browser tells the agent about the screen: map view, drawn area, selected place. */
export interface UiContext {
  bounds?: { low: LatLng; high: LatLng } | null;
  polygon?: LatLng[] | null;
  place?: { name: string; location: LatLng } | null;
  /** Radius of the circle drawn around `place` on the map. */
  radiusKm?: number | null;
  path?: string;
  /** The search tags the user has active in the sidebar. */
  tags?: string[];
  /** The businesses currently listed and pinned on screen (from a search the user or the agent ran). */
  results?: Array<{ placeId: string; name: string; address?: string; lat: number; lng: number; category?: string; website?: string; phone?: string; googleMapsUri?: string; region?: string }>;
  /** What the user has clicked: a business on the map, which may or may not be a saved client. */
  selected?: { name: string; address?: string; placeId?: string; clientId?: string } | null;
}

export interface Entity { id: string; name: string; kind: 'client' | 'place' }

export type UiAction =
  | { type: 'navigate'; to: string }
  | { type: 'draw_area'; path: LatLng[]; label?: string }
  | { type: 'focus_place'; name: string; lat: number; lng: number }
  | { type: 'show_places'; places: Array<{ id: string; name: string; address: string; lat: number; lng: number; category?: string; website?: string; placeId: string; region?: string }> }
  | { type: 'show_nearby'; clientIds: string[]; center: LatLng; radiusKm: number }
  | { type: 'open_route'; clientIds: string[]; routeId?: string; start?: { name: string; lat: number; lng: number } }
  | { type: 'highlight_memories'; ids: string[] };

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; id: string; name: string; status: 'running' | 'done' | 'error' | 'blocked'; summary?: string }
  | { type: 'proposal'; approval: { id: string; tool: string; summary: string; payload: any; bulk: boolean } }
  | { type: 'ui'; action: UiAction }
  | { type: 'memories'; items: Array<{ id: string; short: string; kind: string; content: string; verified: boolean; sourceUrl?: string | null }> }
  | { type: 'replace'; text: string; notVerified: number }
  | { type: 'done'; threadId: string; messageId: string }
  | { type: 'error'; message: string };

export interface RunState {
  runId: string;
  /** Places results held in memory for this run only; never written to the database. */
  results: Map<string, any>;
  /** Set when fetched text looked like an injection: only read tools may run for the rest of the run. */
  tainted: boolean;
  userMessage: string;
  /** Last area the agent drew or the user selected, so it can be saved as a zone. */
  lastArea?: LatLng[];
  /** Clients and places this conversation has touched, so "this client" and "them" keep their meaning next turn. */
  entities: Map<string, Entity>;
}

export interface ToolCtx {
  req: AuthedRequest;
  org: OrgContext;
  ui: UiContext;
  state: RunState;
  emit: (e: AgentEvent) => void;
}

export interface ToolResult {
  /** What the model sees. */
  data: unknown;
  ui?: UiAction[];
  /** Write tools return a proposal instead of changing anything. */
  proposal?: { summary: string; payload: any; bulk?: boolean };
  /** True when `data` contains text from outside (web, maps, files). */
  untrusted?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  write: boolean;
  run(args: any, ctx: ToolCtx): Promise<ToolResult>;
  /** Runs after the user approves the proposal. */
  apply?(payload: any, ctx: Pick<ToolCtx, 'req' | 'org'>): Promise<{ message: string; ui?: UiAction[] }>;
}

export type { Area, LatLng };
