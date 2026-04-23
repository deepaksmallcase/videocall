// Signaling server URL — set VITE_SIGNALING_URL in .env for production
export const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:4000'

// STUN servers for ICE. Add TURN servers here for production NAT traversal.
export const STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}
