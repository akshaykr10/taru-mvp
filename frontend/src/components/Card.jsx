/* Landing.jsx's repeated ".feature-card.reveal" wrapper — every current
   use site pairs these two classes together, so they're hardcoded rather
   than parameterized. TaxCalculator's and MilestoneCalculator's cards are
   bespoke, differently-styled zones with no shared class, so they were
   deliberately not folded into this component. */
export default function Card({ children }) {
  return <div className="feature-card reveal">{children}</div>
}
