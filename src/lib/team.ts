import {
  findCostRate,
  hourlyCostFor,
  monthLabel,
  type CostRate,
  type DateBounds,
  type ProfitClient,
  type TimeEntry,
} from "./profitability";

export const INTERNAL_SLUG = "brandastic";
/** Time with no Jira issue, or an issue Jira did not name. */
export const OTHER_TRACKED_SLUG = "other-tracked";

export function projectKeySlug(key: string) {
  return `key-${key.toLowerCase()}`;
}

export const TEAM_RANGES = [
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
] as const;

export type TeamRange = (typeof TEAM_RANGES)[number]["id"];

const SEGMENT_COLORS = ["#5b21b6", "#6d28d9", "#7c3aed", "#2563eb", "#3b82f6", "#0f766e", "#0369a1", "#4c1d95"];
const PERSON_COLORS = ["#5b21b6", "#2563eb", "#0f766e", "#c026d3", "#b45309", "#0369a1", "#be185d", "#4338ca", "#0e7490", "#65a30d"];
const MARKETING_COLOR = "#94a3b8";
const ADMIN_COLOR = "#475569";
const OTHER_CLIENT_COLOR = "#64748b";
const OTHER_TRACKED_COLOR = "#78716c";
const UNUSED_COLOR = "#cbd5e1";

export function teamRange(value: string | undefined): TeamRange {
  if (value === "week" || value === "quarter" || value === "month") return value;
  return "month";
}

export function memberSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "member"
  );
}

export function clientColor(slug: string) {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SEGMENT_COLORS[hash % SEGMENT_COLORS.length];
}

export type ClientSlice = {
  slug: string;
  name: string;
  minutes: number;
  labor: number | null;
};

export type HourSegment = {
  key: string;
  name: string;
  slug: string | null;
  minutes: number;
  color: string;
};

export type TeamPerson = {
  name: string;
  slug: string;
  minutes: number;
  clientMinutes: number;
  internalMinutes: number;
  activeClients: number;
  labor: number | null;
  uncostedHours: number;
  clients: ClientSlice[];
};

export type TeamReport = {
  people: TeamPerson[];
  totalMinutes: number;
  activeClients: number;
  labor: number;
  uncostedHours: number;
};

