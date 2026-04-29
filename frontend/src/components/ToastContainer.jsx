import { useEffect, useState } from 'react'
import Toast from './Toast'

let _addToast = null

export function showToast(message, type = 'success') {
  if (_addToast) {
    _addToast({ id: Date.now() + Math.random(), message, type })
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    _addToast = toast => setToasts(prev => [...prev, toast])
    return () => { _addToast = null }
  }, [])

  const remove = id => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast message={t.message} type={t.type} onClose={() => remove(t.id)} />
        </div>
      ))}
    </div>
  )
}
