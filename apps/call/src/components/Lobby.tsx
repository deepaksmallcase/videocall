import { useEffect, useRef, useState } from 'react'
import type { LocalMedia } from '../hooks/useLocalMedia'
import { SIGNALING_URL } from '../constants'
import { showModal } from '../lib/notifications'
import { classifyError } from '../lib/errorClassifier'
import { VideoCallIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from './Icons'

const STORAGE_KEY = 'videocall_participant'

interface StoredParticipant { name: string; key: string }

interface Props {
  localMedia: LocalMedia
  onJoin: (displayName: string, participantKey: string) => void
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

export default function Lobby({ localMedia, onJoin }: Props) {
  const { stream, audioEnabled, toggleAudio, videoEnabled, toggleVideo, permissionDenied, cameras, mics, selectCamera, selectMic } = localMedia
  const videoRef = useRef<HTMLVideoElement>(null)

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as StoredParticipant } catch { return null }
  })()

  const [name, setName] = useState(stored?.name ?? '')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  async function handleJoin() {
    const resolvedName = name.trim() || 'Guest'
    setJoining(true)
    try {
      const storedKey = stored?.name === resolvedName ? stored.key : undefined
      const res = await fetch(`${SIGNALING_URL}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: resolvedName, key: storedKey }),
      })
      if (!res.ok) {
        const { message, autoDismissMs } = classifyError({ status: res.status })
        showModal({ title: 'Failed to join', message, autoDismissMs })
        setJoining(false)
        return
      }
      const { participantKey } = await res.json() as { participantKey: string }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: resolvedName, key: participantKey }))
      onJoin(resolvedName, participantKey)
    } catch {
      const { message, autoDismissMs } = classifyError({})
      showModal({ title: 'Failed to join', message, autoDismissMs })
      setJoining(false)
    }
  }

  const showAvatar = permissionDenied || !videoEnabled
  const color = avatarColor(name || 'Guest')

  return (
    <div className="lobby-page">
      <div className="lobby-card">
        <div className="lobby-header">
          <VideoCallIcon size={18} />
          <span className="lobby-header__title">Ready to join?</span>
        </div>

        <div className="lobby-preview">
          {showAvatar ? (
            <div className="lobby-avatar">
              <div className="lobby-avatar__circle" style={{ background: color }}>
                {initials(name || 'Guest')}
              </div>
              <span className="lobby-avatar__label">
                {permissionDenied ? 'Camera access denied' : 'Camera is off'}
              </span>
            </div>
          ) : (
            <video ref={videoRef} autoPlay muted playsInline />
          )}

          {!permissionDenied && (
            <div className="lobby-preview__overlay">
              <button
                className={`btn-icon ${!audioEnabled ? 'btn-icon--muted' : ''}`}
                onClick={toggleAudio}
                title={audioEnabled ? 'Mute mic' : 'Unmute mic'}
              >
                {audioEnabled ? <MicIcon /> : <MicOffIcon />}
              </button>
              <button
                className={`btn-icon ${!videoEnabled ? 'btn-icon--muted' : ''}`}
                onClick={toggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? <VideoIcon /> : <VideoOffIcon />}
              </button>
            </div>
          )}
        </div>

        <div className="lobby-form">
          <div>
            <label className="field-label">Your name</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !joining && handleJoin()}
            />
          </div>

          {!permissionDenied && (cameras.length > 0 || mics.length > 0) && (
            <div className="lobby-devices">
              {cameras.length > 0 && (
                <div>
                  <label className="field-label">Camera</label>
                  <select className="select" onChange={e => selectCamera(e.target.value)}>
                    {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
                  </select>
                </div>
              )}
              {mics.length > 0 && (
                <div>
                  <label className="field-label">Microphone</label>
                  <select className="select" onChange={e => selectMic(e.target.value)}>
                    {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleJoin} disabled={joining}>
            {joining
              ? <><span className="spinner spinner--sm" style={{ borderTopColor: '#fff' }} /> Joining…</>
              : 'Join now'}
          </button>
        </div>
      </div>
    </div>
  )
}
