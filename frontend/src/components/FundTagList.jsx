import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { BACKEND_URL } from '../lib/api.js'
import '../styles/portfolio.css'

const TYPE_ORDER = ['Equity', 'Hybrid', 'Debt', 'Other']

function badgeClass(type) {
  return { Equity: 'equity', Debt: 'debt', Hybrid: 'hybrid' }[type] || 'other'
}

function fmtInr(n) {
  if (n == null || isNaN(n)) return null
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function FundTagList({ funds, onUpdate }) {
  const [toggling, setToggling] = useState({}) // { id: true } while toggling

  async function handleToggle(fund, newValue) {
    setToggling(t => ({ ...t, [fund.id]: true }))

    // Optimistic update
    onUpdate(fund.id, newValue)

    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${BACKEND_URL}/api/cas/funds/${encodeURIComponent(fund.id)}`, {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ show_in_child_app: newValue }),
    })

    setToggling(t => ({ ...t, [fund.id]: false }))
  }

  // Group by scheme_type
  const grouped = {}
  for (const f of funds) {
    const key = f.scheme_type || 'Other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(f)
  }

  const visibleCount = funds.filter(f => f.show_in_child_app).length

  return (
    <div>
      {/* Child preview strip */}
      <div className="child-preview">
        <div className="child-preview__label">What your child sees</div>
        <div className="child-preview__title">
          {visibleCount} fund{visibleCount !== 1 ? 's' : ''} shared
        </div>
        <div className="child-preview__sub">
          Daily NAV changes are never shown — only total growth since inception.
        </div>
      </div>

      {TYPE_ORDER.filter(t => grouped[t]?.length).map(type => (
        <div key={type} className="fund-type-group">
          <div className="fund-type-header">
            <span className={`fund-type-badge ${badgeClass(type)}`}>{type}</span>
            <span className="fund-type-count">
              {grouped[type].length} fund{grouped[type].length !== 1 ? 's' : ''}
              {type === 'Equity' && ' — visible by default'}
            </span>
          </div>

          {grouped[type].map(fund => {
            const value = fmtInr(fund.current_value)
            return (
              <div key={fund.id} className="fund-row">
                <div className="fund-row__info">
                  <div className="fund-row__name">{fund.fund_name}</div>
                  {fund.amc && (
                    <div className="fund-row__isin">{fund.amc}</div>
                  )}
                  {value && (
                    <div className="fund-row__value">{value}</div>
                  )}
                </div>

                <div className="toggle-wrap">
                  <span className="toggle-label">
                    {fund.show_in_child_app ? 'Shared' : 'Hidden'}
                  </span>
                  <label className="toggle" aria-label={`Share ${fund.fund_name}`}>
                    <input
                      type="checkbox"
                      checked={fund.show_in_child_app}
                      disabled={!!toggling[fund.id]}
                      onChange={e => handleToggle(fund, e.target.checked)}
                    />
                    <span className="toggle__track" />
                    <span className="toggle__thumb" />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
