export const PROFIT_RANGES = [
  { id: "quarter", label: "This Quarter" },
  { id: "month", label: "This Month" },
  { id: "year", label: "Contract Year" },
] as const;

export type ProfitRange = (typeof PROFIT_RANGES)[number]["id"];

export function profitRange(value: string | undefined): ProfitRange {
  if (value === "quarter" || value === "month" || value === "year") return value;
  return "month";
}

export type RenewalKind = "date" | "mtm" | "unknown";

export type ProfitClient = {
  slug: string;
  name: string;
  budgetAmount: number;
  allocatedHours: number | null;
  billableRate: number | null;
  renewalKind: RenewalKind;
  renewalDate: string | null;
  renewalMonth: number;
  renewalLabel: string;
  contractStart: string;
  contractEnd: string;
};

export type TimeEntry = {
  id: string;
  clientSlug: string;
  date: string;
  member: string;
  taskId: string;
  task: string;
  description: string;
  minutes: number;
  cost: number;
};

export type DateBounds = {
  asOf: string;
  quarterStart: string;
  monthStart: string;
};

export type TempoCoverage = {
  projectCount: number;
  entryCount: number;
  describedCount: number;
  costedCount: number;
  allocatedCount: number;
};

export type CostRate = { name: string; hourly: number };

