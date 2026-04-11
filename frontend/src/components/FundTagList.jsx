import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import '../styles/portfolio.css'

const TYPE_ORDER = ['Equity', 'Hybrid', 'Debt', 'Other']

function badgeClass(type) {
  return { Equity: 'equity', Debt: 'debt', Hybrid: 'hybrid' }[type] || 'other'
}

export default function FundTagList({ funds, onUpdate }) {
  const [toggling, setToggling] = useState({}) // { isin: true } while toggling

  async function handleToggle(isin, newValue) {
    setToggling(t => ({ ...t, [isin]: true }))

    // Optimistic update via parent callback
    onUpdate(isin, newValue)

    // Persist via backend (auth header added automatically via supabase session)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/casparser/fund-tags/${encodeURIComponent(isin)}`, {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ is_visible_to_child: newValue }),
    })

    setToggling(t => ({ ...t, [isin]: false }))
  }

  // Group by fund type
  const grouped = {}
  for (const f of funds) {
    if (!grouped[f.fund_type]) grouped[f.fund_type] = []
    grouped[f.fund_type].push(f)
  }

  const visibleCount = funds.filter(f => f.is_visible_to_child).length

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

          {grouped[type].map(fund => (
            <div key={fund.isin} className="fund-row">
              <div>
                <div className="fund-row__name">{fund.fund_name}</div>
                <div className="fund-row__isin">{fund.isin}</div>
              </div>

              <div className="toggle-wrap">
                <span className="toggle-label">
                  {fund.is_visible_to_child ? 'Shared' : 'Hidden'}
                </span>
                <label className="toggle" aria-label={`Share ${fund.fund_name}`}>
                  <input
                    type="checkbox"
                    checked={fund.is_visible_to_child}
                    disabled={!!toggling[fund.isin]}
                    onChange={e => handleToggle(fund.isin, e.target.checked)}
                  />
                  <span className="toggle__track" />
                  <span className="toggle__thumb" />
                </label>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
