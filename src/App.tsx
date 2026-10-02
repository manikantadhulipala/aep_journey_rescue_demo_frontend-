import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, CircleHelp,
  Database, Globe2, Layers3, MapPin, Menu, Plane, RefreshCw, Search, Send, ShieldCheck,
  Sparkles, Users, X, Zap,
} from "lucide-react";
import { api, type ActivationRun, type AudienceResponse, type DemoSource, type Destination, type JourneyEvent, type Profile, type RuleSuggestion } from "./api";

type Page = "overview" | "audience" | "activation" | "profiles" | "journey" | "sources";
type Settings = { asOf: string; searchDays: number; abandonDays: number; bookingDays: number };

const NAV: { id: Page; label: string; icon: typeof Layers3 }[] = [
  { id: "overview", label: "Overview", icon: Layers3 },
  { id: "audience", label: "Audience builder", icon: Users },
  { id: "activation", label: "Activation", icon: Send },
  { id: "profiles", label: "Profiles", icon: BadgeCheck },
  { id: "journey", label: "Journey events", icon: Activity },
  { id: "sources", label: "Sources & schemas", icon: Database },
];

const INITIAL_SETTINGS: Settings = { asOf: "2026-09-30", searchDays: 14, abandonDays: 14, bookingDays: 7 };

function initials(profile: Pick<Profile, "first_name" | "last_name">) {
  return `${profile.first_name[0] ?? ""}${profile.last_name[0] ?? ""}`.toUpperCase();
}

function tierClass(tier: Profile["loyalty_tier"]) {
  return tier.toLowerCase();
}

function eventTitle(type: string) {
  return type.replaceAll("_", " ");
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function eventDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  });
}

function Avatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  return <span className={`avatar ${large ? "avatar-large" : ""} avatar-${Number(profile.customer_id.slice(-1)) % 4}`}>{initials(profile)}</span>;
}

