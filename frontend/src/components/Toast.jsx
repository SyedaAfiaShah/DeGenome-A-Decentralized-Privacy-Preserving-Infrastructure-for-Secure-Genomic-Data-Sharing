import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const CONFIG = {
  success: { Icon: CheckCircle, iconClass: 'text-green-400', borderClass: 'border-l-green-500' },
  error:   { Icon: XCircle,     iconClass: 'text-red-400',   borderClass: 'border-l-red-500'   },
  info:    { Icon: Info,        iconClass: 'text-blue-400',  borderClass: 'border-l-blue-500'  },
}

export default function Toast({ message, type = 'success', onClose }) {
  const [visible,   setVisible]   = useState(false)
  const dismissed = useRef(false)

  const dismiss = () => {
    if (dismissed.current) return
    dismissed.current = true
    setVisible(false)
    setTimeout(onClose, 300)
  }

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10)
    const hide = setTimeout(dismiss, 3000)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])

  const { Icon, iconClass, borderClass } = CONFIG[type] ?? CONFIG.success

  return (
    <div
      className={`
        w-[320px] flex items-start gap-3 px-4 py-3
        rounded-lg border border-edge border-l-4 ${borderClass}
        bg-ink shadow-lg shadow-black/50
        transition-all duration-300 ease-out
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}
      `}
    >
      <Icon size={15} className={`shrink-0 mt-0.5 ${iconClass}`} />
      <p className="flex-1 text-xs text-soft leading-relaxed">{message}</p>
      <button
        onClick={dismiss}
        className="shrink-0 text-muted hover:text-soft transition-colors ml-1">
        <X size={13} />
      </button>
    </div>
  )
}
