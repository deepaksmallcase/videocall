import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SIGNALING_URL } from '../constants'
import { showModal } from '../lib/notifications'
import { classifyError } from '../lib/errorClassifier'
import { VideoCallIcon, CopyIcon, CheckIcon } from '../components/Icons'

export default function Home() {
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function handleNewMeeting() {
    setCreating(true)
    try {
      const res = await fetch(`${SIGNALING_URL}/rooms`, { method: 'POST' })
      if (!res.ok) {
        const { message, autoDismissMs } = classifyError({ status: res.status })
        showModal({ title: 'Failed to create room', message, autoDismissMs })
        return
      }
      const data = await res.json()
      setJoinUrl(`${window.location.origin}/room/${data.roomId}`)
      setCopied(false)
    } catch {
      const { message, autoDismissMs } = classifyError({})
      showModal({ title: 'Failed to create room', message, autoDismissMs })
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy() {
    if (!joinUrl) return
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
  }

  function handleJoinRoom() {
    const code = roomCode.trim()
    if (code) navigate(`/room/${code}`)
  }

  return (
    <div className="home-page">
      <div className="home-card">
        <div>
          <div className="home-brand">
            <VideoCallIcon size={26} />
            <span className="home-brand__name">Huddle</span>
          </div>
          <p className="home-brand__tagline">Simple, fast video calls for your team</p>
        </div>

        <button className="btn btn-primary" onClick={handleNewMeeting} disabled={creating}>
          {creating
            ? <><span className="spinner spinner--sm" style={{ borderTopColor: '#fff' }} /> Creating…</>
            : 'New Meeting'}
        </button>

        {joinUrl && (
          <div className="home-link-box">
            <input readOnly value={joinUrl} className="input" />
            <button
              className={`btn-icon btn-icon--sm ${copied ? 'btn-icon--active' : ''}`}
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy link'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        )}

        <div className="home-divider"><span>or join with a code</span></div>

        <div className="home-join-row">
          <input
            className="input"
            placeholder="Enter room code"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
          />
          <button className="btn btn-ghost" onClick={handleJoinRoom} disabled={!roomCode.trim()}>
            Join
          </button>
        </div>
      </div>
    </div>
  )
}
