import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { SIGNALING_URL, STUN_CONFIG } from '../constants'

export interface PeerState {
  stream: MediaStream
  displayName: string
}

interface PeerInfo {
  participantKey: string
  socketId: string
  displayName: string
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
  // Peer connections keyed by socketId (signaling routes by socketId)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  // socketId ↔ participantKey — resolved once per peer-joined / existing-peers
  const socketToKeyRef = useRef<Map<string, string>>(new Map())
  const keyToSocketRef = useRef<Map<string, string>>(new Map())
  // Display names keyed by participantKey — readable in ontrack without stale closure
  const peerNamesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!participantKey) return

    const socket = io(SIGNALING_URL)
    socketRef.current = socket

    function createPeerConnection(socketId: string): RTCPeerConnection {
      if (pcsRef.current.has(socketId)) return pcsRef.current.get(socketId)!

      const pc = new RTCPeerConnection(STUN_CONFIG)
      pcsRef.current.set(socketId, pc)

      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('ice-candidate', { to: socketId, candidate })
      }

      // Firefox fires ontrack with streams:[] — build stream from individual tracks as fallback
      const fallbackStream = new MediaStream()
      pc.ontrack = ({ track, streams }) => {
        const pKey = socketToKeyRef.current.get(socketId) ?? socketId
        const remoteStream = streams[0] ?? (fallbackStream.addTrack(track), fallbackStream)
        setPeers(prev => new Map(prev).set(pKey, {
          stream: remoteStream,
          displayName: peerNamesRef.current.get(pKey) ?? pKey.slice(0, 6),
        }))
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

    socket.on('connect', () => {
      socket.emit('join-room', roomId, participantKey, displayName)
    })

    socket.on('existing-peers', async (peerList: PeerInfo[]) => {
      for (const { participantKey: pKey, socketId, displayName: name } of peerList) {
        socketToKeyRef.current.set(socketId, pKey)
        keyToSocketRef.current.set(pKey, socketId)
        peerNamesRef.current.set(pKey, name)

        const pc = createPeerConnection(socketId)
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
      const pc = createPeerConnection(from)
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

  return { peers }
}
