import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { onModalChange, dismissModal } from '../lib/notifications'

interface ModalData {
  id: number
  title: string
  message: string
  autoDismissMs?: number
}

export default function Modal() {
  const [modal, setModal] = useState<ModalData | null>(null)

  useEffect(() => onModalChange(m => setModal(m as ModalData | null)), [])

  useEffect(() => {
    if (!modal?.autoDismissMs) return
    const t = setTimeout(dismissModal, modal.autoDismissMs)
    return () => clearTimeout(t)
  }, [modal?.id, modal?.autoDismissMs])

  useEffect(() => {
    if (!modal) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismissModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  if (!modal) return null

  return createPortal(
    <div
      onClick={dismissModal}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 8, padding: '24px 28px',
          maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#111' }}>{modal.title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#444', lineHeight: 1.5 }}>{modal.message}</p>
        <button
          onClick={dismissModal}
          style={{ padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#333', color: '#fff', fontSize: 14 }}
        >
          Dismiss
        </button>
      </div>
    </div>,
    document.body
  )
}
