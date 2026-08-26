import { useNavigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import EulaModal from '../components/EulaModal.jsx'

/**
 * Full-screen EULA acceptance page.
 * Accessible without auth (user is logged in but hasn't accepted yet).
 * On acceptance, redirects to the originally intended destination
 * (passed via location.state.from) or falls back to /parent/dashboard.
 */
export default function EulaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const destination = location.state?.from || '/parent/dashboard'

  function handleAccepted() {
    navigate(destination, { replace: true })
  }

  return (
    <>
      <Helmet>
        <title>Accept Terms | Taru</title>
        <meta name="description" content="Review and accept Taru's End User License Agreement to continue." />
        <link rel="canonical" href="https://taru.money/eula/" />
      </Helmet>
      <EulaModal onAccepted={handleAccepted} />
    </>
  )
}
