import {
  entriesFor,
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
  { id: "month", label: "This Month" },
  { id: "quarter", label: "This Quarter" },
] as const;

export type TeamRange = (typeof TEAM_RANGES)[number]["id"];

const SEGMENT_COLORS = ["#5b21b6", "#6d28d9", "#7c3aed", "#2563eb", "#3b82f6", "#0f766e", "#0369a1", "#4c1d95"];

export function teamRange(value: string | undefined): TeamRange {
  return value === "quarter" ? "quarter" : "month";
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
  const period = entriesFor(entries, clients, range, "all", bounds);
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
      if (countsAsClient(entry.clientSlug) && entry.minutes > 0) active.add(entry.clientSlug);
    }
    const slices = [...byClient.entries()]
      .map(([slug, clientMinutes]) => ({
        slug,
        name: names.get(slug) || slug,
        minutes: clientMinutes,
        labor: hourly == null ? null : (clientMinutes / 60) * hourly,
      }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
    const internalMinutes = byClient.get(INTERNAL_SLUG) || 0;
    const personUncosted = hourly == null ? minutes / 60 : 0;
    if (hourly == null) uncostedHours += personUncosted;
    else labor += (minutes / 60) * hourly;
    totalMinutes += minutes;
    people.push({
      name,
      slug: memberSlug(name),
      minutes,
      clientMinutes: minutes - internalMinutes,
      internalMinutes,
      activeClients: slices.filter((slice) => countsAsClient(slice.slug) && slice.minutes > 0).length,
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

function countsAsClient(slug: string) {
  return slug !== INTERNAL_SLUG && slug !== OTHER_TRACKED_SLUG;
}

function periodBuckets(range: TeamRange, bounds: DateBounds) {
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
