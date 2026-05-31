/**
 * InvestmentApp.jsx — module boundary placeholder
 *
 * This module is the future home of the investment rail. Do not build
 * anything here until the following questions are resolved:
 *
 *   - BSE StAR MF adapter goes here (empanelment pending)
 *   - KYC adapter (HyperVerge or IDfy SDK) goes here
 *   - Order state machine goes here (see Taru_Investment_PRD.docx)
 *   - Do not build anything in this module until the BSE empanelment
 *     KYC-acceptance question is answered
 *
 * INVESTMENT_ENABLED must be true (via VITE_INVESTMENT_ENABLED=true) to
 * reach this component. It is false by default.
 */

import { useAuth } from '../context/AuthContext.jsx'

export default function InvestmentApp() {
  const { user } = useAuth()

  return (
    <div style={styles.card}>
      <p style={styles.label}>Investment feature coming soon</p>
      <p style={styles.email}>{user?.email}</p>
    </div>
  )
}

const styles = {
  card: {
    background:   'var(--color-surface)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding:      'var(--space-5)',
    marginBottom: 'var(--space-4)',
  },
  label: {
    fontFamily: 'var(--font-body)',
    fontSize:   '14px',
    color:      'var(--color-text-secondary)',
    margin:     0,
  },
  email: {
    fontFamily: 'var(--font-body)',
    fontSize:   '12px',
    color:      'var(--color-text-secondary)',
    marginTop:  'var(--space-1)',
    marginBottom: 0,
  },
}
