"use client";

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  findCostRate,
  formatEntryDate,
  formatHoursMinutes,
  formatMoney,
  formatPct,
  type ProfitabilityData,
} from "@/lib/profitability";
import {
  TEAM_RANGES,
  buildAllocation,
  statusLabel,
  type AllocationPerson,
  type AllocationReport,
  type HourSegment,
  type TeamRange,
} from "@/lib/team";

function teamHref(range: TeamRange, slug?: string, client?: string) {
  const params = new URLSearchParams({ range });
  if (client) params.set("client", client);
  const query = `?${params.toString()}`;
  return slug ? `/profitability/team/${slug}${query}` : `/profitability/team${query}`;
}

function profitHref(slug: string, range: TeamRange) {
  return `/profitability/${slug}?range=${range === "week" ? "month" : range}`;
}

export function TeamDashboard({
  extra,
  data,
  view,
  member,
  range,
  client,
  showMoney = false,
}: {
  extra?: ReactNode;
  data: ProfitabilityData;
  view: "overview" | "person";
  member?: string;
  range: TeamRange;
  client?: string;
  showMoney?: boolean;
}) {
  const navigate = useNavigate();
  const report = useMemo(
    () => buildAllocation(data.entries, data.clients, data.costRates || [], data.roster || [], range, data.bounds),
    [data, range]
  );
  const people = useMemo(() => [...report.employees, ...report.contractors], [report]);
  const person = view === "person" ? people.find((item) => item.slug === member) : undefined;
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
      {extra}
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
                {people.map((item) => (
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
          showMoney={showMoney}
          compareLabel={report.compareLabel}
          onClearClient={() => navigate(teamHref(range, person.slug), { replace: true })}
        />
      ) : (
        <section className="pr-dashboard">
          <Link to={teamHref(range)} className="pr-back">
            ← All team members
          </Link>
          <p className="pr-note">That person has no hours in this period.</p>
        </section>
      )}
    </div>
  );
}