function PageTitle({ eyebrow, title, subtitle, action }: {
  eyebrow: string; title: string; subtitle: string; action?: ReactNode;
}) {
  return <div className="page-title"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span><Search size={17} /></span><strong>{title}</strong><p>{detail}</p></div>;
}

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [audience, setAudience] = useState<AudienceResponse | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activationRuns, setActivationRuns] = useState<ActivationRun[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<Destination["id"]>("braze_mock");
  const [activationPending, setActivationPending] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("Travelers who searched and abandoned in the last 14 days, excluding anyone who booked in the last 7 days.");
  const [suggestion, setSuggestion] = useState<RuleSuggestion | null>(null);
  const [assistantPending, setAssistantPending] = useState(false);
  const [dashboard, setDashboard] = useState<{ profileCount: number; eventCount: number; sourceCount: number; sources: DemoSource[] } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<{ profile: Profile; events: JourneyEvent[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.dashboard(), api.profiles(), api.events(), api.audience(INITIAL_SETTINGS), api.destinations(), api.activations()])
      .then(([summary, profileResponse, eventResponse, audienceResponse, destinationResponse, activationResponse]) => {
        if (!alive) return;
        setDashboard(summary);
        setProfiles(profileResponse.items);
        setEvents(eventResponse.items);
        setAudience(audienceResponse);
        setDestinations(destinationResponse.items);
        setActivationRuns(activationResponse.items);
        setError("");
      })
      .catch((caught: unknown) => {
        if (alive) setError(caught instanceof Error ? caught.message : "The demo API could not be reached.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setRefreshing(true);
    api.audience(settings)
      .then((result) => { if (alive) { setAudience(result); setError(""); } })
      .catch((caught: unknown) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Audience evaluation failed.");
      })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [settings]);

  useEffect(() => {
    let alive = true;
    api.profiles(profileSearch)
      .then((result) => { if (alive) setProfiles(result.items); })
      .catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Profiles could not be loaded."); });
    return () => { alive = false; };
  }, [profileSearch]);

  useEffect(() => {
    let alive = true;
    api.events(eventSearch)
      .then((result) => { if (alive) setEvents(result.items); })
      .catch((caught: unknown) => { if (alive) setError(caught instanceof Error ? caught.message : "Events could not be loaded."); });
    return () => { alive = false; };
  }, [eventSearch]);

  const qualifiedProfiles = useMemo(
    () => audience?.profiles.filter((profile) => profile.audience?.qualifies) ?? [],
    [audience],
  );
  const visibleQualified = useMemo(() => qualifiedProfiles.filter((profile) =>
    `${profile.first_name} ${profile.last_name} ${profile.customer_id} ${profile.loyalty_tier}`.toLowerCase().includes(profileSearch.toLowerCase())),
  [profileSearch, qualifiedProfiles]);

  async function inspectProfile(profile: Profile) {
    try {
      const details = await api.profile(profile.customer_id);
      const evaluation = audience?.profiles.find((entry) => entry.customer_id === profile.customer_id)?.audience;
      setSelectedProfile({
        profile: { ...details.profile, audience: evaluation },
        events: details.events,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Profile details could not be loaded.");
    }
  }

  async function requestSuggestion() {
    setAssistantPending(true);
    setSuggestion(null);
    try {
      setSuggestion(await api.suggestRules(assistantPrompt, settings));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rule suggestion failed.");
    } finally {
      setAssistantPending(false);
    }
  }

  async function runActivation() {
    setActivationPending(true);
    try {
      const result = await api.createActivation({
        destinationId: selectedDestination,
        audienceName: "Journey Rescue — High-Intent Abandoners",
        rules: settings,
        confirmSimulation: true,
      });
      setActivationRuns((current) => [result.run, ...current]);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Activation simulation failed.");
    } finally {
      setActivationPending(false);
    }
  }

  function updateSetting(key: keyof Settings, value: string) {
    setSettings((current) => ({ ...current, [key]: key === "asOf" ? value : Math.max(1, Math.min(365, Number(value) || 1)) }));
  }

  function navigate(next: Page) {
    setPage(next);
    setMobileNav(false);
    setSelectedProfile(null);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate("overview"); }}>
          <span className="brand-icon">✳</span><span><strong>northstar</strong><small>TRAVEL PLATFORM</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className="sandbox-switch"><span className="online-dot" /><span><strong>Journey Rescue</strong><small>DEMO SANDBOX</small></span><ChevronDown size={14} /></button>
        <div className="nav-label">ACTIVATION</div>
        <nav className="nav-list" aria-label="Main navigation">
          {NAV.slice(0, 3).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
              {id === "audience" && audience && <small>{audience.qualifiedCount}</small>}
            </button>
          ))}
        </nav>
        <div className="nav-label data-nav-label">DATA MANAGEMENT</div>
        <nav className="nav-list" aria-label="Data management navigation">
          {NAV.slice(3).map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-note"><Sparkles size={14} /><span><strong>Practice environment</strong><small>Synthetic data · No live AEP connection</small></span></div>
          <div className="user-card"><span className="user-avatar">JD</span><span><strong>Jordan Demo</strong><small>Workspace owner</small></span><span className="user-menu">•••</span></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav((open) => !open)} aria-label="Open navigation"><Menu size={18} /></button>
          <div className="breadcrumbs"><span>Journey Rescue</span><span>/</span><strong>{NAV.find((item) => item.id === page)?.label}</strong></div>
          <div className="topbar-right"><span className="env-pill"><i /> Development</span><button className="help-button" aria-label="Help"><CircleHelp size={16} /></button><span className="user-avatar top-avatar">JD</span></div>
        </header>

        {error && <div className="error-banner"><span><ShieldCheck size={16} /></span><div><strong>{loading ? "API connection needed" : "Could not refresh demo data"}</strong><small>{error}. Start PostgreSQL, migrate and seed the API; see README for the run steps.</small></div><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
        {loading && !dashboard && !error && <div className="loading-line"><span />Connecting to the demo API…</div>}

        {page === "overview" && (
          <section className="page-content">
            <PageTitle eyebrow="AUDIENCE WORKSPACE · DEMO" title="Journey Rescue" subtitle="Bring high-intent travelers back to the booking journey." action={<button className="primary-button" onClick={() => navigate("audience")}><Users size={15} /> Open audience builder <ArrowRight size={15} /></button>} />
            <div className="welcome-banner"><div className="welcome-icon"><Sparkles size={16} /></div><div><strong>Demo mode</strong><span>Live preview over synthetic CRM, web, mobile, and booking data.</span></div><small>AS OF <b>{new Date(`${settings.asOf}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" }).toUpperCase()}</b></small></div>
            <div className="stats-grid">
              <StatCard icon={<Users size={16} />} tone="mint" label="QUALIFIED PROFILES" value={audience?.qualifiedCount} note="Match every audience rule" />
              <StatCard icon={<BadgeCheck size={16} />} tone="violet" label="PROFILE RECORDS" value={dashboard?.profileCount} note="Customer identities unified" />
              <StatCard icon={<Activity size={16} />} tone="blue" label="JOURNEY EVENTS" value={dashboard?.eventCount} note="Web · mobile · booking" />
              <StatCard icon={<Database size={16} />} tone="amber" label="DATA SOURCES" value={dashboard?.sourceCount} note="CSV sources loaded locally" />
            </div>
            <div className="section-head"><div><h2>Audience performance</h2><p>Rule qualification across the current synthetic profile set</p></div><button className="link-button" onClick={() => navigate("audience")}>Explore audience <ArrowRight size={14} /></button></div>
            <div className="dashboard-grid">
              <article className="surface qualification-card">
                <div className="surface-head"><div><h3>Qualification breakdown</h3><p>Profiles passing all current rules</p></div><span className="soft-tag">10 PROFILES</span></div>
                <div className="qualification-body"><div className="donut" style={{ background: `conic-gradient(#257d5c ${dashboard?.profileCount ? (audience?.qualifiedCount ?? 0) / dashboard.profileCount * 100 : 0}%, #e8efeb 0)` }}><div><strong>{audience?.qualifiedCount ?? "—"}</strong><small>QUALIFIED</small></div></div><div className="legend"><div><i className="legend-green" />Qualified audience<strong>{audience?.qualifiedCount ?? "—"}</strong></div><div><i className="legend-gray" />Did not qualify<strong>{audience?.excludedCount ?? "—"}</strong></div><p>All profiles evaluated as of {shortDate(`${settings.asOf}T00:00:00Z`)}, UTC.</p></div></div>
                <button className="rule-peek" onClick={() => navigate("audience")}><span><Check size={14} /></span><span><strong>Consent · intent · journey · suppression</strong><small>Five conditions across profile and event data</small></span><ArrowRight size={15} /></button>
              </article>
              <article className="surface preview-card">
                <div className="surface-head"><div><h3>In this audience</h3><p>Recently qualified travelers</p></div><span className="preview-tag"><i /> PREVIEW</span></div>
                <div className="preview-list">{qualifiedProfiles.slice(0, 4).map((profile) => {
                  const abandon = events.find((event) => event.customer_id === profile.customer_id && event.event_type === "booking_abandoned");
                  return <button className="preview-row" key={profile.customer_id} onClick={() => void inspectProfile(profile)}><Avatar profile={profile} /><span><strong>{profile.first_name} {profile.last_name}</strong><small>{profile.loyalty_tier} · Intent {Number(profile.travel_intent_score).toFixed(2)}</small></span><small className="destination">{abandon?.destination ?? "—"}</small></button>;
                })}{!qualifiedProfiles.length && <EmptyState title="No profiles in this audience" detail="Adjust the audience rule windows to explore the demo." />}</div>
                <button className="secondary-button full-button" onClick={() => navigate("audience")}>View all qualified profiles <ArrowRight size={14} /></button>
              </article>
            </div>
            <div className="section-head sources-head"><div><h2>Data flowing in</h2><p>Five source files unified by customer identity</p></div><button className="link-button" onClick={() => navigate("sources")}>Explore data model <ArrowRight size={14} /></button></div>
            <div className="source-cards">{(dashboard?.sources ?? []).map((source) => <SourceMini key={source.source_id} source={source} />)}</div>
            <div className="privacy-line"><ShieldCheck size={14} />All records are synthetic. This demo has no live AEP connection and sends no data to destinations.</div>
          </section>
        )}

        {page === "audience" && (
          <section className="page-content">
            <PageTitle eyebrow="SEGMENTATION" title="Audience builder" subtitle="Define and preview a consent-aware travel recovery audience." action={<button className="secondary-button" onClick={() => setSettings({ ...INITIAL_SETTINGS })}><RefreshCw size={14} /> Reset preview</button>} />
            <div className="audience-banner"><div className="audience-mark">◎</div><div><small>AUDIENCE NAME</small><h2>Journey Rescue — High-Intent Abandoners</h2><p>Local PostgreSQL evaluation <i>·</i> synthetic profile data</p></div><div className="audience-count"><strong>{audience?.qualifiedCount ?? "—"}</strong><small>QUALIFIED PROFILES</small></div></div>
            <div className="audience-layout">
              <div className="left-stack">
                <article className="surface rule-surface">
                  <div className="surface-head"><div><span className="overline">AUDIENCE RULES</span><h3>Who should be included?</h3></div><span className="soft-tag">5 CONDITIONS</span></div>
                  <Rule number="01" kind="Profile" title="Marketing consent" operator="is" value="true" note="Respect customer permission before including a profile." />
                  <Connector />
                  <div className="rule-block"><span className="rule-num">02</span><div className="rule-copy"><div className="rule-expression"><Tag>Profile</Tag><b>Loyalty tier</b><span>is</span><Tag variant="sand">GOLD or PLATINUM</Tag></div><div className="or-divider"><span>OR</span></div><div className="rule-expression"><Tag>Profile</Tag><b>Travel intent score</b><span>is at least</span><Tag variant="violet">0.80</Tag></div><small>Include a valued loyalty member or a traveler with a high intent score.</small></div></div>
                  <Connector />
                  <Rule number="03" kind="Event" title="Flight search" operator="occurred in last" note="At least one recent search shows active travel consideration." control={<DayInput value={settings.searchDays} onChange={(value) => updateSetting("searchDays", value)} label="Search lookback days" />} />
                  <Connector />
                  <Rule number="04" kind="Event" title="Booking abandoned" operator="occurred in last" note="The traveler left the funnel before completing the reservation." control={<DayInput value={settings.abandonDays} onChange={(value) => updateSetting("abandonDays", value)} label="Abandon lookback days" />} />
                  <Connector />
                  <Rule number="05" kind="Event" title="Booking completed" operator="occurred in last" negative note="Suppress recent bookers so recovery messages stay relevant." control={<DayInput value={settings.bookingDays} onChange={(value) => updateSetting("bookingDays", value)} label="Booking exclusion days" />} />
                  <div className="rule-foot"><span><CircleHelp size={13} /> Preview updates whenever you change a setting.</span><span>Evaluated by the API</span></div>
                </article>
                <article className="surface table-surface">
                  <div className="surface-head"><div><h3>Qualified profiles <span className="counter">{audience?.qualifiedCount ?? "—"}</span></h3><p>Profiles that pass each condition</p></div><label className="search-field"><Search size={14} /><input value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Search audience" /></label></div>
                  <ProfileTable profiles={visibleQualified} mode="audience" onInspect={(profile) => void inspectProfile(profile)} />
                </article>
              </div>
              <aside className="right-stack">
                <article className="surface settings-surface"><div className="surface-head"><div><h3>Preview settings</h3><p>Choose evaluation anchor date</p></div><CalendarDays size={17} /></div><label className="input-label">Evaluate as of<input type="date" value={settings.asOf} onChange={(event) => updateSetting("asOf", event.target.value)} /></label><p className="helper-copy">The provided CSV events are dated in September 2026. This date reproduces the expected demo audience.</p><div className="mini-metrics"><span>Qualified profiles</span><strong>{audience?.qualifiedCount ?? "—"}</strong><span>Excluded profiles</span><strong>{audience?.excludedCount ?? "—"}</strong></div><div className="local-indicator"><i />{refreshing ? "Re-evaluating…" : "Connected to local API"}</div></article>
                <article className="surface assistant-card"><div className="surface-head"><div><span className="overline">ASSISTED SEGMENTATION</span><h3 className="assistant-title"><Sparkles size={13} /> Draft rules from a brief</h3></div><span className="demo-ai-tag">OFFLINE DEMO</span></div><p>This deterministic sample assistant extracts travel lookback windows; it does not call an AI model.</p><textarea value={assistantPrompt} onChange={(event) => setAssistantPrompt(event.target.value)} rows={3} aria-label="Describe your travel audience" /><button className="secondary-button assistant-button" disabled={assistantPending || assistantPrompt.trim().length < 5} onClick={() => void requestSuggestion()}>{assistantPending ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}{assistantPending ? "Drafting…" : "Draft audience rules"}</button>{suggestion && <div className="suggestion-result">{suggestion.explanation.map((line) => <small key={line}>{line}</small>)}<button className="link-button" onClick={() => { setSettings(suggestion.rules); setSuggestion(null); }}>Apply suggested windows <ArrowRight size={13} /></button></div>}</article>
                <article className="surface identity-card"><div className="identity-title"><span><Zap size={15} /></span><div><h3>Identity stitching</h3><p>One join key across each source</p></div></div><div className="identity-flow"><b>CRM</b><i>+</i><b>WEB</b><i>+</i><b>APP</b><ArrowRight size={14} /><code>customer_id</code></div><p>For an AEP implementation, map <code>customer_id</code> to the same identity namespace on each schema.</p></article>
                <article className="quote-card"><Sparkles size={15} /><div><b>Interview talking point</b><p>“I joined profile attributes and timestamped journey events on a stable customer identity, then applied consent and booking suppression before creating the audience.”</p></div></article>
              </aside>
            </div>
          </section>
        )}

        {page === "activation" && (
          <section className="page-content">
            <PageTitle eyebrow="AUDIENCE ACTIVATION" title="Activation" subtitle="Preview a privacy-aware audience handoff to downstream systems." />
            <div className="simulation-banner"><ShieldCheck size={16} /><span><b>Simulation only</b><small>No destination is connected. This stores a count-only run in PostgreSQL and sends no profiles or identifiers.</small></span></div>
            <div className="activation-layout">
              <div className="left-stack">
                <article className="surface destination-surface"><div className="surface-head"><div><h3>Choose a destination</h3><p>Demo connectors illustrate the activation workflow, not live integrations.</p></div><span className="soft-tag">3 SIMULATIONS</span></div><div className="destination-list">{destinations.map((destination) => <button key={destination.id} className={`destination-option ${selectedDestination === destination.id ? "selected" : ""}`} onClick={() => setSelectedDestination(destination.id)}><span className="destination-symbol">{destination.icon}</span><span><b>{destination.name}</b><small>{destination.type} · {destination.description}</small></span><i>{selectedDestination === destination.id ? <Check size={13} /> : null}</i></button>)}</div></article>
                <article className="surface activation-history"><div className="surface-head"><div><h3>Activation run history</h3><p>Run metadata only · no customer identifiers are stored</p></div><span className="counter">{activationRuns.length}</span></div>{activationRuns.length ? <div className="run-list">{activationRuns.map((run) => <div className="run-row" key={run.activation_id}><span className="run-status"><Check size={12} /></span><span><b>{run.destination_name}</b><small>{run.qualified_count} profiles · {new Date(run.created_at).toLocaleString()}</small></span><span className="simulated-badge">SIMULATED</span></div>)}</div> : <EmptyState title="No activation runs yet" detail="Choose a destination and simulate an audience handoff." />}</article>
              </div>
              <aside className="right-stack"><article className="surface activation-summary"><div className="surface-head"><div><h3>Ready to simulate?</h3><p>Current audience snapshot</p></div><Send size={15} /></div><div className="activation-count"><strong>{audience?.qualifiedCount ?? "—"}</strong><small>QUALIFIED PROFILES</small></div><div className="activation-detail"><span>Audience</span><b>Journey Rescue — High-Intent Abandoners</b><span>Destination</span><b>{destinations.find((item) => item.id === selectedDestination)?.name ?? "Loading destinations"}</b><span>Privacy</span><b>Count-only metadata · no PII</b></div><button className="primary-button activation-button" disabled={activationPending || !audience?.qualifiedCount || destinations.length === 0} onClick={() => void runActivation()}>{activationPending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}{activationPending ? "Simulating…" : "Run activation simulation"}</button><small className="activation-warning">No data is sent outside this application.</small></article><article className="quote-card"><ShieldCheck size={15} /><div><b>Production design consideration</b><p>A live connector should validate consent and identifier mappings, use idempotent jobs, and audit each handoff without logging unnecessary PII.</p></div></article></aside>
            </div>
          </section>
        )}

        {page === "profiles" && (
          <section className="page-content">
            <PageTitle eyebrow="UNIFIED CUSTOMER PROFILE" title="Profiles" subtitle="Inspect the synthetic customer records and their audience eligibility." />
            <article className="surface table-surface directory-surface"><div className="surface-head"><div><h3>Customer profiles <span className="counter">{profiles.length}</span></h3><p>Unified identity key: <code>customer_id</code></p></div><label className="search-field"><Search size={14} /><input value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Search name, ID, airport" /></label></div><ProfileTable profiles={profiles.map((profile) => ({ ...profile, audience: audience?.profiles.find((entry) => entry.customer_id === profile.customer_id)?.audience }))} mode="directory" onInspect={(profile) => void inspectProfile(profile)} /></article>
            {selectedProfile ? <ProfileInspector profile={selectedProfile.profile} events={selectedProfile.events} /> : <div className="inspector-prompt"><Users size={17} /><b>Select a customer row</b><span>See their merged profile attributes and event history.</span></div>}
          </section>
        )}

        {page === "journey" && (
          <section className="page-content">
            <PageTitle eyebrow="XDM EXPERIENCE EVENTS" title="Journey events" subtitle="Explore timestamped activity across web, mobile and completed bookings." action={<label className="search-field event-search"><Search size={14} /><input value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Search events" /></label>} />
            <div className="stats-grid event-stats"><StatCard icon={<Globe2 size={16} />} tone="blue" label="WEB EVENTS" value={dashboard?.sources.find((source) => source.source_id === "web")?.record_count} note="Search, view & abandon" /><StatCard icon={<Activity size={16} />} tone="violet" label="MOBILE EVENTS" value={dashboard?.sources.find((source) => source.source_id === "mobile")?.record_count} note="App and offer engagement" /><StatCard icon={<Plane size={16} />} tone="mint" label="COMPLETED BOOKINGS" value={dashboard?.sources.find((source) => source.source_id === "bookings")?.record_count} note="Conversion and suppression" /></div>
            <article className="surface stream-surface"><div className="surface-head"><div><h3>Unified event stream</h3><p>Newest first · all timestamps displayed in UTC</p></div><span className="soft-tag">SYNTHETIC DATA</span></div><EventStream events={events} profiles={audience?.profiles ?? []} onInspect={(profile) => void inspectProfile(profile)} /></article>
          </section>
        )}

        {page === "sources" && (
          <section className="page-content">
            <PageTitle eyebrow="DATA MANAGEMENT" title="Sources & schemas" subtitle="Understand how the source files map to an AEP-style data model." action={<span className="env-pill"><i /> Local CSV + PostgreSQL</span>} />
            <div className="source-grid">{(dashboard?.sources ?? []).map((source) => <SourceCard key={source.source_id} source={source} />)}</div>
            <div className="schema-layout"><article className="surface schema-surface"><div className="surface-head"><div><h3>Schema &amp; dataset mapping</h3><p>Recommended XDM classes for this practice project</p></div></div><div className="schema-rows">{(dashboard?.sources ?? []).map((source) => <div className="schema-row" key={source.source_id}><span className="file-name"><Database size={14} />{source.file_name}</span><span>{source.record_type}</span><span className={`xdm-badge ${source.record_type.includes("Experience") ? "event-xdm" : ""}`}>{source.xdm_class}</span><span className="identity-field">customer_id</span></div>)}</div></article>
              <article className="surface identity-surface"><div className="surface-head"><div><h3>Identity strategy</h3><p>Join profile and event data</p></div></div><div className="identity-diagram"><div><small>PROFILE DATA</small><b>CRM + intent</b><span>XDM Individual Profile</span></div><div><small>EVENT DATA</small><b>Web + app + booking</b><span>XDM ExperienceEvent</span></div><div className="join-key"><code>customer_id</code><small>Shared identity key</small></div><div className="unified"><BadgeCheck size={16} /><b>Unified customer profile</b><span>Attributes + journey history</span></div></div><p className="aep-note"><CircleHelp size={14} />This project stores demo records in PostgreSQL. In Adobe Experience Platform, create the schemas and datasets in a development sandbox, set identity and Profile options, then ingest these synthetic CSVs.</p></article></div>
            <article className="surface field-surface"><div className="surface-head"><div><h3>Fields used by audience rules</h3><p>Profile attributes joined to event behavior</p></div></div><div className="field-grid">{[["customer_id", "Identity · shared join key"], ["marketing_consent", "CRM · boolean eligibility"], ["loyalty_tier", "CRM · loyalty qualification"], ["travel_intent_score", "Enrichment · threshold ≥ 0.80"], ["event_type", "ExperienceEvent · action type"], ["occurred_at", "ExperienceEvent · lookback window"], ["destination", "Journey event · trip context"], ["session_id", "Web/mobile · session link"]].map(([field, description]) => <div key={field}><code>{field}</code><span>{description}</span></div>)}</div></article>
          </section>
        )}

        <footer className="footer"><span>Journey Rescue · synthetic AEP audience demo</span><span><i /> Backend {loading ? "connecting" : error ? "needs setup" : "connected"} <em>·</em> No data sent to Adobe</span></footer>
      </main>

      {selectedProfile && <ProfileModal profile={selectedProfile.profile} events={selectedProfile.events} onClose={() => setSelectedProfile(null)} />}
    </div>
  );
}

function StatCard({ icon, tone, label, value, note }: { icon: ReactNode; tone: string; label: string; value?: number; note: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><i className={`stat-icon ${tone}`}>{icon}</i></div><strong className="stat-value">{value ?? "—"}</strong><small><i />{note}</small></article>;
}

function SourceMini({ source }: { source: DemoSource }) {
  return <div className="source-mini"><span><Database size={14} /></span><div><b>{source.display_name}</b><small>{source.record_count} records · {source.record_type}</small></div></div>;
}

function SourceCard({ source }: { source: DemoSource }) {
  return <article className="source-card"><span><Database size={15} /></span><div><small>{source.record_count} ROWS · LOADED</small><b>{source.display_name}</b><p>{source.record_type}</p></div><Check size={14} className="loaded-check" /></article>;
}

function Tag({ children, variant = "" }: { children: ReactNode; variant?: string }) {
  return <span className={`field-tag ${variant}`}>{children}</span>;
}

function Rule({ number, kind, title, operator, value, note, control, negative = false }: {
  number: string; kind: string; title: string; operator: string; value?: string; note: string; control?: React.ReactNode; negative?: boolean;
}) {
  return <div className="rule-block"><span className={`rule-num ${negative ? "negative" : ""}`}>{number}</span><div className="rule-copy"><div className="rule-expression">{negative && <Tag variant="negative">NOT</Tag>}<Tag variant={kind === "Event" ? "event-tag" : ""}>{kind}</Tag><b>{title}</b><span>{operator}</span>{value && <Tag variant="positive">{value}</Tag>}{control}</div><small>{note}</small></div></div>;
}

function Connector() {
  return <div className="connector"><span>AND</span></div>;
}

function DayInput({ value, onChange, label }: { value: number; onChange: (value: string) => void; label: string }) {
  return <label className="day-input"><input type="number" min="1" max="365" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} /><span>days</span></label>;
}

function ProfileTable({ profiles, mode, onInspect }: { profiles: Profile[]; mode: "audience" | "directory"; onInspect: (profile: Profile) => void }) {
  if (!profiles.length) return <EmptyState title="No profiles found" detail="Try a different search or adjust the audience settings." />;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>PROFILE</th>{mode === "directory" && <th>AIRPORT</th>}<th>LOYALTY</th><th>INTENT</th>{mode === "directory" && <th>CONSENT</th>}<th>{mode === "audience" ? "RECENT JOURNEY" : "AUDIENCE"}</th></tr></thead><tbody>{profiles.map((profile) => {
    const checks = profile.audience?.checks;
    const journey = [checks?.search && "Searched", checks?.abandoned && "Abandoned"].filter(Boolean).join(" · ");
    return <tr key={profile.customer_id} onClick={() => onInspect(profile)}><td><div className="profile-cell"><Avatar profile={profile} /><span><b>{profile.first_name} {profile.last_name}</b><small>{profile.customer_id}</small></span></div></td>{mode === "directory" && <td>{profile.home_airport}</td>}<td><span className={`tier ${tierClass(profile.loyalty_tier)}`}>{profile.loyalty_tier}</span></td><td><span className="intent-value">{Number(profile.travel_intent_score).toFixed(2)}<i><span style={{ width: `${Number(profile.travel_intent_score) * 100}%` }} /></i></span></td>{mode === "directory" && <td><span className={`consent ${profile.marketing_consent ? "" : "no"}`}>{profile.marketing_consent ? "✓ Yes" : "× No"}</span></td>}<td>{mode === "audience" ? <span className="journey-value">{journey || "—"}</span> : profile.audience?.qualifies ? <span className="in-audience"><Check size={11} /> In audience</span> : <span className="out-audience">{profile.audience?.reasons[0] ?? "Not included"}</span>}</td></tr>;
  })}</tbody></table></div>;
}

function EventStream({ events, profiles, onInspect }: { events: JourneyEvent[]; profiles: Profile[]; onInspect: (profile: Profile) => void }) {
  if (!events.length) return <EmptyState title="No events match" detail="Change the search to explore the event stream." />;
  const profileById = new Map(profiles.map((profile) => [profile.customer_id, profile]));
  return <div className="event-stream">{events.map((event) => {
    const profile = profileById.get(event.customer_id);
    return <div className="event-row" key={event.event_id}><time>{eventDate(event.occurred_at)} UTC</time><button className="event-profile" onClick={() => profile && onInspect(profile)}>{profile && <Avatar profile={profile} />}<span>{event.first_name ?? profile?.first_name ?? event.customer_id} {event.last_name ?? profile?.last_name ?? ""}<small>{event.customer_id}</small></span></button><span className="event-kind"><i className={event.event_type} />{eventTitle(event.event_type)}</span><span className="event-destination"><MapPin size={12} />{event.destination}</span><span className="event-source">{event.source}</span></div>;
  })}</div>;
}

function ProfileInspector({ profile, events }: { profile: Profile; events: JourneyEvent[] }) {
  return <article className="surface inspector"><div className="inspector-user"><Avatar profile={profile} large /><div><b>{profile.first_name} {profile.last_name}</b><small>{profile.customer_id} · {profile.home_airport}</small></div><span className={profile.audience?.qualifies ? "in-audience" : "out-audience"}>{profile.audience?.qualifies ? "Qualified" : "Not qualified"}</span></div><div className="inspector-attributes"><span><small>LOYALTY TIER</small><b>{profile.loyalty_tier}</b></span><span><small>TRAVEL INTENT</small><b>{Number(profile.travel_intent_score).toFixed(2)} · {profile.travel_intent_segment}</b></span><span><small>MARKETING CONSENT</small><b>{profile.marketing_consent ? "Granted" : "Not granted"}</b></span><span><small>PRICE SENSITIVITY</small><b>{Number(profile.price_sensitivity_score).toFixed(2)}</b></span></div><div className="inspector-events"><b>Journey history</b>{events.map((event) => <div key={event.event_id}><span>{eventTitle(event.event_type)} · {event.destination}</span><small>{shortDate(event.occurred_at)}</small></div>)}</div></article>;
}

function ProfileModal({ profile, events, onClose }: { profile: Profile; events: JourneyEvent[]; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="profile-modal" role="dialog" aria-modal="true" aria-label={`${profile.first_name} ${profile.last_name} profile`}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button><div className="modal-heading"><Avatar profile={profile} large /><span><b>{profile.first_name} {profile.last_name}</b><small>{profile.customer_id} · unified profile preview</small></span></div><div className="modal-facts"><span><small>LOYALTY</small><b>{profile.loyalty_tier}</b></span><span><small>TRAVEL INTENT</small><b>{Number(profile.travel_intent_score).toFixed(2)}</b></span><span><small>HOME AIRPORT</small><b>{profile.home_airport}</b></span><span><small>CONSENT</small><b>{profile.marketing_consent ? "Granted" : "Not granted"}</b></span></div><h3>Journey events ({events.length})</h3>{events.map((event) => <div className="modal-event" key={event.event_id}><span>{eventTitle(event.event_type)} · {event.destination}</span><small>{eventDate(event.occurred_at)} UTC</small></div>)}<div className="modal-note">{profile.audience?.qualifies ? "✓ This profile currently qualifies for Journey Rescue." : profile.audience?.reasons.join(" · ") || "Profile is not currently in the audience."}</div></section></div>;
}

export default App;