export type ProfitabilityData = {
  clients: ProfitClient[];
  /** Every Brand Care client, so a client page can switch without loading every worklog. */
  directory: { slug: string; name: string }[];
  entries: TimeEntry[];
  bounds: DateBounds;
  coverage: TempoCoverage;
  costRates: CostRate[];
  /** Column E on the cost sheet. Null when the cell is blank. */
  monthlyOverhead: number | null;
  /** Allocated hours of clients that have a retainer rate. Overhead is split across this total. */
  payingAllocatedHours: number;
  /** Role names on the Employees team. */
  roster: string[];
  /** Brand Care slugs that have a client report. Set on the team page, which also lists other Tempo projects. */
  reportSlugs?: string[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function clientBySlug(clients: ProfitClient[], slug: string) {
  return clients.find((client) => client.slug === slug);
}

export function quarterStartDate(asOf: string) {
  const [year, month] = asOf.split("-").map(Number);
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${pad(startMonth)}-01`;
}

export function reportWindow(client: ProfitClient, range: ProfitRange, bounds: DateBounds) {
  if (range === "quarter") return { start: bounds.quarterStart, end: bounds.asOf };
  if (range === "month") return { start: bounds.monthStart, end: bounds.asOf };
  if (!client.contractStart || !client.contractEnd) return null;
  return { start: client.contractStart, end: client.contractEnd };
}

export function contractTermLabel(client: ProfitClient) {
  if (client.renewalKind === "mtm") return "Month to month";
  if (client.renewalKind === "date" && client.renewalDate && client.contractStart) {
    return `Contract: ${formatEntryDate(client.contractStart)} – ${formatEntryDate(client.renewalDate)}`;
  }
  return "Contract dates are not on the sheet";
}

export function entriesFor(
  entries: TimeEntry[],
  clients: ProfitClient[],
  range: ProfitRange,
  clientSlug: string,
  bounds: DateBounds
) {
  const bySlug = new Map(clients.map((client) => [client.slug, client]));
  return entries.filter((entry) => {
    if (clientSlug !== "all" && entry.clientSlug !== clientSlug) return false;
    const client = bySlug.get(entry.clientSlug);
    if (!client) return false;
    if (range === "year" && !client.contractStart) return false;
    const start =
      range === "quarter" ? bounds.quarterStart : range === "month" ? bounds.monthStart : client.contractStart;
    const end = range === "year" ? client.contractEnd : bounds.asOf;
    return entry.date >= start && entry.date <= end;
  });
}

export function contractYearWindow(kind: RenewalKind, renewalDate: string | null, asOf: string) {
  if (kind === "mtm") return { start: shiftMonths(asOf, -11), end: asOf };
  if (kind === "date" && renewalDate) {
    const start = addDays(renewalDate, -365);
    return { start, end: renewalDate < asOf ? renewalDate : asOf };
  }
  return null;
}

export function contractMonths(client: ProfitClient) {
  if (!client.contractStart || !client.contractEnd) return null;
  if (client.renewalKind === "mtm") return 12;
  return elapsedContractMonths(client.contractStart, client.contractEnd);
}

export type HourSummary = {
  totalMinutes: number;
  cost: number;
};

export function summarize(entries: TimeEntry[]): HourSummary {
  let totalMinutes = 0;
  let cost = 0;
  for (const entry of entries) {
    totalMinutes += entry.minutes;
    cost += entry.cost;
  }
  return { totalMinutes, cost };
}

export function chartAllocationMinutes(client: ProfitClient | undefined) {
  const monthly = client?.allocatedHours;
  if (monthly == null || monthly <= 0) return null;
  return monthly * 60;
}

export function hoursBudget(client: ProfitClient, range: ProfitRange, bounds: DateBounds): number | null {
  const monthly = client.allocatedHours;
  if (monthly == null || monthly <= 0) return null;
  if (range === "month") return monthly;
  if (range === "quarter") {
    const month = Number(bounds.asOf.slice(5, 7));
    return monthly * (((month - 1) % 3) + 1);
  }
  const months = contractMonths(client);
  return months == null ? null : monthly * months;
}

export function elapsedContractMonths(start: string, asOf: string) {
  const end = asOf < start ? start : asOf;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const daysInEnd = new Date(Date.UTC(ey, em, 0)).getUTCDate();
  const months = (ey - sy) * 12 + (em - sm) + (ed - sd) / daysInEnd;
  return Math.max(months, 1 / 31);
}

export type TrendSummary = {
  averageHours: number;
  allocatedHours: number | null;
  renewalLabel: string;
};

export function contractTrend(
  entries: TimeEntry[],
  clients: ProfitClient[],
  clientSlug: string,
  asOf: string
): TrendSummary {
  const list = clientSlug === "all" ? clients : clients.filter((client) => client.slug === clientSlug);
  const averages = list.flatMap((client) => {
    const months = contractMonths(client);
    if (months == null) return [];
    const minutes = entries
      .filter(
        (entry) =>
          entry.clientSlug === client.slug && entry.date >= client.contractStart && entry.date <= client.contractEnd
      )
      .reduce((sum, entry) => sum + entry.minutes, 0);
    return [minutes / 60 / months];
  });
  const allocations = list
    .map((client) => client.allocatedHours)
    .filter((hours): hours is number => hours != null && hours > 0);
  return {
    averageHours: mean(averages),
    allocatedHours: allocations.length ? mean(allocations) : null,
    renewalLabel: clientSlug === "all" ? nextRenewalLabel(clients, asOf) : list[0]?.renewalLabel || "—",
  };
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nextRenewalLabel(clients: ProfitClient[], asOf: string) {
  const upcoming = clients
    .filter((client) => client.renewalKind === "date" && client.renewalDate && client.renewalDate >= asOf)
    .map((client) => client.renewalDate as string)
    .sort()[0];
  return upcoming ? formatEntryDate(upcoming) : "—";
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonths(iso: string, monthDelta: number) {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + monthDelta, 1));
  return date.toISOString().slice(0, 10);
}

function addMonthsClamped(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const daysInMonth = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonth, Math.min(day, daysInMonth))).toISOString().slice(0, 10);
}

export type ChartBucket = {
  key: string;
  label: string;
  minutes: number;
};

export function chartBuckets(range: ProfitRange, entries: TimeEntry[], bounds: DateBounds): ChartBucket[] {
  if (range === "quarter") {
    const buckets: ChartBucket[] = [];
    let cursor = bounds.quarterStart;
    const endMonth = bounds.asOf.slice(0, 7);
    while (cursor.slice(0, 7) <= endMonth) {
      const key = cursor.slice(0, 7);
      buckets.push(bucket(key, MONTHS[Number(key.slice(5, 7)) - 1], entries.filter((entry) => entry.date.startsWith(key))));
      cursor = shiftMonths(cursor, 1);
    }
    return buckets;
  }
  if (range === "month") {
    const key = bounds.monthStart.slice(0, 7);
    return [bucket(key, MONTHS[Number(key.slice(5, 7)) - 1], entries)];
  }
  const groups = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const list = groups.get(key) || [];
    list.push(entry);
    groups.set(key, list);
  }
  const months = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  const spansYears = new Set(months.map(([key]) => key.slice(0, 4))).size > 1;
  return months.map(([key, list]) => {
    const month = MONTHS[Number(key.slice(5, 7)) - 1];
    const label = spansYears ? `${month} '${key.slice(2, 4)}` : month;
    return bucket(key, label, list);
  });
}