function Overview({ report, range }: { report: AllocationReport; range: TeamRange }) {
  return (
    <section className="pr-dashboard" aria-label="Team performance">
      <Link to={`/profitability?range=${range === "week" ? "month" : range}`} className="pr-back">
        ← Marketing retainers
      </Link>
      <div className="tm-kpis">
        <article className="pr-kpi">
          <span>Team utilization</span>
          <strong>{report.utilization == null ? "—" : `${formatPct(report.utilization)}%`}</strong>
          <small>Employee hours logged ÷ employee capacity</small>
        </article>
        <article className="pr-kpi">
          <span>Client work</span>
          <strong>{report.clientPct == null ? "—" : `${formatPct(report.clientPct)}%`}</strong>
          <small>Employee hours on client work ÷ logged hours</small>
        </article>
        <article className="pr-kpi">
          <span>Internal</span>
          <strong>{hoursLabel(report.employeeInternalMinutes)}</strong>
          <small>
            {report.internalPct == null
              ? "No employee hours logged"
              : `Brandastic Marketing + Admin, ${formatPct(report.internalPct)}% of employee hours`}
          </small>
        </article>
        <article className="pr-kpi">
          <span>Contractors</span>
          <strong>{hoursLabel(report.contractorMinutes)}</strong>
          <small>Hours logged by contractors</small>
        </article>
      </div>

      <section className="pr-panel" aria-label="Employees">
        <div className="tm-section">
          <h2>Employees</h2>
          <p>Who is overbooked and who has room?</p>
        </div>
        {report.employees.length ? (
          <div className="tm-emp-grid">
            {report.employees.map((person) => (
              <EmployeeCard key={person.slug} person={person} range={range} />
            ))}
          </div>
        ) : (
          <p className="pr-note">No employees in this period.</p>
        )}
      </section>

      <section className="pr-panel" aria-label="Contractors">
        <div className="tm-section">
          <h2>Contractors</h2>
          <p>Where is contractor time going?</p>
        </div>
        {report.contractors.length ? (
          <div className="pr-table-wrap">
            <table className="pr-table tm-alloc-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Hours</th>
                  <th>Allocation</th>
                  <th>Clients</th>
                  <th>Vs {report.compareLabel}</th>
                </tr>
              </thead>
              <tbody>
                {report.contractors.map((person) => (
                  <ContractorRow key={person.slug} person={person} range={range} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pr-note">No contractors yet. On Costs, set Type to Contractor for anyone who is not an employee.</p>
        )}
      </section>
    </section>
  );
}

function ContractorRow({ person, range }: { person: AllocationPerson; range: TeamRange }) {
  const navigate = useNavigate();
  return (
    <tr className="tm-row" onClick={(event) => openRow(event, () => navigate(teamHref(range, person.slug)))}>
      <td>
        <Link to={teamHref(range, person.slug)}>{person.name}</Link>
        {person.role ? <small className="tm-role">{person.role}</small> : null}
      </td>
      <td>{hoursLabel(person.minutes)}</td>
      <td className="tm-bar-cell">
        <StackBar segments={person.segments} />
      </td>
      <td>{person.clientCount}</td>
      <td title={person.previousMinutes == null ? "Not enough earlier hours to compare." : undefined}>
        {changeLabel(person.minutes, person.previousMinutes)}
      </td>
    </tr>
  );
}

function EmployeeCard({ person, range }: { person: AllocationPerson; range: TeamRange }) {
  const navigate = useNavigate();
  const slices = person.segments.filter((segment) => segment.minutes > 0);
  return (
    <article className="tm-emp-card" onClick={(event) => openRow(event, () => navigate(teamHref(range, person.slug)))}>
      <header>
        <div className="tm-person">
          <Link to={teamHref(range, person.slug)}>{person.name}</Link>
          {person.role ? <small className="tm-role">{person.role}</small> : null}
        </div>
        {person.status ? <span className={`tm-status tm-status-${person.status}`}>{statusLabel(person.status)}</span> : null}
      </header>
      <AllocationDonut segments={slices} center={person.utilization == null ? "—" : `${formatPct(person.utilization)}%`} />
      <ul className="tm-emp-legend">
        {slices.map((segment) => (
          <li key={segment.key}>
            <i style={{ background: segment.color }} />
            <span>{segment.name}</span>
            <em>{hoursLabel(segment.minutes)}</em>
          </li>
        ))}
      </ul>
      <dl className="tm-emp-stats">
        <div>
          <dt>Capacity</dt>
          <dd>{hoursLabel(person.capacityMinutes)}</dd>
        </div>
        <div>
          <dt>Logged</dt>
          <dd>{hoursLabel(person.minutes)}</dd>
        </div>
      </dl>
      <SplitBar clientPct={person.clientPct} internalPct={person.internalPct} />
    </article>
  );
}

function SplitBar({ clientPct, internalPct }: { clientPct: number | null; internalPct: number | null }) {
  const client = clientPct ?? 0;
  const internal = internalPct ?? 0;
  const clientLabel = clientPct == null ? "—" : `${formatPct(clientPct)}%`;
  const internalLabel = internalPct == null ? "—" : `${formatPct(internalPct)}%`;
  return (
    <div className="tm-split">
      <div className="tm-split-track" aria-hidden={clientPct == null}>
        {client > 0 ? <span className="tm-split-client" style={{ width: `${client}%` }} title={`Client ${clientLabel}`} /> : null}
        {internal > 0 ? <span className="tm-split-internal" style={{ width: `${internal}%` }} title={`Internal ${internalLabel}`} /> : null}
      </div>
      <div className="tm-split-key">
        <span>
          <i className="tm-split-client" />
          Client {clientLabel}
        </span>
        <span>
          <i className="tm-split-internal" />
          Internal {internalLabel}
        </span>
      </div>
    </div>
  );
}

function AllocationDonut({ segments, center }: { segments: HourSegment[]; center: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0);
  const radius = 68;
  const current = segments.find((segment) => segment.key === active);
  let angle = -Math.PI / 2;
  return (
    <div className="tm-card-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={center} onMouseLeave={() => setActive(null)}>
        {total > 0 ? (
          segments.map((segment) => {
            const sweep = (segment.minutes / total) * Math.PI * 2;
            const start = angle;
            const end = angle + sweep;
            angle = end;
            const gap = sweep > 0.18 ? 0.045 : 0;
            const path = donutArc(100, 100, radius, start + gap, end - gap);
            return (
              <path
                key={segment.key}
                d={path}
                fill="none"
                stroke={segment.color}
                strokeWidth="22"
                strokeLinecap="butt"
                opacity={!active || active === segment.key ? 1 : 0.4}
                onMouseEnter={() => setActive(segment.key)}
              />
            );
          })
        ) : (
          <circle cx="100" cy="100" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="22" />
        )}
        <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" className="pr-donut-value">
          {center}
        </text>
      </svg>
      {current ? (
        <span className="pr-tip tm-card-tip" role="tooltip">
          <strong>{current.name}</strong>
          {hoursLabel(current.minutes)}
        </span>
      ) : null}
    </div>
  );
}

function donutArc(cx: number, cy: number, radius: number, start: number, end: number) {
  const sweep = Math.max(end - start, 0.001);
  const drawEnd = start + Math.min(sweep, Math.PI * 2 - 0.001);
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(drawEnd);
  const y2 = cy + radius * Math.sin(drawEnd);
  const large = drawEnd - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

function openRow(event: ReactMouseEvent, open: () => void) {
  const target = event.target as HTMLElement;
  if (target.closest("a")) return;
  open();
}

function StackBar({ segments, markerPct }: { segments: HourSegment[]; markerPct?: number | null }) {
  const shown = segments.filter((segment) => segment.minutes > 0);
  const total = shown.reduce((sum, segment) => sum + segment.minutes, 0);
  return (
    <div className="tm-cap">
      <div className="tm-cap-track" aria-hidden={total <= 0}>
        {total > 0
          ? shown.map((segment) => (
              <span
                key={segment.key}
                className="tm-seg"
                title={`${segment.name}: ${hoursLabel(segment.minutes)}`}
                style={{ width: `${(segment.minutes / total) * 100}%`, background: segment.color }}
              />
            ))
          : null}
      </div>
      {markerPct != null ? <i className="tm-cap-mark" style={{ left: `${markerPct}%` }} title="100% of capacity" /> : null}
    </div>
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
  showMoney,
  compareLabel,
  onClearClient,
}: {
  person: AllocationPerson;
  data: ProfitabilityData;
  range: TeamRange;
  names: Map<string, string>;
  reportSlugs: Set<string>;
  client?: string;
  clientName?: string;
  showMoney: boolean;
  compareLabel: string;
  onClearClient: () => void;
}) {
  const window = useMemo(() => {
    const asOf = data.bounds.asOf;
    if (range === "week") {
      const [year, month, day] = asOf.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      const weekday = date.getUTCDay();
      date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
      return { start: date.toISOString().slice(0, 10), end: asOf };
    }
    if (range === "month") return { start: data.bounds.monthStart, end: asOf };
    return { start: data.bounds.quarterStart, end: asOf };
  }, [data.bounds, range]);
  const entries = useMemo(() => {
    const rates = data.costRates || [];
    return data.entries.filter((entry) => {
      if (entry.date < window.start || entry.date > window.end) return false;
      const rate = findCostRate(entry.member, rates);
      return (rate?.name || entry.member) === person.name;
    });
  }, [data.entries, data.costRates, person.name, window]);

  return (
    <section className="pr-dashboard" aria-label={`${person.name} allocation`}>
      <Link to={teamHref(range)} className="pr-back">
        ← All team members
      </Link>
      <div className="tm-person-head">
        <div className="pr-section-label">
          <h2>
            {person.name}
            {person.role ? <span> · {person.role}</span> : null}
          </h2>
        </div>
        {person.status ? <span className={`tm-status tm-status-${person.status}`}>{statusLabel(person.status)}</span> : null}
      </div>
      <div className="tm-kpis">
        {person.kind === "employee" ? (
          <>
            <article className="pr-kpi">
              <span>Capacity</span>
              <strong>{hoursLabel(person.capacityMinutes)}</strong>
              <small>Weekly hours prorated to this period</small>
            </article>
            <article className="pr-kpi">
              <span>Logged</span>
              <strong>{hoursLabel(person.minutes)}</strong>
              <small>{person.utilization == null ? "No capacity set" : `${formatPct(person.utilization)}% of capacity`}</small>
            </article>
            <article className="pr-kpi">
              <span>Client work</span>
              <strong>{person.clientPct == null ? "—" : `${formatPct(person.clientPct)}%`}</strong>
              <small>{person.clientCount} clients</small>
            </article>
            <article className="pr-kpi">
              <span>Internal</span>
              <strong>{hoursLabel(person.internalMinutes)}</strong>
              <small>{person.internalPct == null ? "No hours logged" : `${formatPct(person.internalPct)}% of logged hours`}</small>
            </article>
          </>
        ) : (
          <>
            <article className="pr-kpi">
              <span>Hours</span>
              <strong>{hoursLabel(person.minutes)}</strong>
              <small>Logged this period</small>
            </article>
            <article className="pr-kpi">
              <span>Clients</span>
              <strong>{person.clientCount}</strong>
              <small>Jira clients with time</small>
            </article>
            <article className="pr-kpi">
              <span>Vs {compareLabel}</span>
              <strong>{changeLabel(person.minutes, person.previousMinutes)}</strong>
              <small>{person.previousMinutes == null ? "Not enough earlier hours to compare" : "Change in logged hours"}</small>
            </article>
          </>
        )}
      </div>

      <article className="pr-panel">
        <div className="tm-section">
          <h3>Hours by Jira client</h3>
          <p>Every client this person logged time to.</p>
        </div>
        {person.kind === "employee" ? <StackBar segments={person.segments} markerPct={person.markerPct} /> : <StackBar segments={person.segments} />}
        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Hours</th>
                <th>Share</th>
                {showMoney ? <th>Cost</th> : null}
              </tr>
            </thead>
            <tbody>
              {person.clients.map((slice) => (
                <tr key={slice.slug}>
                  <td>
                    {reportSlugs.has(slice.slug) ? (
                      <Link to={profitHref(slice.slug, range)}>{slice.name}</Link>
                    ) : (
                      <span className="tm-project">{slice.name}</span>
                    )}
                  </td>
                  <td>{hoursLabel(slice.minutes)}</td>
                  <td>{person.minutes > 0 ? `${formatPct((slice.minutes / person.minutes) * 100)}%` : "—"}</td>
                  {showMoney ? <td>{slice.labor == null ? "—" : formatMoney(slice.labor)}</td> : null}
                </tr>
              ))}
              {!person.clients.length ? (
                <tr>
                  <td className="pr-empty" colSpan={showMoney ? 4 : 3}>
                    No tracked time in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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

function hoursLabel(minutes: number) {
  const rounded = Math.round((minutes / 60) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}h`;
}

function changeLabel(current: number, previous: number | null) {
  if (previous == null) return "—";
  const delta = Math.round((current - previous) / 60);
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}h`;
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
                  {reportSlugs.has(entry.clientSlug) ? (
                    <Link to={profitHref(entry.clientSlug, range)}>{names.get(entry.clientSlug) || entry.clientSlug}</Link>
                  ) : (
                    <span className="tm-project">{names.get(entry.clientSlug) || entry.clientSlug}</span>
                  )}
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
