import { useEffect, useRef, useState } from 'react'

export interface MediaDevice {
  deviceId: string
  label: string
}

export interface MediaError {
  type: 'camera' | 'microphone'
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
  switching: boolean
  switchingType: 'camera' | 'microphone' | null
  mediaError: MediaError | null
  dismissMediaError: () => void
}

export function useLocalMedia(): LocalMedia {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [cameras, setCameras] = useState<MediaDevice[]>([])
  const [mics, setMics] = useState<MediaDevice[]>([])
  const [switching, setSwitching] = useState(false)
  const [switchingType, setSwitchingType] = useState<'camera' | 'microphone' | null>(null)
  const [mediaError, setMediaError] = useState<MediaError | null>(null)

  const activeCameraId = useRef<string | undefined>(undefined)
  const activeMicId = useRef<string | undefined>(undefined)
  // Sync ref so onended callbacks can check without stale closure
  const switchingRef = useRef(false)

  function attachTrackEndedHandlers(s: MediaStream) {
    s.getVideoTracks().forEach(t => {
      t.onended = () => { if (!switchingRef.current) setMediaError({ type: 'camera' }) }
    })
    s.getAudioTracks().forEach(t => {
      t.onended = () => { if (!switchingRef.current) setMediaError({ type: 'microphone' }) }
    })
  }

  function detachTrackEndedHandlers(s: MediaStream) {
    s.getTracks().forEach(t => { t.onended = null })
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) { s.getTracks().forEach(t => { t.onended = null; t.stop() }); return }
        const vTrack = s.getVideoTracks()[0]
        const aTrack = s.getAudioTracks()[0]
        if (vTrack) activeCameraId.current = vTrack.getSettings().deviceId
        if (aTrack) activeMicId.current = aTrack.getSettings().deviceId
        attachTrackEndedHandlers(s)
        setStream(s)
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

  function toggleAudio() {
    if (!stream) return
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setAudioEnabled(e => !e)
  }

  // t.enabled = false does NOT fire onended — the "Camera lost" badge is NOT triggered
  function toggleVideo() {
    if (!stream) return
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setVideoEnabled(e => !e)
  }

  async function selectCamera(deviceId: string) {
    switchingRef.current = true
    setSwitching(true)
    setSwitchingType('camera')
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: activeMicId.current ? { deviceId: { exact: activeMicId.current } } : true,
      })
      if (stream) detachTrackEndedHandlers(stream)
      stream?.getTracks().forEach(t => t.stop())
      const vTrack = newStream.getVideoTracks()[0]
      const aTrack = newStream.getAudioTracks()[0]
      if (vTrack) activeCameraId.current = vTrack.getSettings().deviceId
      if (aTrack) activeMicId.current = aTrack.getSettings().deviceId
      attachTrackEndedHandlers(newStream)
      setStream(newStream)
      setMediaError(null)
      setAudioEnabled(true)
      setVideoEnabled(true)
    } finally {
      switchingRef.current = false
      setSwitching(false)
      setSwitchingType(null)
    }
  }

  async function selectMic(deviceId: string) {
    switchingRef.current = true
    setSwitching(true)
    setSwitchingType('microphone')
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: activeCameraId.current ? { deviceId: { exact: activeCameraId.current } } : true,
        audio: { deviceId: { exact: deviceId } },
      })
      if (stream) detachTrackEndedHandlers(stream)
      stream?.getTracks().forEach(t => t.stop())
      const vTrack = newStream.getVideoTracks()[0]
      const aTrack = newStream.getAudioTracks()[0]
      if (vTrack) activeCameraId.current = vTrack.getSettings().deviceId
      if (aTrack) activeMicId.current = aTrack.getSettings().deviceId
      attachTrackEndedHandlers(newStream)
      setStream(newStream)
      setMediaError(null)
      setAudioEnabled(true)
      setVideoEnabled(true)
    } finally {
      switchingRef.current = false
      setSwitching(false)
      setSwitchingType(null)
    }
  }

  function dismissMediaError() {
    setMediaError(null)
  }

  return {
    stream, audioEnabled, toggleAudio, videoEnabled, toggleVideo,
    permissionDenied, cameras, mics, selectCamera, selectMic,
    switching, switchingType, mediaError, dismissMediaError,
  }
}
