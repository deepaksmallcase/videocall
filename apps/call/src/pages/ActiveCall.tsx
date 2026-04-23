import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import type { LocalMedia } from '../hooks/useLocalMedia'
import VideoTile from '../components/VideoTile'
import { showToast } from '../lib/notifications'

interface Props {
  localMedia: LocalMedia
  displayName: string
  participantKey: string
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

  // Manage switching toast lifecycle
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: '#fff' }}>
      {/* Video grid */}
      <div style={{ flex: 1, display: 'grid', gap: 8, padding: 16, gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(peerList.length + 1))}, 1fr)` }}>
        <VideoTile
          stream={localStream}
          muted
          label={`${displayName} (You)`}
          mirrored
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

      {/* Participant sidebar */}
      <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: 12, minWidth: 160 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Participants ({peerList.length + 1})
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 13 }}>
          <li>{displayName} (You)</li>
          {peerList.map(([peerId, { displayName: peerName }]) => (
            <li key={peerId}>{peerName}</li>
          ))}
        </ul>
      </div>

      {/* Control bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', alignItems: 'center', padding: 16, background: '#1a1a1a' }}>
        <button onClick={toggleAudio} style={btnStyle(!audioEnabled)}>
          {audioEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button onClick={toggleVideo} style={btnStyle(!videoEnabled)}>
          {videoEnabled ? 'Camera off' : 'Camera on'}
        </button>

        {cameras.length > 1 && (
          <select
            onChange={e => handleCameraSelect(e.target.value)}
            disabled={switching}
            style={selectStyle}
          >
            {cameras.map(c => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
          </select>
        )}

        {mics.length > 1 && (
          <select
            onChange={e => handleMicSelect(e.target.value)}
            disabled={switching}
            style={selectStyle}
          >
            {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label}</option>)}
          </select>
        )}

        <button onClick={leaveCall} style={{ ...btnStyle(false), background: '#c0392b' }}>
          Leave
        </button>
      </div>
    </div>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 20px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: active ? '#555' : '#333',
    color: '#fff',
    fontSize: 14,
  }
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#333',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
}
