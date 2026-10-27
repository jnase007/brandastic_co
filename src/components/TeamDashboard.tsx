"use client";

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  entriesFor,
  formatEntryDate,
  formatHours,
  formatHoursMinutes,
  formatMoney,
  formatPct,
  type ProfitabilityData,
} from "@/lib/profitability";
import {
  INTERNAL_SLUG,
  OTHER_TRACKED_SLUG,
  TEAM_RANGES,
  buildTeam,
  personTrend,
  topSegments,
  type ClientSlice,
  type TeamPerson,
  type TeamRange,
} from "@/lib/team";

function teamHref(range: TeamRange, slug?: string, client?: string) {
  const params = new URLSearchParams({ range });
  if (client) params.set("client", client);
  const query = `?${params.toString()}`;
  return slug ? `/profitability/team/${slug}${query}` : `/profitability/team${query}`;
}

export function TeamDashboard({
  data,
  view,
  member,
  range,
  client,
}: {
  data: ProfitabilityData;
  view: "overview" | "person";
  member?: string;
  range: TeamRange;
  client?: string;
}) {
  const navigate = useNavigate();
  const report = useMemo(
    () => buildTeam(data.entries, data.clients, data.costRates || [], data.roster || [], range, data.bounds),
    [data, range]
  );
  const person = view === "person" ? report.people.find((item) => item.slug === member) : undefined;
  const names = useMemo(() => new Map(data.clients.map((item) => [item.slug, item.name])), [data.clients]);
  const reportSlugs = useMemo(() => new Set(data.reportSlugs || []), [data.reportSlugs]);
  const clientName = client ? names.get(client) : undefined;

  function chooseRange(next: TeamRange) {
    if (next === range) return;
    navigate(teamHref(next, person?.slug, client), { replace: true });
  }

  function openPerson(slug: string) {
    if (!slug) return;
    navigate(teamHref(range, slug, client));
  }

  return (
    <div className="pr-page">
      <header className="pr-header">
        <div className="pr-brand">

          <div>
            <strong>Profitability</strong>
            <h1>Team Performance</h1>
          </div>
        </div>
        <div className="pr-controls">
          {view === "person" ? (
            <label className="pr-field">
              <span>Team member</span>
              <select value={person?.slug || ""} onChange={(event) => openPerson(event.target.value)}>
                {report.people.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="pr-segment" role="group" aria-label="Date range">
            {TEAM_RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={range === item.id ? "active" : ""}
                aria-pressed={range === item.id}
                onClick={() => chooseRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === "overview" ? (
        <Overview report={report} range={range} />
      ) : person ? (
        <PersonView
          person={person}
          data={data}
          range={range}
          names={names}
          reportSlugs={reportSlugs}
          client={clientName ? client : undefined}
          clientName={clientName}
          onClearClient={() => navigate(teamHref(range, person.slug), { replace: true })}
        />
      ) : null}
    </div>
  );
}

function Overview({
  report,
  range,
}: {
  report: ReturnType<typeof buildTeam>;
  range: TeamRange;
}) {
  return (
    <section className="pr-dashboard" aria-label="Team performance">
      <Link to={`/profitability?range=${range}`} className="pr-back">
        ← Client profitability
      </Link>
      <div className="tm-kpis">
        <article className="pr-kpi">
          <span>Total hours</span>
          <strong>{formatHours(report.totalMinutes / 60)}</strong>
          <small>All Tempo time</small>
        </article>
        <article className="pr-kpi">
          <span>Active clients</span>
          <strong>{report.activeClients}</strong>
          <small>Includes work outside Brand Care</small>
        </article>
        <article className="pr-kpi">
          <span>Labor cost</span>
          <strong>{formatMoney(report.labor)}</strong>
          <small>
            {report.uncostedHours > 0
              ? `${formatHours(report.uncostedHours)}h missing a cost rate`
              : "Hours logged × hourly cost"}
          </small>
        </article>
      </div>

      <article className="pr-panel">
        <div className="pr-panel-head">
          <h3>Hours by team member</h3>
        </div>
        <div className="tm-bars">
          {report.people.map((person) => (
            <PersonBar key={person.slug} person={person} range={range} />
          ))}
        </div>
      </article>

      <MemberTable people={report.people} range={range} />
    </section>
  );
}

function PersonBar({ person, range }: { person: TeamPerson; range: TeamRange }) {
  const segments = topSegments(person.clients);
  const [active, setActive] = useState<string | null>(null);
  const current = segments.find((segment) => segment.key === active);
  return (
    <div className="tm-bar-row">
      <Link to={teamHref(range, person.slug)}>{person.name}</Link>
      <div className="tm-bar" onMouseLeave={() => setActive(null)}>
        {person.minutes > 0
          ? segments.map((segment) => (
              <Link
                key={segment.key}
                href={segment.slug ? teamHref(range, person.slug, segment.slug) : teamHref(range, person.slug)}
                className="tm-seg"
                style={{ width: `${(segment.minutes / person.minutes) * 100}%`, background: segment.color }}
                aria-label={`${person.name}, ${segment.name}, ${formatHoursMinutes(segment.minutes)}`}
                onFocus={() => setActive(segment.key)}
                onBlur={() => setActive(null)}
              />
            ))
          : null}
        {current ? (
          <span className="pr-tip" role="tooltip">
            <strong>{person.name}</strong>
            {current.name}
            <br />
            {formatHours(current.minutes / 60)}h
          </span>
        ) : null}
      </div>
      <em>{formatHours(person.minutes / 60)}h</em>
    </div>
  );
}

function MemberTable({ people, range }: { people: TeamPerson[]; range: TeamRange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "hours", dir: "desc" });
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? people.filter((person) => person.name.toLowerCase().includes(needle)) : people;
    const directed = [...filtered].sort((a, b) => comparePeople(a, b, sort.key) * (sort.dir === "asc" ? 1 : -1));
    return directed;
  }, [people, query, sort]);

  function toggle(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  return (
    <article className="pr-panel">
      <div className="pr-panel-head">
        <h3>Team member summary</h3>
        <input
          className="tm-search"
          value={query}
          placeholder="Search team members"
          aria-label="Search team members"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="pr-table-wrap">
        <table className="pr-table">
          <thead>
            <tr>
              <SortHead label="Team member" sortKey="name" sort={sort} onSort={toggle} />
              <SortHead label="Hours" sortKey="hours" sort={sort} onSort={toggle} />
              <SortHead label="Clients" sortKey="clients" sort={sort} onSort={toggle} />
              <SortHead label="Client hours" sortKey="clientHours" sort={sort} onSort={toggle} />
              <SortHead label="Internal hours" sortKey="internal" sort={sort} onSort={toggle} />
              <SortHead label="Labor cost" sortKey="labor" sort={sort} onSort={toggle} />
            </tr>
          </thead>
          <tbody>
            {shown.map((person) => (
              <tr key={person.slug} className="tm-row" onClick={() => navigate(teamHref(range, person.slug))}>
                <td>
                  <Link to={teamHref(range, person.slug)}>{person.name}</Link>
                </td>
                <td>{formatHours(person.minutes / 60)}</td>
                <td>{person.activeClients}</td>
                <td>{formatHours(person.clientMinutes / 60)}</td>
                <td>{formatHours(person.internalMinutes / 60)}</td>
                <td>{person.labor == null ? "—" : formatMoney(person.labor)}</td>
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td className="pr-empty" colSpan={6}>
                  No team members match that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

type SortKey = "name" | "hours" | "clients" | "clientHours" | "internal" | "labor";

function comparePeople(a: TeamPerson, b: TeamPerson, key: SortKey) {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "hours") return a.minutes - b.minutes;
  if (key === "clients") return a.activeClients - b.activeClients;
  if (key === "clientHours") return a.clientMinutes - b.clientMinutes;
  if (key === "internal") return a.internalMinutes - b.internalMinutes;
  return (a.labor ?? -1) - (b.labor ?? -1);
}

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const mark = sort.key === sortKey ? (sort.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th>
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}
        {mark}
      </button>
    </th>
  );
}

function PersonView({
  person,
  data,
  range,
  names,
  reportSlugs,
  client,
  clientName,
  onClearClient,
}: {
  person: TeamPerson;
  data: ProfitabilityData;
  range: TeamRange;
  names: Map<string, string>;
  reportSlugs: Set<string>;
  client?: string;
  clientName?: string;
  onClearClient: () => void;
}) {
  const entries = useMemo(() => {
    return entriesFor(data.entries, data.clients, range, "all", data.bounds).filter((entry) => entry.member === person.name);
  }, [data, range, person.name]);
  const trend = useMemo(() => personTrend(entries, range, data.bounds, names), [entries, range, data.bounds, names]);
  const largest = person.clients[0];
  const concentration = person.minutes > 0 && largest ? (largest.minutes / person.minutes) * 100 : null;

  return (
    <section className="pr-dashboard" aria-label={`${person.name} performance`}>
      <Link to={teamHref(range)} className="pr-back">
        ← All team members
      </Link>
      <div className="pr-section-label">
        <h2>
          {person.name}
          {clientName ? <span> · {clientName}</span> : null}
        </h2>
      </div>
      <div className="tm-kpis">
        <article className="pr-kpi">
          <span>Total hours</span>
          <strong>{formatHours(person.minutes / 60)}</strong>
          <small>All Tempo time</small>
        </article>
        <article className="pr-kpi">
          <span>Active clients</span>
          <strong>{person.activeClients}</strong>
          <small>{formatHours(person.internalMinutes / 60)}h internal</small>
        </article>
        <article className="pr-kpi">
          <span>Labor cost</span>
          <strong>{person.labor == null ? "—" : formatMoney(person.labor)}</strong>
          <small>{person.labor == null ? "Missing a cost rate" : "Hours logged × hourly cost"}</small>
        </article>
      </div>

      <article className="pr-panel">
        <div className="pr-panel-head">
          <h3>Client allocation</h3>
        </div>
        {concentration != null && largest ? (
          <p className="tm-note">
            {largest.name} is {formatPct(concentration)}% of logged hours.
          </p>
        ) : (
          <p className="tm-note">No tracked time in this period.</p>
        )}
        <AllocationDonut
          clients={person.clients}
          totalMinutes={person.minutes}
          range={range}
          reportSlugs={reportSlugs}
          activeSlug={client}
        />
      </article>

      <article className="pr-panel">
        <div className="pr-panel-head">
          <h3>{range === "month" ? "Hours this month" : "Hours this quarter"}</h3>
        </div>
        <TrendChart buckets={trend} />
      </article>

      <TimeLog
        entries={entries}
        names={names}
        range={range}
        reportSlugs={reportSlugs}
        client={client}
        clientName={clientName}
        onClearClient={onClearClient}
      />
    </section>
  );
}

function TrendChart({ buckets }: { buckets: ReturnType<typeof personTrend> }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...buckets.map((bucket) => bucket.minutes), 1);
  const current = buckets.flatMap((bucket) => bucket.segments.map((segment) => ({ ...segment, bucket: bucket.label }))).find((segment) => `${segment.bucket}-${segment.key}` === active);
  return (
    <div className="tm-trend" onMouseLeave={() => setActive(null)}>
      {buckets.map((bucket) => (
        <div key={bucket.key} className="tm-trend-col">
          <div className="tm-trend-plot">
            <div className="tm-trend-stack" style={{ height: `${(bucket.minutes / max) * 100}%` }}>
              {[...bucket.segments].reverse().map((segment) => (
                <span
                  key={segment.key}
                  style={{ flexGrow: segment.minutes, background: segment.color }}
                  onMouseEnter={() => setActive(`${bucket.label}-${segment.key}`)}
                />
              ))}
            </div>
          </div>
          <span>{bucket.label}</span>
        </div>
      ))}
      {current ? (
        <span className="pr-tip" role="tooltip">
          <strong>{current.bucket}</strong>
          {current.name}
          <br />
          {formatHours(current.minutes / 60)}h
        </span>
      ) : null}
    </div>
  );
}

const ALLOC_COLORS = ["#5b21b6", "#7c3aed", "#2563eb", "#0f766e", "#0369a1", "#4c1d95", "#6d28d9", "#3b82f6"];

function allocationColor(slug: string, index: number) {
  if (slug === INTERNAL_SLUG) return "#94a3b8";
  if (slug === OTHER_TRACKED_SLUG) return "#64748b";
  return ALLOC_COLORS[index % ALLOC_COLORS.length];
}

function AllocationDonut({
  clients,
  totalMinutes,
  range,
  reportSlugs,
  activeSlug,
}: {
  clients: ClientSlice[];
  totalMinutes: number;
  range: TeamRange;
  reportSlugs: Set<string>;
  activeSlug?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const slices = clients.filter((slice) => slice.minutes > 0);
  const active = hover || activeSlug || null;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const activeSlice = slices.find((slice) => slice.slug === active);
  if (!slices.length || totalMinutes <= 0) return null;

  return (
    <div className="pr-donut-wrap tm-alloc-donut">
      <div className="pr-donut">
        <svg viewBox="0 0 200 200" role="img" aria-label="Client allocation">
          <g transform="rotate(-90 100 100)">
            {slices.map((slice, index) => {
              const length = (slice.minutes / totalMinutes) * circumference;
              const gap = length > 6 ? 2 : 0;
              const visible = Math.max(length - gap, 0);
              const dash = `${visible} ${circumference - visible}`;
              const offset = -cursor;
              cursor += length;
              return (
                <circle
                  key={slice.slug}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={allocationColor(slice.slug, index)}
                  strokeWidth="26"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  opacity={!active || active === slice.slug ? 1 : 0.35}
                  onMouseEnter={() => setHover(slice.slug)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </g>
          <text x="100" y="96" textAnchor="middle" className="pr-donut-value">
            {formatHours(totalMinutes / 60)}h
          </text>
          <text x="100" y="116" textAnchor="middle" className="pr-donut-sub">
            logged
          </text>
        </svg>
        {activeSlice ? (
          <div className="pr-tip floating" role="tooltip">
            <strong>{activeSlice.name}</strong>
            {formatPct((activeSlice.minutes / totalMinutes) * 100)}% · {formatHoursMinutes(activeSlice.minutes)}
            {activeSlice.labor == null ? "" : ` · ${formatMoney(activeSlice.labor)}`}
          </div>
        ) : null}
      </div>
      <ul className="pr-donut-legend">
        {slices.map((slice, index) => {
          const pct = (slice.minutes / totalMinutes) * 100;
          return (
            <li
              key={slice.slug}
              className={active === slice.slug ? "active" : ""}
              onMouseEnter={() => setHover(slice.slug)}
              onMouseLeave={() => setHover(null)}
            >
              <i style={{ background: allocationColor(slice.slug, index) }} />
              <ProjectName slug={slice.slug} name={slice.name} range={range} linked={reportSlugs.has(slice.slug)} />
              <em>
                {formatPct(pct)}% · {formatHoursMinutes(slice.minutes)}
              </em>
              <b>{slice.labor == null ? "—" : formatMoney(slice.labor)}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProjectName({ slug, name, range, linked }: { slug: string; name: string; range: TeamRange; linked: boolean }) {
  if (!linked) return <span className="tm-project">{name}</span>;
  return <Link to={`/profitability/${slug}?range=${range}`}>{name}</Link>;
}

function TimeLog({
  entries,
  names,
  range,
  reportSlugs,
  client,
  clientName,
  onClearClient,
}: {
  entries: { date: string; clientSlug: string; minutes: number; description: string; member: string }[];
  names: Map<string, string>;
  range: TeamRange;
  reportSlugs: Set<string>;
  client?: string;
  clientName?: string;
  onClearClient: () => void;
}) {
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState(client || "");
  useEffect(() => {
    setClientFilter(client || "");
  }, [client]);
  const clients = useMemo(() => {
    const slugs = [...new Set(entries.map((entry) => entry.clientSlug))];
    return slugs
      .map((slug) => ({ slug, name: names.get(slug) || slug }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, names]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => (clientFilter ? entry.clientSlug === clientFilter : true))
      .filter((entry) => {
        if (!needle) return true;
        const name = names.get(entry.clientSlug) || entry.clientSlug;
        return name.toLowerCase().includes(needle) || entry.description.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.minutes - a.minutes);
  }, [entries, clientFilter, query, names]);

  return (
    <article className="pr-panel">
      <div className="pr-panel-head">
        <h3>Time entries</h3>
        <div className="tm-log-tools">
          <select aria-label="Filter by client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="">All clients</option>
            {clients.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            className="tm-search"
            value={query}
            placeholder="Search notes"
            aria-label="Search notes"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      {client && clientName ? (
        <p className="tm-note">
          Opened from {clientName}.{" "}
          <button type="button" onClick={onClearClient}>
            Show all clients
          </button>
        </p>
      ) : null}
      <div className="pr-table-wrap tm-log">
        <table className="pr-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Hours</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry, index) => (
              <tr key={`${entry.date}-${entry.clientSlug}-${index}`}>
                <td>{formatEntryDate(entry.date)}</td>
                <td>
                  <ProjectName
                    slug={entry.clientSlug}
                    name={names.get(entry.clientSlug) || entry.clientSlug}
                    range={range}
                    linked={reportSlugs.has(entry.clientSlug)}
                  />
                </td>
                <td className="pr-duration">{formatHoursMinutes(entry.minutes)}</td>
                <td className="tm-note-cell" title={entry.description}>
                  {entry.description}
                </td>
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td className="pr-empty" colSpan={4}>
                  No time entries in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}
