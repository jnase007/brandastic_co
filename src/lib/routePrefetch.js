const loaders = {
  '/profitability': () => import('../pages/Profitability'),
  '/people': () => import('../pages/ProfitabilityCosts'),
  '/profitability/team': () => import('../pages/ProfitabilityTeam'),
  '/profitability/websites': () => import('../pages/ProfitabilityWebsites'),
  '/hosting': () => import('../pages/Hosting'),
  '/feature-list': () => import('../pages/FeatureList'),
  '/mission': () => import('../pages/Mission'),
  '/strategy': () => import('../pages/Strategy'),
  '/ideal-target-client': () => import('../pages/IdealTargetClient'),
  '/score-card': () => import('../pages/ScoreCard'),
  '/score-card/financials': () => import('../pages/ScoreCardFinancials'),
  '/deals': () => import('../pages/ScoreCardPipeline'),
  '/pipeline': () => import('../pages/SalesPipeline'),
}

const warmed = new Set()

export function prefetchRoute(path) {
  const load = loaders[path]
  if (!load || warmed.has(path)) return
  warmed.add(path)
  load().catch(() => warmed.delete(path))
}

export function prefetchCommonRoutes() {
  ;['/profitability', '/score-card', '/score-card/financials', '/deals', '/feature-list', '/profitability/team'].forEach(prefetchRoute)
}
