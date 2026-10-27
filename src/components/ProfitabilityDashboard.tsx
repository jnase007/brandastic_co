"use client";

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  PROFIT_RANGES,
  burnHealth,
  chartAllocationMinutes,
  chartBuckets,
  clientBySlug,
  contractBurn,
  contractTrend,
  donutSlices,
  entriesFor,
  formatEntryDate,
  formatHours,
  formatHoursMinutes,
  formatMoney,
  formatPct,
  hourlyCostFor,
  hoursBudget,
  reportWindow,
  contractTermLabel,
  directProfit,
  type CostRate,
  type DirectProfit,
  type ProfitClient,
  type ProfitabilityData,
  type ProfitRange,
  type TimeEntry,
} from "@/lib/profitability";
import { memberSlug } from "@/lib/team";

function profitabilityHref(range: ProfitRange, slug?: string) {
  const query = `?range=${range}`;
  return slug ? `/profitability/${slug}${query}` : `/profitability${query}`;
}

export function ProfitabilityDashboard({
  data,
  view,
  slug = "",
  range: initialRange,
}: {
  data: ProfitabilityData;
  view: "overview" | "client";
  slug?: string;
  range: ProfitRange;
}) {
  const navigate = useNavigate();
  const { clients, entries, bounds } = data;
  const clientOptions = data.directory?.length ? data.directory : clients;
  const [range, setRange] = useState<ProfitRange>(initialRange);
  const [activeBar, setActiveBar] = useState<string | null>(null);
  const [activeSlice, setActiveSlice] = useState<string | null>(null);

  useEffect(() => {
    setRange(initialRange);
  }, [initialRange]);

  useEffect(() => {
    setActiveBar(null);
    setActiveSlice(null);
  }, [slug, range]);

  const selected = view === "client" ? clientBySlug(clients, slug) : undefined;
  const period = selected ? reportWindow(selected, range, bounds) : null;
  const periodLabel = period ? `${formatEntryDate(period.start)} – ${formatEntryDate(period.end)}` : "";
  const viewEntries = useMemo(
    () => (selected ? entriesFor(entries, clients, range, selected.slug, bounds) : []),
    [entries, clients, range, selected, bounds]
  );
  const trend = useMemo(
    () => (selected ? contractTrend(entries, clients, selected.slug, bounds.asOf) : null),
    [entries, clients, selected, bounds.asOf]
  );

  function openClient(nextSlug: string) {
    if (!nextSlug) return;
    navigate(profitabilityHref(range, nextSlug));
  }

  function chooseRange(next: ProfitRange) {
    if (next === range) return;
    setRange(next);
    navigate(view === "client" && slug ? profitabilityHref(next, slug) : profitabilityHref(next), { replace: true });
  }
  const buckets = useMemo(() => chartBuckets(range, viewEntries, bounds), [range, viewEntries, bounds]);
  const slices = useMemo(
    () => donutSlices(viewEntries, clients, selected?.slug || ""),
    [viewEntries, clients, selected]
  );
  const cards = useMemo(
    () =>
        clients.map((client) => {
        const ranged = entriesFor(entries, clients, range, client.slug, bounds);
        const loggedRaw = ranged.reduce((sum, entry) => sum + entry.minutes, 0) / 60;
        const logged = Math.round(loggedRaw * 10) / 10;
        const budget = hoursBudget(client, range, bounds);
        const pct = budget ? Math.round((logged / budget) * 1000) / 10 : 0;
        return {
          client,
          logged,
          loggedRaw,
          budget,
          pct,
          health: burnHealth(pct),
          hasBudget: budget != null && budget > 0,
        };
      })
        .sort((a, b) => {
          if (a.hasBudget !== b.hasBudget) return a.hasBudget ? -1 : 1;
          if (b.pct !== a.pct) return b.pct - a.pct;
          return a.client.name.localeCompare(b.client.name);
        }),
    [clients, entries, range, bounds]
  );
  const selectedCard = cards.find((card) => card.client.slug === selected?.slug);
  const budgetLabel = range === "month" ? "Allocated" : range === "quarter" ? "Quarter hrs" : "Contract hrs";
  const portfolioCards = cards.filter((card) => card.client.slug !== "brandastic");
  const totalLogged = portfolioCards.reduce((sum, card) => sum + card.loggedRaw, 0);
  const totalBudget = portfolioCards.reduce(
    (sum, card) => sum + (card.hasBudget && card.budget != null ? card.budget : 0),
    0
  );
  const totalHasBudget = totalBudget > 0;
  const totalPct = totalHasBudget ? (totalLogged / totalBudget) * 100 : 0;
  const totalHealth = burnHealth(totalPct);
  const portfolioProfit = useMemo(
    () =>
      directProfit(
        clients.filter((client) => client.slug !== "brandastic"),
        entriesFor(entries, clients, range, "all", bounds).filter((entry) => entry.clientSlug !== "brandastic"),
        data.costRates || [],
        range,
        bounds,
        data.monthlyOverhead ?? null,
        data.payingAllocatedHours || 0
      ),
    [clients, entries, range, bounds, data.costRates, data.monthlyOverhead, data.payingAllocatedHours]
  );
  const clientProfit = useMemo(
    () =>
      selected
        ? directProfit(
            [selected],
            viewEntries,
            data.costRates || [],
            range,
            bounds,
            data.monthlyOverhead ?? null,
            data.payingAllocatedHours || 0
          )
        : null,
    [selected, viewEntries, data.costRates, range, bounds, data.monthlyOverhead, data.payingAllocatedHours]
  );

  return (
    <div className="pr-page">
      <header className="pr-header">
        <div className="pr-brand">

          <div>
            <strong>Agency Health</strong>
            <h1>Client Reports & Profitability</h1>
          </div>
        </div>
        <div className="pr-controls">
          <label className="pr-field">
            <span>Client</span>
            <select value={view === "client" ? slug : ""} onChange={(event) => openClient(event.target.value)}>
              {view === "overview" ? (
                <option value="" disabled>
                  Select a client
                </option>
              ) : null}
              {clientOptions.map((client) => (
                <option key={client.slug} value={client.slug}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <div className="pr-segment" role="group" aria-label="Date range">
            {PROFIT_RANGES.map((item) => (
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
      {view === "overview" ? <MoneyKpis profit={portfolioProfit} /> : null}
      {view === "overview" ? (
      <section className="pr-cards-wrap">
      <article className="pr-card pr-card-total" aria-label="All Clients (minus Brandastic)">
        <div className="pr-card-top">
          <strong>All Clients (minus Brandastic)</strong>
          <span className={`pr-burn ${totalHasBudget ? totalHealth : "warn"}`}>
            {totalHasBudget ? `${formatPct(totalPct)}%` : "No allocation"}
          </span>
        </div>
        <div className="pr-card-hours">
          <span>
            <em>{formatHours(totalLogged)}</em>
            Logged
          </span>
          <span>
            <em>{totalHasBudget ? formatHours(totalBudget) : "—"}</em>
            {budgetLabel}
          </span>
        </div>
        <div className="pr-track" aria-hidden>
          <div
            className={`pr-fill ${totalHasBudget ? totalHealth : "warn"}`}
            style={{ width: `${totalHasBudget ? Math.min(totalPct, 100) : 0}%` }}
          />
        </div>
      </article>
      <div className="pr-cards-sep" role="separator" />
      <div className="pr-cards" aria-label="Client retainer overview">
        {cards.map(({ client, logged, budget, pct, health, hasBudget }) => {
          return (
            <Link
              key={client.slug}
              to={profitabilityHref(range, client.slug)}
              className="pr-card"
            >
              <div className="pr-card-top">
                <strong>{client.name}</strong>
                <span className={`pr-burn ${hasBudget ? health : "warn"}`}>
                  {hasBudget ? `${formatPct(pct)}%` : "No allocation"}
                </span>
              </div>
              <div className="pr-card-hours">
                <span>
                  <em>{formatHours(logged)}</em>
                  Logged
                </span>
                <span>
                  <em>{hasBudget && budget != null ? formatHours(budget) : "—"}</em>
                  {budgetLabel}
                </span>
              </div>
              <div className="pr-track" aria-hidden>
                <div
                  className={`pr-fill ${hasBudget ? health : "warn"}`}
                  style={{ width: `${hasBudget ? Math.min(pct, 100) : 0}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
      </section>
      ) : null}

      {view === "client" && selected && trend ? (
      <section className="pr-dashboard" aria-label="Client report">
        <Link to={profitabilityHref(range)} className="pr-back">
          ← All clients
        </Link>
        <div className="pr-section-label">
          <h2>
            {selected.name}
            {periodLabel ? <span> | {periodLabel}</span> : null}
          </h2>
        </div>

        <div className="pr-kpis">
          <HoursSummary
            logged={selectedCard?.logged ?? 0}
            budget={selectedCard?.hasBudget ? selectedCard.budget : null}
            budgetLabel={budgetLabel}
          />
          <article className="pr-kpi">
            <span>Monthly pace</span>
            <strong>{formatHours(trend.averageHours)} hrs / mo</strong>
            {trend.allocatedHours != null ? (
              <small className={trend.averageHours > trend.allocatedHours ? "over" : "under"}>
                {formatHours(trend.allocatedHours)} allocated / mo
              </small>
            ) : (
              <small>No monthly allocation</small>
            )}
            <em>{selected ? contractTermLabel(selected) : ""}</em>
          </article>
        </div>

        <div className="pr-charts split">
          <article className="pr-panel">
            <div className="pr-panel-head">
              <h3>Tracked time</h3>
            </div>
            <BarChart
              buckets={buckets}
              allocationMinutes={chartAllocationMinutes(selected)}
              colorByAllocation
              active={activeBar}
              onActive={setActiveBar}
            />
          </article>
          <article className="pr-panel">
            <div className="pr-panel-head">
              <h3>Time by team member</h3>
            </div>
            <DonutChart
              slices={slices}
              rates={data.costRates || []}
              active={activeSlice}
              onActive={setActiveSlice}
              clientSlug={selected.slug}
              range={range}
            />
          </article>
        </div>
        {clientProfit ? <MoneyKpis profit={clientProfit} /> : null}
        {range === "year" ? (
          <ContractBurnChart client={selected} entries={viewEntries} rates={data.costRates || []} />
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function MoneyKpis({ profit }: { profit: DirectProfit }) {
  return (
    <section className="pr-profit" aria-label="Profit after overhead">
      <p>Revenue minus direct labor and overhead.</p>
      <div className="pr-kpis pr-profit-kpis">
        <article className="pr-kpi">
          <span>Revenue</span>
          <strong>{profit.revenue == null ? "—" : formatMoney(profit.revenue)}</strong>
          <small>What the client pays for this period</small>
        </article>
        <article className="pr-kpi">
          <span>Labor cost</span>
          <strong>{formatMoney(profit.labor)}</strong>
          <small>
            {profit.uncostedHours > 0
              ? `${formatHours(profit.uncostedHours)}h missing a cost rate`
              : "Hours logged × hourly cost"}
          </small>
        </article>
        <article className="pr-kpi">
          <span>Overhead</span>
          <strong>{profit.overhead == null ? "—" : formatMoney(profit.overhead)}</strong>
          <small>
            {profit.overheadHours != null && profit.overheadBaseHours
              ? profit.overheadHours === profit.overheadBaseHours
                ? "All allocated hours"
                : `${formatHours(profit.overheadHours)} of ${formatHours(profit.overheadBaseHours)} allocated hours`
              : "Paying clients only"}
          </small>
        </article>
        <article className="pr-kpi">
          <span>Profit</span>
          <strong className={profit.profit != null && profit.profit < 0 ? "over" : ""}>
            {profit.profit == null ? "—" : formatMoney(profit.profit)}
          </strong>
          <small className={profit.margin != null && profit.margin < 0 ? "over" : "under"}>
            {profit.margin == null ? "Needs a retainer rate" : `${formatPct(profit.margin)}% margin`}
          </small>
        </article>
      </div>
    </section>
  );
}

function ContractBurnChart({
  client,
  entries,
  rates,
}: {
  client: ProfitClient;
  entries: TimeEntry[];
  rates: CostRate[];
}) {
  const burn = useMemo(() => contractBurn(client, entries, rates), [client, entries, rates]);
  const [hover, setHover] = useState<{ date: string; x: number } | null>(null);
  if (!burn) return null;

  const width = 760;
  const height = 280;
  const left = 56;
  const right = 16;
  const top = 16;
  const bottom = 36;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const peak = Math.max(burn.retainerTotal ?? 0, burn.laborTotal, 1);
  const ticks = moneyTicks(peak);
  const ceiling = ticks[ticks.length - 1] || 1;
  const startDay = dayNumber(burn.start);
  const span = Math.max(dayNumber(burn.end) - startDay, 1);
  const xOf = (date: string) => left + ((dayNumber(date) - startDay) / span) * plotW;
  const yOf = (amount: number) => top + (1 - amount / ceiling) * plotH;
  const baseline = yOf(0);
  const labels = burnLabels(burn.start, burn.end);

  let laborPath = "";
  if (burn.labor.length) {
    laborPath = `M ${xOf(burn.labor[0].date)} ${baseline}`;
    for (const point of burn.labor) laborPath += ` L ${xOf(point.date)} ${yOf(point.amount)}`;
    laborPath += ` L ${xOf(burn.labor[burn.labor.length - 1].date)} ${baseline} Z`;
  }
  let retainerPath = "";
  if (burn.retainer.length) {
    retainerPath = `M ${xOf(burn.retainer[0].date)} ${yOf(burn.retainer[0].amount)}`;
    for (let index = 1; index < burn.retainer.length; index += 1) {
      retainerPath += ` L ${xOf(burn.retainer[index].date)} ${yOf(burn.retainer[index - 1].amount)}`;
      retainerPath += ` L ${xOf(burn.retainer[index].date)} ${yOf(burn.retainer[index].amount)}`;
    }
  }

  const hoverDate = hover?.date;
  const hoverRetainer = hoverDate && burn.retainer.length ? amountAt(burn.retainer, hoverDate) : null;
  const hoverLabor = hoverDate ? amountAt(burn.labor, hoverDate) : null;

  return (
    <article className="pr-panel pr-burn-panel">
      <div className="pr-panel-head">
        <h3>Retainer vs labor</h3>
      </div>
      <p className="pr-burn-note">
        {burn.retainerTotal == null
          ? "Labor is hours logged × hourly cost. This client needs a retainer rate."
          : "The orange line steps up by one month of the retainer. The blue area is labor cost."}
      </p>
      <div className="pr-burn-chart">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Retainer versus labor cost across the contract year"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * width;
            if (x < left || x > left + plotW) {
              setHover(null);
              return;
            }
            const day = startDay + ((x - left) / plotW) * span;
            setHover({ date: dayToIso(day), x });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="pr-labor-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="pr-burn-grid" x1={left} x2={left + plotW} y1={yOf(tick)} y2={yOf(tick)} />
              <text className="pr-burn-axis" x={left - 8} y={yOf(tick) + 4} textAnchor="end">
                {formatAxisMoney(tick)}
              </text>
            </g>
          ))}
          {laborPath ? <path d={laborPath} fill="url(#pr-labor-fill)" /> : null}
          {retainerPath ? <path className="pr-burn-retainer" d={retainerPath} /> : null}
          {labels.map((date, index) => (
            <text
              key={date}
              className="pr-burn-axis"
              x={xOf(date)}
              y={height - 10}
              textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
            >
              {burnTickLabel(date)}
            </text>
          ))}
          {hover ? <line className="pr-burn-hover" x1={hover.x} x2={hover.x} y1={top} y2={baseline} /> : null}
        </svg>
        {hover && hoverDate ? (
          <div className="pr-burn-tip" style={{ left: `${(Math.min(Math.max(hover.x, 90), width - 90) / width) * 100}%` }}>
            <strong>{formatEntryDate(hoverDate)}</strong>
            {hoverRetainer != null ? <span>Retainer {formatMoney(hoverRetainer)}</span> : null}
            <span>Labor {formatMoney(hoverLabor || 0)}</span>
          </div>
        ) : null}
      </div>
      <ul className="pr-burn-legend">
        <li>
          <i className="retainer" />
          Retainer
          <b>{burn.retainerTotal == null ? "—" : formatMoney(burn.retainerTotal)}</b>
        </li>
        <li>
          <i className="labor" />
          Labor
          <b>{formatMoney(burn.laborTotal)}</b>
        </li>
      </ul>
    </article>
  );
}

function amountAt(points: { date: string; amount: number }[], date: string) {
  let amount = 0;
  for (const point of points) {
    if (point.date > date) break;
    amount = point.amount;
  }
  return amount;
}

function dayNumber(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

function dayToIso(day: number) {
  return new Date(Math.round(day) * 86400000).toISOString().slice(0, 10);
}

function moneyTicks(value: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1))));
  const fraction = value / exp;
  const stepFraction = fraction <= 1 ? 0.2 : fraction <= 2 ? 0.5 : fraction <= 5 ? 1 : 2;
  const step = stepFraction * exp;
  const max = Math.ceil((value * 1.02) / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + step / 100; tick += step) ticks.push(Math.round(tick * 100) / 100);
  return ticks;
}

function burnLabels(start: string, end: string) {
  const startDay = dayNumber(start);
  const span = Math.max(dayNumber(end) - startDay, 1);
  const chosen = new Map<string, string>();
  for (let index = 0; index < 5; index += 1) {
    const iso = dayToIso(startDay + (span * index) / 4);
    const key = iso.slice(0, 7);
    if (chosen.has(key)) continue;
    chosen.set(key, index === 0 ? start : index === 4 ? end : `${key}-01`);
  }
  return [...chosen.values()];
}

const BURN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function burnTickLabel(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return `${BURN_MONTHS[month - 1]} '${String(year).slice(2)}`;
}

function formatAxisMoney(value: number) {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const thousands = Math.round((value / 1000) * 10) / 10;
    return `$${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return formatMoney(value);
}

function HoursSummary({
  logged,
  budget,
  budgetLabel,
}: {
  logged: number;
  budget: number | null;
  budgetLabel: string;
}) {
  const pct = budget ? Math.round((logged / budget) * 1000) / 10 : 0;
  const health = burnHealth(pct);
  return (
    <article className="pr-kpi pr-kpi-burn">
      <div className="pr-card-top">
        <span>Total hours</span>
        <span className={`pr-burn ${budget ? health : "warn"}`}>{budget ? `${formatPct(pct)}%` : "No allocation"}</span>
      </div>
      <div className="pr-card-hours">
        <span>
          <em>{formatHours(logged)}</em>
          Logged
        </span>
        <span>
          <em>{budget != null ? formatHours(budget) : "—"}</em>
          {budgetLabel}
        </span>
      </div>
      <div className="pr-track" aria-hidden>
        <div className={`pr-fill ${budget ? health : "warn"}`} style={{ width: `${budget ? Math.min(pct, 100) : 0}%` }} />
      </div>
    </article>
  );
}

function BarChart({
  buckets,
  allocationMinutes,
  colorByAllocation,
  active,
  onActive,
}: {
  buckets: { key: string; label: string; minutes: number }[];
  allocationMinutes: number | null;
  colorByAllocation: boolean;
  active: string | null;
  onActive: (key: string | null) => void;
}) {
  const max = Math.max(...buckets.map((bucket) => bucket.minutes), 1);
  const hasLine = allocationMinutes != null && allocationMinutes > 0;
  const ceiling = Math.max(max, hasLine ? allocationMinutes : 0);
  return (
    <div className="pr-bars">
      {hasLine ? (
        <span
          className="pr-allocation-line"
          style={{ bottom: `calc(24px + (100% - 46px) * ${allocationMinutes / ceiling})` }}
        />
      ) : null}
      {buckets.map((bucket) => {
        const within = hasLine ? Math.min(bucket.minutes, allocationMinutes) : bucket.minutes;
        const over = hasLine ? Math.max(0, bucket.minutes - allocationMinutes) : 0;
        const height = `${(bucket.minutes / ceiling) * 100}%`;
        return (
          <button
            key={bucket.key}
            type="button"
            className={`pr-bar ${active === bucket.key ? "active" : ""}`}
            onMouseEnter={() => onActive(bucket.key)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(bucket.key)}
            onBlur={() => onActive(null)}
          >
            <span className="pr-bar-stack">
              {colorByAllocation && hasLine ? (
                <span className="pr-bar-col" style={{ height }}>
                  <span className="pr-bar-value">{formatHours(bucket.minutes / 60)}h</span>
                  {over > 0 ? <span className="pr-bar-over" style={{ flexGrow: over }} /> : null}
                  {within > 0 ? (
                    <span className={`pr-bar-within ${over > 0 ? "split" : "solo"}`} style={{ flexGrow: within }} />
                  ) : null}
                </span>
              ) : (
                <span className="bill" style={{ height }}>
                  <span className="pr-bar-value">{formatHours(bucket.minutes / 60)}h</span>
                </span>
              )}
            </span>
            <span className="pr-bar-label">{bucket.label}</span>
            {active === bucket.key ? (
              <span className="pr-tip" role="tooltip">
                <strong>{bucket.label}</strong>
                {formatHours(bucket.minutes / 60)}h tracked
                {hasLine ? (
                  <>
                    <br />
                    {formatHours(allocationMinutes / 60)}h allocated
                  </>
                ) : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DonutChart({
  slices,
  rates,
  active,
  onActive,
  clientSlug,
  range,
}: {
  slices: { label: string; minutes: number; color: string }[];
  rates: { name: string; hourly: number }[];
  active: string | null;
  onActive: (label: string | null) => void;
  clientSlug: string;
  range: ProfitRange;
}) {
  const navigate = useNavigate();
  if (!slices.length) return <p className="pr-note">No tracked time in this period.</p>;
  const total = slices.reduce((sum, slice) => sum + slice.minutes, 0);
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const activeSlice = slices.find((slice) => slice.label === active);
  const sliceCost = (minutes: number, label: string) => {
    const hourly = hourlyCostFor(label, rates);
    return hourly == null ? null : (minutes / 60) * hourly;
  };

  return (
    <div className="pr-donut-wrap">
      <div className="pr-donut">
        <svg viewBox="0 0 200 200" role="img" aria-label="Time by team member">
          <g transform="rotate(-90 100 100)">
            {slices.map((slice) => {
              const length = total ? (slice.minutes / total) * circumference : 0;
              const gap = length > 6 ? 2 : 0;
              const visible = Math.max(length - gap, 0);
              const dash = `${visible} ${circumference - visible}`;
              const offset = -cursor;
              cursor += length;
              return (
                <circle
                  key={slice.label}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="26"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  opacity={!active || active === slice.label ? 1 : 0.35}
                  onMouseEnter={() => onActive(slice.label)}
                  onMouseLeave={() => onActive(null)}
                />
              );
            })}
          </g>
          <text x="100" y="96" textAnchor="middle" className="pr-donut-value">
            {formatHours(total / 60)}h
          </text>
          <text x="100" y="116" textAnchor="middle" className="pr-donut-sub">
            logged
          </text>
        </svg>
        {activeSlice ? (
          <div className="pr-tip floating" role="tooltip">
            <strong>{activeSlice.label}</strong>
            {((activeSlice.minutes / total) * 100).toFixed(1)}% · {formatHoursMinutes(activeSlice.minutes)}
            {sliceCost(activeSlice.minutes, activeSlice.label) == null
              ? ""
              : ` · ${formatMoney(sliceCost(activeSlice.minutes, activeSlice.label) || 0)}`}
          </div>
        ) : null}
      </div>
      <ul className="pr-donut-legend">
        {slices.map((slice) => {
          const pct = total ? (slice.minutes / total) * 100 : 0;
          return (
            <li key={slice.label}>
              <button
                type="button"
                className={active === slice.label ? "active" : ""}
                onMouseEnter={() => onActive(slice.label)}
                onMouseLeave={() => onActive(null)}
                onFocus={() => onActive(slice.label)}
                onBlur={() => onActive(null)}
              >
                <i style={{ background: slice.color }} />
                <span
                  className="pr-member-link"
                  onClick={(event) => {
                    event.stopPropagation();
                    const teamRange = range === "quarter" ? "quarter" : "month";
                    navigate(`/profitability/team/${memberSlug(slice.label)}?range=${teamRange}&client=${clientSlug}`);
                  }}
                >
                  {slice.label}
                </span>
                <em>
                  {pct.toFixed(1)}% · {formatHoursMinutes(slice.minutes)}
                </em>
                <b>{sliceCost(slice.minutes, slice.label) == null ? "—" : formatMoney(sliceCost(slice.minutes, slice.label) || 0)}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
