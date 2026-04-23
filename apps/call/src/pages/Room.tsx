import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SIGNALING_URL } from '../constants'
import { useLocalMedia } from '../hooks/useLocalMedia'
import { showModal } from '../lib/notifications'
import { classifyError } from '../lib/errorClassifier'
import Lobby from '../components/Lobby'
import ActiveCall from './ActiveCall'

type Phase = 'loading' | 'not-found' | 'lobby' | 'call'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [displayName, setDisplayName] = useState('')
  const [participantKey, setParticipantKey] = useState('')
  const localMedia = useLocalMedia()

  useEffect(() => {
    fetch(`${SIGNALING_URL}/rooms/${roomId}`)
      .then(res => {
        if (res.ok) {
          setPhase('lobby')
        } else {
          const { message, autoDismissMs } = classifyError({ status: res.status })
          showModal({ title: 'Room not found', message, autoDismissMs })
          setPhase('not-found')
        }
      })
      .catch(() => {
        showModal({
          title: 'Connection error',
          message: 'Could not reach the server. Check your connection and try again.',
          autoDismissMs: 5000,
        })
        setPhase('not-found')
      })
  }, [roomId])

  if (phase === 'loading') return <p>Loading…</p>
  if (phase === 'not-found') return null
  if (phase === 'lobby') return (
    <Lobby
      localMedia={localMedia}
      onJoin={(name, key) => {
        setDisplayName(name)
        setParticipantKey(key)
        setPhase('call')
      }}
    />
  )
  return <ActiveCall localMedia={localMedia} displayName={displayName} participantKey={participantKey} />
}
