import { useState } from 'react'
import { SIGNALING_URL } from '../constants'
import { showModal } from '../lib/notifications'
import { classifyError } from '../lib/errorClassifier'

export default function Home() {
  const [joinUrl, setJoinUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleNewMeeting() {
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
    }
  }

  async function handleCopy() {
    if (!joinUrl) return
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
  }

  return (
    <div>
      <h1>Video Call</h1>
      <button onClick={handleNewMeeting}>New Meeting</button>
      {joinUrl && (
        <div>
          <span>{joinUrl}</span>
          <button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy link'}</button>
        </div>
      )}
    </div>
  )
}
