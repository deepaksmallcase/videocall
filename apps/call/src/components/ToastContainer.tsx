import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { onToastsChange } from '../lib/notifications'

interface ToastData {
  id: number
  message: string
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => onToastsChange(t => setToasts(t as ToastData[])), [])

  if (toasts.length === 0) return null

  return createPortal(
    <div
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8, zIndex: 999,
      }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            background: '#222', color: '#fff', padding: '10px 18px', borderRadius: 6,
            fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>,
    document.body
  )
}
