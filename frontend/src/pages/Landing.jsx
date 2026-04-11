import { Link } from 'react-router-dom'
import { Dna, Shield, Cpu, Coins, ArrowRight, Lock } from 'lucide-react'

const pillars = [
  { icon: Lock,   title: 'Zero raw exposure',   desc: 'Client-side feature extraction. Raw sequences never leave your device or touch the server.' },
  { icon: Shield, title: 'Differential privacy', desc: 'Laplace noise (ε=1.0) is applied to all feature vectors before storage, providing formal privacy guarantees.' },
  { icon: Cpu,    title: 'Research-grade API',   desc: 'Sparse and aligned feature vectors, per-dataset schemas, batch access — designed for ML pipelines.' },
  { icon: Coins,  title: 'Contributor rewards',  desc: 'Every API call by a researcher credits the data contributor. Fair value for shared knowledge.' },
]

const dna = 'ATGCTAGCTAGCATGCATGCATGCTAGCATGC'.split('')

export default function Landing() {
  return (
    <div className="min-h-screen bg-void bg-grid">

      {/* Navbar */}
      <nav className="border-b border-edge bg-ink/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dna size={18} className="text-cyan" />
            <span className="font-display text-soft font-medium text-sm tracking-wide">DeGenome</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"    className="btn-ghost text-xs py-2 px-4">Sign in</Link>
            <Link to="/register" className="btn-primary text-xs py-2 px-4">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <div className="badge-cyan mb-6">privacy-preserving genomics</div>
          <h1 className="font-display text-5xl text-soft leading-tight mb-6">
            Genomic data.<br />
            <span className="text-cyan text-glow-cyan">Shared safely.</span>
          </h1>
          <p className="text-muted text-base leading-relaxed mb-10 max-w-lg">
            DeGenome lets contributors share genomic data and researchers access it — without raw sequences ever being exposed. Features, not files.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/register" className="btn-primary flex items-center gap-2">
              Start contributing <ArrowRight size={14} />
            </Link>
            <Link to="/register?role=researcher" className="btn-ghost">
              I'm a researcher
            </Link>
          </div>
        </div>

        {/* DNA strand decoration */}
        <div className="mt-16 flex items-center gap-1 overflow-hidden opacity-30">
          {dna.map((base, i) => (
            <span
              key={i}
              className="font-mono text-xs"
              style={{
                color: { A:'#00e5cc', T:'#b5ff4d', G:'#60a5fa', C:'#f472b6' }[base],
                animationDelay: `${i * 0.05}s`,
              }}
            >{base}</span>
          ))}
          <span className="font-mono text-xs text-muted">···</span>
        </div>
      </div>

      {/* Pillars */}
      <div className="max-w-6xl mx-auto px-6 pb-24">
        <p className="section-title mb-8">how it works</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card hover:border-cyan/20 transition-all duration-300 group">
              <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center mb-4 group-hover:bg-cyan/15 transition-colors">
                <Icon size={15} className="text-cyan" />
              </div>
              <p className="font-display text-soft text-sm mb-2">{title}</p>
              <p className="text-xs text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy guarantee callout */}
      <div className="border-t border-edge bg-ink">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <p className="font-mono text-xs text-muted mb-3 tracking-widest uppercase">the core guarantee</p>
          <p className="font-display text-2xl text-soft max-w-xl mx-auto leading-snug">
            Raw genomic sequences are <span className="text-cyan">never stored, never transmitted, never exposed.</span>
          </p>
          <p className="text-xs text-muted mt-4 font-mono">
            Only ε-differentially private feature vectors reach the server.
          </p>
        </div>
      </div>
    </div>
  )
}
