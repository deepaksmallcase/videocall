import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import VideoTile from '../components/VideoTile'

interface Props {
  localStream: MediaStream | null
  displayName: string
  participantKey: string
}

export default function ActiveCall({ localStream, displayName, participantKey }: Props) {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { peers } = useRoom({ roomId: roomId!, localStream, displayName, participantKey })

  const [audioEnabled, setAudioEnabled] = useState(() =>
    localStream?.getAudioTracks()[0]?.enabled ?? false
  )
  const [videoEnabled, setVideoEnabled] = useState(() =>
    localStream?.getVideoTracks()[0]?.enabled ?? false
  )

  function toggleAudio() {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setAudioEnabled(e => !e)
  }

  function toggleVideo() {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setVideoEnabled(e => !e)
  }

  function leaveCall() {
    localStream?.getTracks().forEach(t => t.stop())
    navigate('/')
  }

  const peerList = [...peers.entries()]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: '#fff' }}>
      {/* Video grid */}
      <div style={{ flex: 1, display: 'grid', gap: 8, padding: 16, gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(peerList.length + 1))}, 1fr)` }}>
        <VideoTile stream={localStream} muted label={`${displayName} (You)`} mirrored />
        {peerList.map(([peerId, { stream, displayName: peerName }]) => (
          <VideoTile key={peerId} stream={stream} label={peerName} />
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
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: 16, background: '#1a1a1a' }}>
        <button onClick={toggleAudio} style={btnStyle(!audioEnabled)}>
          {audioEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button onClick={toggleVideo} style={btnStyle(!videoEnabled)}>
          {videoEnabled ? 'Camera off' : 'Camera on'}
        </button>
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
