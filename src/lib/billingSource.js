export function billingSourceLabel(qbo) {
  if (qbo?.source === 'quickbooks') return 'Source: QuickBooks refresh'
  if (qbo?.source === 'sample') return 'Source: sample data'
  return 'Source: manual snapshot'
}

export function billingSourceDetail(qbo, formatStamp) {
  if (qbo?.source === 'quickbooks' && qbo.refreshed_at) return `Last refreshed ${formatStamp(qbo.refreshed_at)}`
  return ''
}
