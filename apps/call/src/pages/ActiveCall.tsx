import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import type { LocalMedia } from '../hooks/useLocalMedia'
import VideoTile from '../components/VideoTile'
import { showToast } from '../lib/notifications'
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, PhoneOffIcon, UsersIcon, XIcon } from '../components/Icons'

interface Props {
  localMedia: LocalMedia
  displayName: string
  participantKey: string
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

function gridCols(total: number): number {
  if (total <= 1) return 1
  if (total <= 4) return 2
  if (total <= 9) return 3
  return 4
}

export default function ActiveCall({ localMedia, displayName, participantKey }: Props) {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const {
    stream: localStream, audioEnabled, toggleAudio, videoEnabled, toggleVideo,
    cameras, mics, selectCamera, selectMic,
    switching, switchingType, mediaError, dismissMediaError,
  } = localMedia
  const { peers, retryPeer } = useRoom({ roomId: roomId!, localStream, displayName, participantKey })

  const [sidebarOpen, setSidebarOpen] = useState(true)

  const dismissSwitchToastRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (switching) {
      const label = switchingType === 'camera' ? 'Switching camera…' : 'Switching microphone…'
      const { dismiss } = showToast({ message: label })
      dismissSwitchToastRef.current = dismiss
    } else {
      dismissSwitchToastRef.current?.()
      dismissSwitchToastRef.current = null
    }
  }, [switching, switchingType])

  async function handleCameraSelect(deviceId: string) {
    try {
      await selectCamera(deviceId)
    } catch {
      dismissSwitchToastRef.current?.()
      dismissSwitchToastRef.current = null
      showToast({ message: 'Failed to switch camera. Please try again.' })
    }
  }

  async function handleMicSelect(deviceId: string) {
    try {
      await selectMic(deviceId)
    } catch {
      dismissSwitchToastRef.current?.()
      dismissSwitchToastRef.current = null
      showToast({ message: 'Failed to switch microphone. Please try again.' })
    }
  }

  function leaveCall() {
    localStream?.getTracks().forEach(t => { t.onended = null; t.stop() })
    navigate('/')
  }

  const peerList = [...peers.entries()]
  const totalTiles = peerList.length + 1
  const cols = gridCols(totalTiles)

  return (
    <div className="call-layout">
      <div className="call-body">
        <div className="call-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          <VideoTile
            stream={localStream}
            muted
            label={`${displayName} (You)`}
            mirrored
            isSelf
            mediaError={mediaError}
            onDismissMediaError={dismissMediaError}
          />
          {peerList.map(([peerId, { stream, displayName: peerName, connectionState, isOfferer }]) => (
            <VideoTile
              key={peerId}
              stream={stream}
              label={peerName}
              connectionState={connectionState}
              isOfferer={isOfferer}
              onRetry={() => retryPeer(peerId)}
            />
          ))}
        </div>

        {sidebarOpen && (
          <div className="call-sidebar">
            <div className="call-sidebar__header">
              <span className="call-sidebar__title">Participants ({totalTiles})</span>
              <button className="btn-icon btn-icon--sm" onClick={() => setSidebarOpen(false)} title="Close">
                <XIcon />
              </button>
            </div>
            <ul className="call-sidebar__list">
              <li className="call-sidebar__item">
                <div className="peer-avatar" style={{ background: avatarColor(displayName) }}>
                  {initials(displayName)}
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
                <span className="call-sidebar__you-badge">You</span>
              </li>
              {peerList.map(([peerId, { displayName: peerName }]) => (
                <li key={peerId} className="call-sidebar__item">
                  <div className="peer-avatar" style={{ background: avatarColor(peerName) }}>
                    {initials(peerName)}
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {peerName}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="call-bar">
        <button
          className={`btn-icon ${!audioEnabled ? 'btn-icon--muted' : ''}`}
          onClick={toggleAudio}
          title={audioEnabled ? 'Mute' : 'Unmute'}
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

        {cameras.length > 1 && (
          <select
            onChange={e => handleCameraSelect(e.target.value)}
            disabled={switching}
            style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#333', color: '#fff', fontSize: 13, cursor: 'pointer' }}
          >
            {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
          </select>
        )}

        {mics.length > 1 && (
          <select
            onChange={e => handleMicSelect(e.target.value)}
            disabled={switching}
            style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#333', color: '#fff', fontSize: 13, cursor: 'pointer' }}
          >
            {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
          </select>
        )}

        <div className="call-bar__sep" />

        <button className="btn-icon btn-icon--danger" onClick={leaveCall} title="Leave call">
          <PhoneOffIcon />
        </button>

        <div className="call-bar__sep" />

        <button
          className={`btn-icon ${sidebarOpen ? 'btn-icon--active' : ''}`}
          onClick={() => setSidebarOpen(s => !s)}
          title="Participants"
        >
          <UsersIcon />
        </button>
      </div>
    </div>
  )
}
