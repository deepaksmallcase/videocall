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
}

export default function VideoTile({
  stream, muted = false, label, mirrored = false,
  connectionState, isOfferer, onRetry,
  mediaError, onDismissMediaError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  return (
    <div style={{ position: 'relative', background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirrored ? 'scaleX(-1)' : 'none' }}
      />

      {label && (
        <span style={{
          position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 12,
          background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 4,
        }}>
          {label}
        </span>
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
