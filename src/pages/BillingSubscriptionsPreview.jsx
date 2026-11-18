import { useEffect, useState } from 'react'
import '../profitability.css'
import { BillingScreen } from './BillingScreen'

function emptyReport(subscriptions) {
  return {
    sample: false,
    updated_at: null,
    clients: [],
    alerts: [],
    non_recurring_unpaid: [],
    other_open: [],
    summary: {
      mrr: 0,
      client_count: 0,
      open_balance: 0,
      overdue_balance: 0,
      no_payment_90_count: 0,
    },
    subscriptions,
  }
}

const NOT_LOADED = {
  configured: false,
  updated_at: null,
  source_window: null,
  source: '',
  access_issues: [],
  items: [],
  totals: {
    subscription_count: 0,
    possible_count: 0,
    annual_count: 0,
    stopped_count: 0,
    monthly_run_rate: null,
    annualized_cost: null,
    note: '',
    price_increase_count: 0,
    overlap_count: 0,
  },
}

export default function BillingSubscriptionsPreview() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('empty') === '1') {
      setState({ status: 'ready', report: emptyReport(NOT_LOADED) })
      return undefined
    }
    let cancelled = false
    fetch('/dev/billing-subscriptions-fixture', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('fixture')
        return response.json()
      })
      .then((report) => {
        if (!cancelled) setState({ status: 'ready', report })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'ready', report: emptyReport(NOT_LOADED) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <BillingScreen state={state} view="subscriptions" />
}
