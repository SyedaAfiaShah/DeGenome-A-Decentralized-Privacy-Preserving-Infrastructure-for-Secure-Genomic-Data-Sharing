import { Link, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { Dna, LogOut, LayoutDashboard, Upload, Database, Bell, Activity } from 'lucide-react'

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate  = useNavigate()
  const location  = useLocation()

  const nav = [
    { to: '/dashboard',       label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/upload',          label: 'Upload',     icon: Upload,          role: 'contributor' },
    { to: '/explorer',        label: 'Explorer',   icon: Database },
    { to: '/access',          label: 'Access',     icon: Bell },
    { to: '/api',             label: 'Data API',   icon: Activity,        role: 'researcher' },
  ]

  const active = (path) => location.pathname === path

  if (!isAuthenticated()) return null

  return (
    <nav className="border-b border-edge bg-ink/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-14 gap-8">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <Dna size={18} className="text-cyan" />
          <span className="font-display text-soft font-medium tracking-wide text-sm">DeGenome</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 flex-1">
          {nav.map(({ to, label, icon: Icon, role }) => {
            if (role && user?.role !== role) return null
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-all
                  ${active(to)
                    ? 'bg-cyan/10 text-cyan border border-cyan/20'
                    : 'text-muted hover:text-soft hover:bg-edge/50'}`}
              >
                <Icon size={13} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-display">{user?.credits?.toFixed(1)}</span>
            <span className="text-xs text-cyan font-display">CR</span>
          </div>
          <div className="h-4 w-px bg-edge" />
          <span className="text-xs text-muted font-display">{user?.username}</span>
          <span className={`badge ${user?.role === 'contributor' ? 'badge-cyan' : 'badge-yellow'}`}>
            {user?.role}
          </span>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-muted hover:text-soft transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </nav>
  )
}