export function buildTeam(
  entries: TimeEntry[],
  clients: ProfitClient[],
  rates: CostRate[],
  roster: string[],
  range: TeamRange,
  bounds: DateBounds
): TeamReport {
  const names = new Map(clients.map((client) => [client.slug, client.name]));
  const window = periodWindow(range, bounds);
  const period = entries.filter((entry) => entry.date >= window.start && entry.date <= window.end);
  const byMember = new Map<string, TimeEntry[]>();
  for (const name of roster) byMember.set(name, []);
  for (const entry of period) {
    const list = byMember.get(entry.member) || [];
    list.push(entry);
    byMember.set(entry.member, list);
  }

  const active = new Set<string>();
  let totalMinutes = 0;
  let labor = 0;
  let uncostedHours = 0;
  const people: TeamPerson[] = [];

  for (const [name, list] of byMember) {
    const hourly = hourlyCostFor(name, rates);
    const byClient = new Map<string, number>();
    let minutes = 0;
    for (const entry of list) {
      minutes += entry.minutes;
      byClient.set(entry.clientSlug, (byClient.get(entry.clientSlug) || 0) + entry.minutes);
      if (isClientWork(entry.clientSlug, names.get(entry.clientSlug) || entry.clientSlug) && entry.minutes > 0) {
        active.add(entry.clientSlug);
      }
    }
    const slices = [...byClient.entries()]
      .map(([slug, clientMinutes]) => ({
        slug,
        name: clientDisplayName(slug, names.get(slug) || slug),
        minutes: clientMinutes,
        labor: hourly == null ? null : (clientMinutes / 60) * hourly,
      }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
    const internalMinutes = internalMinutesIn(byClient, names);
    const trackedMinutes = trackedMinutesIn(byClient, names);
    const personUncosted = hourly == null ? minutes / 60 : 0;
    if (hourly == null) uncostedHours += personUncosted;
    else labor += (minutes / 60) * hourly;
    totalMinutes += minutes;
    people.push({
      name,
      slug: memberSlug(name),
      minutes,
      clientMinutes: Math.max(0, minutes - internalMinutes - trackedMinutes),
      internalMinutes,
      activeClients: slices.filter((slice) => isClientWork(slice.slug, slice.name) && slice.minutes > 0).length,
      labor: hourly == null ? null : (minutes / 60) * hourly,
      uncostedHours: personUncosted,
      clients: slices,
    });
  }

  people.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  return { people, totalMinutes, activeClients: active.size, labor, uncostedHours };
}

export function topSegments(clients: ClientSlice[], limit = 4): HourSegment[] {
  const top = clients.filter((client) => client.minutes > 0).slice(0, limit);
  const rest = clients.filter((client) => client.minutes > 0).slice(limit);
  const segments: HourSegment[] = top.map((client) => ({
    key: client.slug,
    name: client.name,
    slug: client.slug,
    minutes: client.minutes,
    color: clientColor(client.slug),
  }));
  const other = rest.reduce((sum, client) => sum + client.minutes, 0);
  if (other > 0) {
    segments.push({ key: "other", name: "Other clients", slug: null, minutes: other, color: "#cbd5e1" });
  }
  return segments;
}

export type TrendBucket = {
  key: string;
  label: string;
  minutes: number;
  segments: HourSegment[];
};

export function personTrend(
  entries: TimeEntry[],
  range: TeamRange,
  bounds: DateBounds,
  names: Map<string, string>
): TrendBucket[] {
  const ranked = new Map<string, number>();
  for (const entry of entries) ranked.set(entry.clientSlug, (ranked.get(entry.clientSlug) || 0) + entry.minutes);
  const top = [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([slug]) => slug);
  const topSet = new Set(top);

  return periodBuckets(range, bounds).map((bucket) => {
    const totals = new Map<string, number>();
    for (const entry of entries) {
      if (entry.date < bucket.start || entry.date > bucket.end) continue;
      totals.set(entry.clientSlug, (totals.get(entry.clientSlug) || 0) + entry.minutes);
    }
    const segments: HourSegment[] = [];
    for (const slug of top) {
      const minutes = totals.get(slug) || 0;
      if (!minutes) continue;
      segments.push({
        key: slug,
        name: names.get(slug) || slug,
        slug,
        minutes,
        color: clientColor(slug),
      });
    }
    let other = 0;
    for (const [slug, minutes] of totals) {
      if (!topSet.has(slug)) other += minutes;
    }
    if (other > 0) {
      segments.push({ key: "other", name: "Other clients", slug: null, minutes: other, color: "#cbd5e1" });
    }
    const minutes = [...totals.values()].reduce((sum, value) => sum + value, 0);
    return { key: bucket.key, label: bucket.label, minutes, segments };
  });
}

function periodBuckets(range: TeamRange, bounds: DateBounds) {
  if (range === "week") {
    const buckets: { key: string; label: string; start: string; end: string }[] = [];
    let cursor = periodWindow("week", bounds).start;
    while (cursor <= bounds.asOf) {
      buckets.push({ key: cursor, label: shortDay(cursor), start: cursor, end: cursor });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }
  if (range === "quarter") {
    const buckets: { key: string; label: string; start: string; end: string }[] = [];
    let cursor = bounds.quarterStart;
    const endMonth = bounds.asOf.slice(0, 7);
    while (cursor.slice(0, 7) <= endMonth) {
      const key = cursor.slice(0, 7);
      const [year, month] = key.split("-").map(Number);
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const monthEnd = `${key}-${String(last).padStart(2, "0")}`;
      buckets.push({
        key,
        label: monthLabel(month),
        start: `${key}-01`,
        end: monthEnd > bounds.asOf ? bounds.asOf : monthEnd,
      });
      cursor = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    }
    return buckets;
  }

  const buckets: { key: string; label: string; start: string; end: string }[] = [];
  let start = bounds.monthStart;
  while (start <= bounds.asOf) {
    const end = minDate(addDays(start, 6), bounds.asOf);
    buckets.push({ key: start, label: shortDay(start), start, end });
    start = addDays(end, 1);
  }
  return buckets;
}

function shortDay(iso: string) {
  const [, month, day] = iso.split("-").map(Number);
  return `${monthLabel(month)} ${day}`;
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

export type CapacityStatus = "over" | "risk" | "healthy" | "spare";

export type AllocationPerson = {
  name: string;
  slug: string;
  role: string;
  kind: "employee" | "contractor";
  minutes: number;
  previousMinutes: number | null;
  capacityMinutes: number;
  clientMinutes: number;
  internalMinutes: number;
  clientCount: number;
  utilization: number | null;
  clientPct: number | null;
  internalPct: number | null;
  status: CapacityStatus | null;
  labor: number | null;
  markerPct: number | null;
  segments: HourSegment[];
  clients: ClientSlice[];
};

export type ClientTeamRow = {
  slug: string;
  name: string;
  minutes: number;
  linked: boolean;
  people: HourSegment[];
};

export type AllocationReport = {
  employees: AllocationPerson[];
  contractors: AllocationPerson[];
  clients: ClientTeamRow[];
  employeeMinutes: number;
  employeeCapacityMinutes: number;
  employeeClientMinutes: number;
  employeeInternalMinutes: number;
  contractorMinutes: number;
  utilization: number | null;
  clientPct: number | null;
  internalPct: number | null;
  compareLabel: string;
};

export function capacityStatus(pct: number | null): CapacityStatus | null {
  if (pct == null) return null;
  if (pct > 100) return "over";
  if (pct >= 90) return "risk";
  if (pct >= 70) return "healthy";
  return "spare";
}

export function statusLabel(status: CapacityStatus) {
  if (status === "over") return "Overbooked";
  if (status === "risk") return "At risk";
  if (status === "healthy") return "Healthy";
  return "Spare capacity";
}

export function buildAllocation(
  entries: TimeEntry[],
  clients: ProfitClient[],
  rates: CostRate[],
  roster: string[],
  range: TeamRange,
  bounds: DateBounds,
  reportSlugs: string[] = []
): AllocationReport {
  const names = new Map(clients.map((client) => [client.slug, client.name]));
  const linked = new Set(reportSlugs);
  const currentWindow = periodWindow(range, bounds);
  const previous = previousWindow(range, bounds);
  const currentEntries = entries.filter((entry) => entry.date >= currentWindow.start && entry.date <= currentWindow.end);
  const previousEntries = previous
    ? entries.filter((entry) => entry.date >= previous.start && entry.date <= previous.end)
    : [];

  const people = new Map<string, { name: string; rate: CostRate | null }>();
  const addPerson = (name: string) => {
    if (!name || normalize(name) === "unassigned") return;
    const rate = findCostRate(name, rates);
    const display = rate?.name || name.trim();
    const key = normalize(display);
    if (!key || key === "unassigned" || people.has(key)) return;
    people.set(key, { name: display, rate });
  };
  for (const name of roster) addPerson(name);
  for (const rate of rates) addPerson(rate.name);
  for (const entry of currentEntries) addPerson(entry.member);

  const currentByPerson = groupMinutes(currentEntries, rates);
  const previousByPerson = groupMinutes(previousEntries, rates);
  const capacityMinutes = (weekly: number) => Math.round(weekly * (weekdays(currentWindow.start, currentWindow.end) / 5) * 60);

  const built: AllocationPerson[] = [];
  for (const [key, person] of people) {
    const kind = person.rate?.workerType === "contractor" ? "contractor" : "employee";
    const weekly = person.rate?.weeklyCapacity;
    const weeklyHours = kind === "employee" && weekly != null && weekly > 0 ? weekly : 40;
    const cap = kind === "employee" ? capacityMinutes(weeklyHours) : 0;
    const buckets = currentByPerson.get(key) || new Map<string, number>();
    const minutes = [...buckets.values()].reduce((sum, value) => sum + value, 0);
    const internalMinutes = internalMinutesIn(buckets, names);
    const trackedMinutes = trackedMinutesIn(buckets, names);
    const clientMinutes = Math.max(0, minutes - internalMinutes - trackedMinutes);
    const clientCount = [...buckets.entries()].filter(([slug, value]) => value > 0 && isClientWork(slug, names.get(slug) || slug)).length;
    const hourly = person.rate ? person.rate.hourly : hourlyCostFor(person.name, rates);
    const slices = slicesFrom(buckets, names, hourly);
    const utilization = kind === "employee" && cap > 0 ? (minutes / cap) * 100 : null;
    const scale = Math.max(cap, minutes);
    built.push({
      name: person.name,
      slug: memberSlug(person.name),
      role: (person.rate?.role || "").trim(),
      kind,
      minutes,
      previousMinutes: previous ? minutesIn(previousByPerson.get(key)) : null,
      capacityMinutes: cap,
      clientMinutes,
      internalMinutes,
      clientCount,
      utilization,
      clientPct: minutes > 0 ? (clientMinutes / minutes) * 100 : null,
      internalPct: minutes > 0 ? (internalMinutes / minutes) * 100 : null,
      status: capacityStatus(utilization),
      labor: hourly == null ? null : (minutes / 60) * hourly,
      markerPct: kind === "employee" && scale > 0 ? (cap / scale) * 100 : null,
      segments: allocationSegments(slices, cap, minutes),
      clients: slices,
    });
  }

  const employees = built
    .filter((person) => person.kind === "employee")
    .sort((a, b) => (b.utilization ?? -1) - (a.utilization ?? -1) || a.name.localeCompare(b.name));
  const contractors = built
    .filter((person) => person.kind === "contractor")
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  const employeeMinutes = employees.reduce((sum, person) => sum + person.minutes, 0);
  const employeeCapacityMinutes = employees.reduce((sum, person) => sum + person.capacityMinutes, 0);
  const employeeClientMinutes = employees.reduce((sum, person) => sum + person.clientMinutes, 0);
  const employeeInternalMinutes = employees.reduce((sum, person) => sum + person.internalMinutes, 0);
  const contractorMinutes = contractors.reduce((sum, person) => sum + person.minutes, 0);

  return {
    employees,
    contractors,
    clients: clientRows(currentEntries, rates, names, linked),
    employeeMinutes,
    employeeCapacityMinutes,
    employeeClientMinutes,
    employeeInternalMinutes,
    contractorMinutes,
    utilization: employeeCapacityMinutes > 0 ? (employeeMinutes / employeeCapacityMinutes) * 100 : null,
    clientPct: employeeMinutes > 0 ? (employeeClientMinutes / employeeMinutes) * 100 : null,
    internalPct: employeeMinutes > 0 ? (employeeInternalMinutes / employeeMinutes) * 100 : null,
    compareLabel: range === "week" ? "last week" : range === "quarter" ? "last quarter" : "last month",
  };
}

function periodWindow(range: TeamRange, bounds: DateBounds) {
  if (range === "week") return { start: mondayOf(bounds.asOf), end: bounds.asOf };
  if (range === "month") return { start: bounds.monthStart, end: bounds.asOf };
  return { start: bounds.quarterStart, end: bounds.asOf };
}

function previousWindow(range: TeamRange, bounds: DateBounds) {
  const current = periodWindow(range, bounds);
  const start = range === "week" ? addDays(current.start, -7) : shiftMonthsIso(current.start, range === "quarter" ? -3 : -1);
  const end = range === "week" ? addDays(current.end, -7) : shiftMonthsIso(current.end, range === "quarter" ? -3 : -1);
  if (start < bounds.quarterStart) return null;
  return { start, end };
}

function minutesIn(buckets: Map<string, number> | undefined) {
  if (!buckets) return 0;
  let total = 0;
  for (const value of buckets.values()) total += value;
  return total;
}

function groupMinutes(entries: TimeEntry[], rates: CostRate[]) {
  const grouped = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const rate = findCostRate(entry.member, rates);
    const display = rate?.name || entry.member || "Unassigned";
    const key = normalize(display) || "unassigned";
    const bucket = grouped.get(key) || new Map<string, number>();
    bucket.set(entry.clientSlug, (bucket.get(entry.clientSlug) || 0) + entry.minutes);
    grouped.set(key, bucket);
  }
  return grouped;
}

function slicesFrom(buckets: Map<string, number>, names: Map<string, string>, hourly: number | null): ClientSlice[] {
  return [...buckets.entries()]
    .map(([slug, minutes]) => ({
      slug,
      name: clientDisplayName(slug, names.get(slug) || slug),
      minutes,
      labor: hourly == null ? null : (minutes / 60) * hourly,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

function allocationSegments(slices: ClientSlice[], capacityMinutes: number, loggedMinutes: number): HourSegment[] {
  const work = slices.filter((slice) => slice.minutes > 0 && isClientWork(slice.slug, slice.name));
  const top = work.slice(0, 5);
  const rest = work.slice(5);
  const segments: HourSegment[] = top.map((slice) => ({
    key: slice.slug,
    name: slice.name,
    slug: slice.slug,
    minutes: slice.minutes,
    color: clientColor(slice.slug),
  }));
  const other = rest.reduce((sum, slice) => sum + slice.minutes, 0);
  if (other > 0) {
    segments.push({ key: "other", name: "Other clients", slug: null, minutes: other, color: OTHER_CLIENT_COLOR });
  }
  const tracked = slices.filter((slice) => slice.minutes > 0 && isTracked(slice.slug, slice.name)).reduce((sum, slice) => sum + slice.minutes, 0);
  if (tracked > 0) {
    segments.push({ key: "tracked", name: "Other tracked time", slug: null, minutes: tracked, color: OTHER_TRACKED_COLOR });
  }
  const marketing = minutesOfKind(slices, "marketing");
  if (marketing > 0) {
    segments.push({ key: "brandastic-marketing", name: "Brandastic Marketing", slug: INTERNAL_SLUG, minutes: marketing, color: MARKETING_COLOR });
  }
  const admin = minutesOfKind(slices, "admin");
  if (admin > 0) {
    segments.push({ key: "brandastic-admin", name: "Brandastic Admin", slug: "key-bc", minutes: admin, color: ADMIN_COLOR });
  }
  const unused = Math.max(0, capacityMinutes - loggedMinutes);
  if (unused > 0) {
    segments.push({ key: "unused", name: "Unused capacity", slug: null, minutes: unused, color: UNUSED_COLOR });
  }
  return segments;
}

function clientRows(
  entries: TimeEntry[],
  rates: CostRate[],
  names: Map<string, string>,
  linked: Set<string>
): ClientTeamRow[] {
  const byClient = new Map<string, Map<string, { name: string; minutes: number }>>();
  for (const entry of entries) {
    if (entry.minutes <= 0) continue;
    const rate = findCostRate(entry.member, rates);
    const personName = rate?.name || entry.member || "Unassigned";
    const people = byClient.get(entry.clientSlug) || new Map<string, { name: string; minutes: number }>();
    const current = people.get(personName) || { name: personName, minutes: 0 };
    current.minutes += entry.minutes;
    people.set(personName, current);
    byClient.set(entry.clientSlug, people);
  }
  return [...byClient.entries()]
    .map(([slug, people]) => {
      const sourceName = names.get(slug) || slug;
      const name = clientDisplayName(slug, sourceName);
      const list = [...people.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
      const minutes = list.reduce((sum, person) => sum + person.minutes, 0);
      return {
        slug,
        name,
        minutes,
        internal: internalKind(slug, sourceName),
        linked: linked.has(slug),
        people: list.map((person) => ({
          key: memberSlug(person.name),
          name: person.name,
          slug: memberSlug(person.name),
          minutes: person.minutes,
          color: person.name === "Unassigned" ? UNUSED_COLOR : personColor(person.name),
        })),
      };
    })
    .filter((row) => row.minutes > 0)
    .sort((a, b) => {
      const group = Number(Boolean(a.internal)) - Number(Boolean(b.internal));
      if (group !== 0) return group;
      if (a.internal && b.internal && a.internal !== b.internal) return a.internal === "marketing" ? -1 : 1;
      return b.minutes - a.minutes || a.name.localeCompare(b.name);
    })
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      minutes: row.minutes,
      linked: row.linked,
      people: row.people,
    }));
}

function internalMinutesIn(buckets: Map<string, number>, names: Map<string, string>) {
  let total = 0;
  for (const [slug, minutes] of buckets) {
    if (isInternal(slug, names.get(slug) || slug)) total += minutes;
  }
  return total;
}

function trackedMinutesIn(buckets: Map<string, number>, names: Map<string, string>) {
  let total = 0;
  for (const [slug, minutes] of buckets) {
    if (isTracked(slug, names.get(slug) || slug)) total += minutes;
  }
  return total;
}

type InternalKind = "marketing" | "admin";

function internalKind(slug: string, name: string): InternalKind | null {
  const label = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (label === "brandastic collateral" || label === "brandastic admin" || matchesProject(slug, name, ["bc", "brandastic-collateral"])) {
    return "admin";
  }
  if (label === "brandastic" || label === "brandastic marketing" || matchesProject(slug, name, ["brandastic", "sbr"])) {
    return "marketing";
  }
  return null;
}

function matchesProject(slug: string, name: string, keys: string[]) {
  const slugKey = slug.trim().toLowerCase();
  const label = name.trim().toLowerCase().replace(/\s+/g, " ");
  return keys.some((key) => slugKey === key || slugKey === `key-${key}` || label === key);
}

export function clientDisplayName(slug: string, name: string) {
  const kind = internalKind(slug, name);
  if (kind === "marketing") return "Brandastic Marketing";
  if (kind === "admin") return "Brandastic Admin";
  return name;
}

function minutesOfKind(slices: ClientSlice[], kind: InternalKind) {
  return slices
    .filter((slice) => slice.minutes > 0 && internalKind(slice.slug, slice.name) === kind)
    .reduce((sum, slice) => sum + slice.minutes, 0);
}

function isInternal(slug: string, name: string) {
  return internalKind(slug, name) != null;
}

function isTracked(slug: string, name: string) {
  return slug === OTHER_TRACKED_SLUG || name.trim().toLowerCase() === "other tracked time";
}

function isClientWork(slug: string, name: string) {
  return !isInternal(slug, name) && !isTracked(slug, name);
}

function personColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[hash % PERSON_COLORS.length];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mondayOf(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return date.toISOString().slice(0, 10);
}

function weekdays(start: string, end: string) {
  if (end < start) return 0;
  let count = 0;
  let cursor = start;
  while (cursor <= end) {
    const [year, month, day] = cursor.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

function shiftMonthsIso(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
