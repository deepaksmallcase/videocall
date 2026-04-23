import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { SIGNALING_URL, STUN_CONFIG } from '../constants'

export type IceState = 'connecting' | 'connected' | 'unstable' | 'failed'

export interface PeerState {
  stream: MediaStream | null
  displayName: string
  connectionState: IceState
  isOfferer: boolean
}

interface PeerInfo {
  participantKey: string
  socketId: string
  displayName: string
}

function mapIceState(raw: RTCIceConnectionState): IceState {
  if (raw === 'new' || raw === 'checking') return 'connecting'
  if (raw === 'connected' || raw === 'completed') return 'connected'
  if (raw === 'disconnected') return 'unstable'
  return 'failed'
}

export function useRoom({
  roomId,
  localStream,
  displayName,
  participantKey,
}: {
  roomId: string
  localStream: MediaStream | null
  displayName: string
  participantKey: string
}) {
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map())
  const socketRef = useRef<Socket | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const socketToKeyRef = useRef<Map<string, string>>(new Map())
  const keyToSocketRef = useRef<Map<string, string>>(new Map())
  const peerNamesRef = useRef<Map<string, string>>(new Map())
  // Always reflects the latest localStream for use inside closures
  const localStreamRef = useRef(localStream)
  // Stores the retryPeer function created inside the main effect
  const retryPeerFnRef = useRef<((pk: string) => void) | null>(null)

  useEffect(() => { localStreamRef.current = localStream }, [localStream])

  // When the stream changes mid-call (device switch), replace tracks on all peer connections
  useEffect(() => {
    if (!localStream) return
    pcsRef.current.forEach(pc => {
      localStream.getTracks().forEach(newTrack => {
        const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind)
        if (sender) sender.replaceTrack(newTrack)
      })
    })
  }, [localStream])

  useEffect(() => {
    if (!participantKey) return

    const socket = io(SIGNALING_URL)
    socketRef.current = socket

    function createPeerConnection(socketId: string, pKey: string, isOfferer: boolean): RTCPeerConnection {
      if (pcsRef.current.has(socketId)) return pcsRef.current.get(socketId)!

      const pc = new RTCPeerConnection(STUN_CONFIG)
      pcsRef.current.set(socketId, pc)

      const currentStream = localStreamRef.current
      if (currentStream) {
        currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream))
      }

      // Add peer to map immediately so the tile shows "Connecting…" before any tracks arrive
      setPeers(prev => {
        if (prev.has(pKey)) return prev
        return new Map(prev).set(pKey, {
          stream: null,
          displayName: peerNamesRef.current.get(pKey) ?? pKey.slice(0, 6),
          connectionState: 'connecting',
          isOfferer,
        })
      })

      pc.oniceconnectionstatechange = () => {
        const state = mapIceState(pc.iceConnectionState)
        setPeers(prev => {
          const peer = prev.get(pKey)
          if (!peer) return prev
          return new Map(prev).set(pKey, { ...peer, connectionState: state })
        })
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('ice-candidate', { to: socketId, candidate })
      }

      // Firefox fires ontrack with streams:[] — build stream from individual tracks as fallback
      const fallbackStream = new MediaStream()
      pc.ontrack = ({ track, streams }) => {
        const remoteStream = streams[0] ?? (fallbackStream.addTrack(track), fallbackStream)
        setPeers(prev => {
          const peer = prev.get(pKey)
          if (!peer) return prev
          return new Map(prev).set(pKey, { ...peer, stream: remoteStream })
        })
      }

      return pc
    }

    async function applyRemoteDescription(pc: RTCPeerConnection, socketId: string, sdp: RTCSessionDescriptionInit) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const pending = pendingCandidatesRef.current.get(socketId) ?? []
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      pendingCandidatesRef.current.delete(socketId)
    }

    function retryPeer(pKey: string) {
      const socketId = keyToSocketRef.current.get(pKey)
      if (!socketId) return

      const oldPc = pcsRef.current.get(socketId)
      if (oldPc) {
        oldPc.oniceconnectionstatechange = null
        oldPc.onicecandidate = null
        oldPc.ontrack = null
        oldPc.close()
        pcsRef.current.delete(socketId)
      }

      // Reset to connecting before creating the new PC
      setPeers(prev => {
        const peer = prev.get(pKey)
        if (!peer) return prev
        return new Map(prev).set(pKey, { ...peer, connectionState: 'connecting', stream: null })
      })

      const pc = createPeerConnection(socketId, pKey, true)
      pc.createOffer()
        .then(async offer => {
          await pc.setLocalDescription(offer)
          socket.emit('offer', { to: socketId, sdp: offer })
        })
        .catch(console.error)
    }

    retryPeerFnRef.current = retryPeer

    socket.on('connect', () => {
      socket.emit('join-room', roomId, participantKey, displayName)
    })

    socket.on('existing-peers', async (peerList: PeerInfo[]) => {
      for (const { participantKey: pKey, socketId, displayName: name } of peerList) {
        socketToKeyRef.current.set(socketId, pKey)
        keyToSocketRef.current.set(pKey, socketId)
        peerNamesRef.current.set(pKey, name)

        const pc = createPeerConnection(socketId, pKey, true)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('offer', { to: socketId, sdp: offer })
      }
    })

    socket.on('peer-joined', ({ participantKey: pKey, socketId, displayName: name }: PeerInfo) => {
      socketToKeyRef.current.set(socketId, pKey)
      keyToSocketRef.current.set(pKey, socketId)
      peerNamesRef.current.set(pKey, name)
    })

    socket.on('offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pKey = socketToKeyRef.current.get(from) ?? from
      const pc = createPeerConnection(from, pKey, false)
      await applyRemoteDescription(pc, from, sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { to: from, sdp: answer })
    })

    socket.on('answer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = pcsRef.current.get(from)
      if (!pc) return
      await applyRemoteDescription(pc, from, sdp)
    })

    socket.on('ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcsRef.current.get(from)
      if (!pc || !pc.remoteDescription) {
        const pending = pendingCandidatesRef.current.get(from) ?? []
        pending.push(candidate)
        pendingCandidatesRef.current.set(from, pending)
        return
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    })

    socket.on('peer-left', (pKey: string) => {
      const socketId = keyToSocketRef.current.get(pKey)
      if (socketId) {
        const pc = pcsRef.current.get(socketId)
        if (pc) { pc.close(); pcsRef.current.delete(socketId) }
        socketToKeyRef.current.delete(socketId)
        pendingCandidatesRef.current.delete(socketId)
      }
      keyToSocketRef.current.delete(pKey)
      peerNamesRef.current.delete(pKey)
      setPeers(prev => {
        const next = new Map(prev)
        next.delete(pKey)
        return next
      })
    })

    return () => {
      socket.emit('leave-room', roomId)
      socket.disconnect()
      pcsRef.current.forEach(pc => pc.close())
      pcsRef.current.clear()
      pendingCandidatesRef.current.clear()
      socketToKeyRef.current.clear()
      keyToSocketRef.current.clear()
      peerNamesRef.current.clear()
    }
  }, [roomId, participantKey, displayName])

  return {
    peers,
    retryPeer: (pk: string) => retryPeerFnRef.current?.(pk),
  }
}
