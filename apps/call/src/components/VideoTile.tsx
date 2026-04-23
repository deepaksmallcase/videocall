import { useEffect, useRef } from 'react'
import type { IceState } from '../hooks/useRoom'
import type { MediaError } from '../hooks/useLocalMedia'

interface Props {
  stream: MediaStream | null
  muted?: boolean
  label?: string
  mirrored?: boolean
  connectionState?: IceState
  isOfferer?: boolean
  onRetry?: () => void
  mediaError?: MediaError | null
  onDismissMediaError?: () => void
  isSelf?: boolean
}

const AVATAR_COLORS = ['#6c6fff', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

function avatarColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

export default function VideoTile({
  stream, muted = false, label, mirrored = false,
  connectionState, isOfferer, onRetry,
  mediaError, onDismissMediaError,
  isSelf = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const name = label ?? ''

  return (
    <div className={`video-tile${isSelf ? ' video-tile--self' : ''}`}>
      {!stream ? (
        <div className="video-tile__avatar">
          <div className="video-tile__avatar-circle" style={{ background: avatarColor(name) }}>
            {initials(name)}
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
        />
      )}

      {label && (
        <div className="video-tile__label-bar">
          <span className="video-tile__label">{label}</span>
        </div>
      )}

      {/* Connection state overlay */}
      {(connectionState === 'connecting' || connectionState === 'unstable' || connectionState === 'failed') && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <span style={{ color: '#fff', fontSize: 13, textAlign: 'center', padding: '0 12px' }}>
            {connectionState === 'connecting' && 'Connecting…'}
            {connectionState === 'unstable' && 'Connection unstable…'}
            {connectionState === 'failed' && 'Connection failed'}
          </span>
          {connectionState === 'failed' && isOfferer && (
            <button
              onClick={onRetry}
              style={{
                padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: '#3b82f6', color: '#fff', fontSize: 13,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Media error badge (camera / mic lost) */}
      {mediaError && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(220,38,38,0.9)', color: '#fff',
          padding: '4px 10px', borderRadius: 4, fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{mediaError.type === 'camera' ? 'Camera lost' : 'Mic lost'}</span>
          <button
            onClick={onDismissMediaError}
            style={{
              background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 14, lineHeight: 1, padding: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
