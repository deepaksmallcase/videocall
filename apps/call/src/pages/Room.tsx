import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SIGNALING_URL } from '../constants'
import Lobby from '../components/Lobby'
import ActiveCall from './ActiveCall'

type Phase = 'loading' | 'not-found' | 'lobby' | 'call'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const [phase, setPhase] = useState<Phase>('loading')
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [participantKey, setParticipantKey] = useState('')

  useEffect(() => {
    fetch(`${SIGNALING_URL}/rooms/${roomId}`)
      .then(res => {
        if (res.ok) setPhase('lobby')
        else setPhase('not-found')
      })
      .catch(() => setPhase('not-found'))
  }, [roomId])

  if (phase === 'loading') return <p>Loading…</p>
  if (phase === 'not-found') return <h2>This room doesn't exist.</h2>
  if (phase === 'lobby') return (
    <Lobby onJoin={(stream, name, key) => {
      setLocalStream(stream)
      setDisplayName(name)
      setParticipantKey(key)
      setPhase('call')
    }} />
  )
  return <ActiveCall localStream={localStream} displayName={displayName} participantKey={participantKey} />
}
