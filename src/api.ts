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

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
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
};