function bucket(key: string, label: string, entries: TimeEntry[]): ChartBucket {
  const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  return { key, label, minutes };
}

export type DonutSlice = {
  label: string;
  minutes: number;
  color: string;
};

const SLICE_COLORS = ["#5b21b6", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#4c1d95", "#ddd6fe"];

export function donutSlices(entries: TimeEntry[], clients: ProfitClient[], clientSlug: string): DonutSlice[] {
  const names = new Map(clients.map((client) => [client.slug, client.name]));
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const label = clientSlug === "all" ? names.get(entry.clientSlug) || entry.clientSlug : entry.member;
    totals.set(label, (totals.get(label) || 0) + entry.minutes);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, minutes], index) => ({
      label,
      minutes,
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    }));
}

export function formatDuration(minutes: number) {
  const totalSeconds = Math.round(minutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${pad(mins)}:${pad(seconds)}`;
}

export function formatHoursMinutes(minutes: number) {
  const totalMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}:${pad(mins)}`;
}

export function formatHours(hours: number) {
  return String(Math.round(hours));
}

export function formatPct(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatEntryDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function burnHealth(pct: number): "ok" | "warn" | "over" {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "ok";
}

export function moneyExact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function monthLabel(month: number) {
  return MONTHS[month - 1] || "—";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const RATE_ALIASES: Record<string, string> = {
  aimee: "aimee mcafee",
  carlos: "carlos cerda",
  chloe: "chloe uyehara",
  cj: "cj williams",
  clara: "clara",
  cory: "cory",
  jonathan: "jonathan",
  justin: "justin nassie",
  maxwell: "maxwell gilbert",
  megan: "megan hahn",
  quentin: "quentin dietz",
  samantha: "samantha o leary",
  "sandy o": "sandy ortiz",
  stacy: "stacy williams",
  melissa: "melissa",
};

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function hourlyCostFor(member: string, rates: CostRate[]): number | null {
  const key = normalizeName(member);
  if (!key) return null;
  const target = key === "unassigned" ? "unassigned" : RATE_ALIASES[key] || key;
  const exact = rates.find((rate) => normalizeName(rate.name) === target);
  if (exact) return exact.hourly;
  if (key === "unassigned") return null;
  const first = key.split(" ")[0];
  const hits = rates.filter((rate) => {
    const name = normalizeName(rate.name);
    return name === first || name.startsWith(`${first} `);
  });
  return hits.length === 1 ? hits[0].hourly : null;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export type DirectProfit = {
  revenue: number | null;
  labor: number;
  overhead: number | null;
  overheadHours: number | null;
  overheadBaseHours: number | null;
  profit: number | null;
  margin: number | null;
  uncostedHours: number;
};

export type BurnPoint = { date: string; amount: number };

export type ContractBurn = {
  start: string;
  end: string;
  /** Step points. The amount applies on that date and holds until the next step. */
  retainer: BurnPoint[];
  labor: BurnPoint[];
  retainerTotal: number | null;
  laborTotal: number;
};

/** Cumulative retainer versus labor for one client's contract window. */
export function contractBurn(client: ProfitClient, entries: TimeEntry[], rates: CostRate[]): ContractBurn | null {
  if (!client.contractStart || !client.contractEnd) return null;
  const start = client.contractStart;
  const end = client.contractEnd;
  const monthly =
    client.allocatedHours != null && client.allocatedHours > 0 && client.billableRate != null && client.billableRate > 0
      ? client.allocatedHours * client.billableRate
      : null;

  const retainer: BurnPoint[] = [];
  if (monthly != null) {
    if (client.renewalKind === "mtm") {
      for (let index = 0; index < 12; index += 1) {
        const date = addMonthsClamped(start, index);
        if (date > end) break;
        retainer.push({ date, amount: monthly * (index + 1) });
      }
      const last = retainer[retainer.length - 1];
      if (!last || last.date < end) retainer.push({ date: end, amount: monthly * 12 });
    } else {
      const elapsed = elapsedContractMonths(start, end);
      retainer.push({ date: start, amount: 0 });
      for (let index = 1; index < 36; index += 1) {
        const date = addMonthsClamped(start, index);
        if (date >= end) break;
        retainer.push({ date, amount: monthly * index });
      }
      const last = retainer[retainer.length - 1];
      if (last?.date === end) last.amount = monthly * elapsed;
      else retainer.push({ date: end, amount: monthly * elapsed });
    }
  }

  const byDate = new Map<string, number>();
  for (const entry of entries) {
    if (entry.clientSlug !== client.slug || entry.date < start || entry.date > end) continue;
    const hourly = hourlyCostFor(entry.member, rates);
    if (hourly == null) continue;
    byDate.set(entry.date, (byDate.get(entry.date) || 0) + (entry.minutes / 60) * hourly);
  }
  const labor: BurnPoint[] = [{ date: start, amount: 0 }];
  let running = 0;
  for (const date of [...byDate.keys()].sort()) {
    running += byDate.get(date) || 0;
    if (date === start) labor[0].amount = running;
    else labor.push({ date, amount: running });
  }
  if (labor[labor.length - 1].date !== end) labor.push({ date: end, amount: running });

  return {
    start,
    end,
    retainer,
    labor,
    retainerTotal: retainer.length ? retainer[retainer.length - 1].amount : null,
    laborTotal: running,
  };
}

function overheadMonths(client: ProfitClient, range: ProfitRange, bounds: DateBounds) {
  if (range === "month") return 1;
  if (range === "quarter") return ((Number(bounds.asOf.slice(5, 7)) - 1) % 3) + 1;
  return contractMonths(client);
}

export function directProfit(
  clients: ProfitClient[],
  entries: TimeEntry[],
  rates: CostRate[],
  range: ProfitRange,
  bounds: DateBounds,
  monthlyOverhead: number | null,
  payingAllocatedHours: number
): DirectProfit {
  let revenue = 0;
  let hasRevenue = false;
  let labor = 0;
  let uncostedHours = 0;
  let overhead = 0;
  let hasOverhead = false;
  let overheadHours = 0;
  const slugs = new Set(clients.map((client) => client.slug));
  for (const client of clients) {
    const hours = hoursBudget(client, range, bounds);
    if (client.billableRate != null && client.billableRate > 0 && hours != null) {
      revenue += hours * client.billableRate;
      hasRevenue = true;
    }
    const months = overheadMonths(client, range, bounds);
    if (
      monthlyOverhead == null ||
      payingAllocatedHours <= 0 ||
      client.allocatedHours == null ||
      client.allocatedHours <= 0 ||
      client.billableRate == null ||
      client.billableRate <= 0 ||
      months == null
    ) {
      continue;
    }
    overhead += monthlyOverhead * (client.allocatedHours / payingAllocatedHours) * months;
    overheadHours += client.allocatedHours;
    hasOverhead = true;
  }
  for (const entry of entries) {
    if (!slugs.has(entry.clientSlug)) continue;
    const hourly = hourlyCostFor(entry.member, rates);
    const logged = entry.minutes / 60;
    if (hourly == null) uncostedHours += logged;
    else labor += logged * hourly;
  }
  const profit = hasRevenue ? revenue - labor - (hasOverhead ? overhead : 0) : null;
  const margin = profit != null && revenue > 0 ? (profit / revenue) * 100 : null;
  return {
    revenue: hasRevenue ? revenue : null,
    labor,
    overhead: hasOverhead ? overhead : null,
    overheadHours: hasOverhead ? overheadHours : null,
    overheadBaseHours: hasOverhead ? payingAllocatedHours : null,
    profit,
    margin,
    uncostedHours,
  };
}
