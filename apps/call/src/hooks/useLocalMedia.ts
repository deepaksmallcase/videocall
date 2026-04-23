import { useEffect, useRef, useState } from 'react'

export interface MediaDevice {
  deviceId: string
  label: string
}

export interface LocalMedia {
  stream: MediaStream | null
  audioEnabled: boolean
  toggleAudio: () => void
  videoEnabled: boolean
  toggleVideo: () => void
  permissionDenied: boolean
  cameras: MediaDevice[]
  mics: MediaDevice[]
  selectCamera: (deviceId: string) => Promise<void>
  selectMic: (deviceId: string) => Promise<void>
}

export function useLocalMedia(): LocalMedia {
  const [stream, setStream] = useState<MediaStream | null>(null)
  // Mirror of track.enabled — kept in sync so React re-renders when toggled
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [cameras, setCameras] = useState<MediaDevice[]>([])
  const [mics, setMics] = useState<MediaDevice[]>([])
  // Refs instead of state: device IDs are only needed when restarting the stream, not for rendering
  const activeCameraId = useRef<string | undefined>(undefined)
  const activeMicId = useRef<string | undefined>(undefined)

  useEffect(() => {
    // cancelled flag prevents state updates if the component unmounts before getUserMedia resolves
    let cancelled = false

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
        setStream(s)
        const vTrack = s.getVideoTracks()[0]
        const aTrack = s.getAudioTracks()[0]
        // Record which physical devices were selected so selectCamera/selectMic can pin the other device
        if (vTrack) activeCameraId.current = vTrack.getSettings().deviceId
        if (aTrack) activeMicId.current = aTrack.getSettings().deviceId
        // enumerateDevices only returns labels after permission is granted, so we call it here
        await loadDevices()
      } catch (err: unknown) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setPermissionDenied(true)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  async function loadDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices()
    setCameras(devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || d.deviceId })))
    setMics(devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || d.deviceId })))
  }

  // Mute/unmute by flipping track.enabled — no stream restart, no permission re-prompt
  function toggleAudio() {
    if (!stream) return
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setAudioEnabled(e => !e)
  }

  function toggleVideo() {
    if (!stream) return
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setVideoEnabled(e => !e)
  }

  // Switching devices requires a new getUserMedia call; we keep the active mic pinned so it doesn't change
  async function selectCamera(deviceId: string) {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: activeMicId.current ? { deviceId: { exact: activeMicId.current } } : true,
    })
    activeCameraId.current = deviceId
    // Stop old tracks only after the new stream is ready to avoid a gap
    stream?.getTracks().forEach(t => t.stop())
    setStream(newStream)
    setAudioEnabled(true)
    setVideoEnabled(true)
  }

  async function selectMic(deviceId: string) {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: activeCameraId.current ? { deviceId: { exact: activeCameraId.current } } : true,
      audio: { deviceId: { exact: deviceId } },
    })
    activeMicId.current = deviceId
    stream?.getTracks().forEach(t => t.stop())
    setStream(newStream)
    setAudioEnabled(true)
    setVideoEnabled(true)
  }

  return { stream, audioEnabled, toggleAudio, videoEnabled, toggleVideo, permissionDenied, cameras, mics, selectCamera, selectMic }
}
