const KEY = 'brandastic-strategy-goals-2027'

export const OWNERS = [
  'Unassigned',
  'Justin',
  'Sandy',
  'Samantha',
  'Maxwell',
  'Stacy',
  'Chip',
  'Jonathan',
  'Chloe',
  'Aimee',
  'CJ',
  'Whole team',
]

export const DEFAULT_GOALS = [
  {
    id: 'wp-week',
    title: 'WordPress + Grok, one week',
    body: 'Stand up a WordPress site and build it with Grok so we can launch a new site in a week.',
    owner: 'Unassigned',
    href: '',
  },
  {
    id: 'dashboards',
    title: 'Campaign dashboards',
    body: 'Build dashboards so we can see what’s working in ads and make campaigns better.',
    owner: 'Unassigned',
    href: 'https://dash.brandastic.com',
  },
  {
    id: 'internal-software',
    title: 'Our own software',
    body: 'Keep building internal software so the team has a clear view of the work.',
    owner: 'Unassigned',
    href: 'https://brandastic.co',
  },
  {
    id: 'education',
    title: 'Win in education',
    body: 'Focus on a market we can win. Education. Get campaigns working. Close one new school a month.',
    owner: 'Unassigned',
    href: 'https://audit.brandastic.com/gameplan_marketing/brandastic-2027-education.html',
  },
  {
    id: 'monday',
    title: 'Monday improvement',
    body: 'Monday meetings: what is working, what to fix. Constant improvement, like the old map meetings. Anyone doing something cool with Grok bots?',
    owner: 'Unassigned',
    href: '',
  },
  {
    id: 'discovery-ai',
    title: 'Discovery with AI',
    body: 'The team builds discovery and strategies with Grok bots that can connect to Canva.',
    owner: 'Unassigned',
    href: '',
  },
  {
    id: 'grok-bots',
    title: 'A Grok bot for everyone',
    body: 'Every teammate has their own Grok bot to build things for the team.',
    owner: 'Unassigned',
    href: '',
  },
]

export function loadStrategyGoals() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_GOALS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_GOALS
    return parsed
  } catch {
    return DEFAULT_GOALS
  }
}

export function saveStrategyGoals(goals) {
  localStorage.setItem(KEY, JSON.stringify(goals))
}
