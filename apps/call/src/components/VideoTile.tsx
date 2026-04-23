import { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream | null
  muted?: boolean
  label?: string
  mirrored?: boolean
}

export default function VideoTile({ stream, muted = false, label, mirrored = false }: Props) {
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
        <span style={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 4 }}>
          {label}
        </span>
      )}
    </div>
  )
}
