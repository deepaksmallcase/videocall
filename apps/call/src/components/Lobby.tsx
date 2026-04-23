import { useEffect, useRef, useState } from 'react'
import { useLocalMedia } from '../hooks/useLocalMedia'
import { SIGNALING_URL } from '../constants'

const STORAGE_KEY = 'videocall_participant'

interface StoredParticipant {
  name: string
  key: string
}

interface Props {
  onJoin: (stream: MediaStream | null, displayName: string, participantKey: string) => void
}

export default function Lobby({ onJoin }: Props) {
  const { stream, audioEnabled, toggleAudio, videoEnabled, toggleVideo, permissionDenied, cameras, mics, selectCamera, selectMic } = useLocalMedia()
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
      // Use the stored key only if the name hasn't changed — different name = new user
      const storedKey = stored?.name === resolvedName ? stored.key : undefined
      const res = await fetch(`${SIGNALING_URL}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: resolvedName, key: storedKey }),
      })
      const { participantKey } = await res.json() as { participantKey: string }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: resolvedName, key: participantKey }))
      onJoin(stream, resolvedName, participantKey)
    } catch {
      setJoining(false)
    }
  }

  return (
    <div>
      <h2>Ready to join?</h2>

      <div>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ marginBottom: 12, padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc', width: 240 }}
        />
      </div>

      {permissionDenied ? (
        <p>Camera and microphone are blocked — you can still join and listen.</p>
      ) : (
        <video ref={videoRef} autoPlay muted playsInline style={{ transform: 'scaleX(-1)', width: 320, height: 240, background: '#000' }} />
      )}

      {!permissionDenied && (
        <div>
          <button onClick={toggleAudio}>{audioEnabled ? 'Mute' : 'Unmute'}</button>
          <button onClick={toggleVideo}>{videoEnabled ? 'Camera off' : 'Camera on'}</button>
        </div>
      )}

      {cameras.length > 0 && (
        <div>
          <label>Camera: </label>
          <select onChange={e => selectCamera(e.target.value)}>
            {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
          </select>
        </div>
      )}

      {mics.length > 0 && (
        <div>
          <label>Microphone: </label>
          <select onChange={e => selectMic(e.target.value)}>
            {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
          </select>
        </div>
      )}

      <button onClick={handleJoin} disabled={joining}>
        {joining ? 'Joining…' : 'Join now'}
      </button>
    </div>
  )
}
