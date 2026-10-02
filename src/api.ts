export interface Profile {
  customer_id: string;
  email: string;
  first_name: string;
  last_name: string;
  state: string;
  home_airport: string;
  loyalty_tier: "GOLD" | "PLATINUM" | "SILVER";
  marketing_consent: boolean;
  travel_intent_score: number;
  price_sensitivity_score: number;
  travel_intent_segment: string;
  intent_updated_at: string;
  audience?: Evaluation;
}

export interface JourneyEvent {
  event_id: string;
  customer_id: string;
  event_type: string;
  destination: string;
  session_id: string | null;
  occurred_at: string;
  source: "web" | "mobile" | "booking";
  first_name?: string;
  last_name?: string;
}

export interface Evaluation {
  qualifies: boolean;
  checks: { consent: boolean; intent: boolean; search: boolean; abandoned: boolean; completed: boolean };
  reasons: string[];
}

export interface AudienceResponse {
  rules: { asOf: string; searchDays: number; abandonDays: number; bookingDays: number };
  totalProfiles: number;
  qualifiedCount: number;
  excludedCount: number;
  qualifiedCustomerIds: string[];
  profiles: Profile[];
}

export interface DemoSource {
  source_id: string;
  file_name: string;
  display_name: string;
  record_type: string;
  xdm_class: string;
  record_count: number;
  loaded_at: string;
}

export interface Destination {
  id: "braze_mock" | "meta_mock" | "webhook_mock";
  name: string;
  type: string;
  mode: "simulation";
  description: string;
  icon: string;
}

export interface ActivationRun {
  activation_id: string;
  audience_name: string;
  destination_id: Destination["id"];
  destination_name: string;
  status: "simulated" | "failed";
  qualified_count: number;
  rules: { asOf: string; searchDays: number; abandonDays: number; bookingDays: number };
  pii_transferred: false;
  created_at: string;
}

export interface RuleSuggestion {
  supported: true;
  mode: "offline-demo-heuristic";
  requiresHumanReview: true;
  confidence: number;
  audienceName: string;
  rules: { asOf: string; searchDays: number; abandonDays: number; bookingDays: number };
  explanation: string[];
}

async function request<T>(url: string): Promise<T> {
  return send<T>(url);
}

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function queryString(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export const api = {
  health: () => request<{ status: string; database: string }>("/api/health"),
  dashboard: () => request<{ profileCount: number; eventCount: number; sourceCount: number; sources: DemoSource[] }>("/api/dashboard"),
  audience: (settings: { asOf: string; searchDays: number; abandonDays: number; bookingDays: number }) =>
    request<AudienceResponse>(`/api/audience?${queryString(settings)}`),
  profiles: (q = "") => request<{ items: Profile[]; total: number }>(`/api/profiles?${queryString({ q })}`),
  profile: (customerId: string) =>
    request<{ profile: Profile; events: JourneyEvent[] }>(`/api/profiles/${encodeURIComponent(customerId)}`),
  events: (q = "") => request<{ items: JourneyEvent[]; total: number }>(`/api/events?${queryString({ q })}`),
  sources: () => request<{ items: DemoSource[] }>("/api/sources"),
  destinations: () => request<{ items: Destination[]; liveConnections: false }>("/api/destinations"),
  activations: () => request<{ items: ActivationRun[]; total: number }>("/api/activations"),
  createActivation: (input: {
    destinationId: Destination["id"];
    audienceName: string;
    rules: { asOf: string; searchDays: number; abandonDays: number; bookingDays: number };
    confirmSimulation: true;
  }) => send<{ run: ActivationRun; message: string; liveConnection: false }>("/api/activations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }),
  suggestRules: (prompt: string, currentSettings: { asOf: string; searchDays: number; abandonDays: number; bookingDays: number }) =>
    send<RuleSuggestion>("/api/assistant/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, currentSettings }),
    }),
};
