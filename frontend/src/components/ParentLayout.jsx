import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { logActivity } from '../lib/activity.js'
import '../styles/parent.css'

const NAV_ITEMS = [
  { to: '/parent/dashboard',  label: 'Home',      icon: '🏡' },
  { to: '/parent/portfolio',  label: 'Portfolio',  icon: '📊' },
  { to: '/parent/settings',   label: 'Settings',   icon: '⚙️'  },
]

export default function ParentLayout() {
  const { user, session, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Fire parent_section_visit on every parent route change
  useEffect(() => {
    if (!session?.access_token) return
    logActivity('parent', 'parent_section_visit', {
      section: location.pathname,
      authToken: session.access_token,
    })
  }, [location.pathname, session])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  return (
    <div className="parent-shell">
      <header className="parent-header">
        <span className="parent-header__logo">Taru</span>
        <div className="parent-header__right">
          {displayName && (
            <span className="parent-header__name">{displayName}</span>
          )}
          <button className="parent-header__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="parent-main">
        <Outlet />
      </main>

      <nav className="parent-nav">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `parent-nav__item${isActive ? ' active' : ''}`
            }
          >
            <span className="parent-nav__icon">{icon}</span>
            <span className="parent-nav__label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
