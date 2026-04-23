# Claude Context - videocall platform

## Overview
Multi-peer WebRTC video call platform. We would be opening this in an iframe using an sdk on top of another application and communicating using postMessages wherever required

## Monorepo Structure

```
videocall-sdk/
├── apps/
│   └── call/              # React 18 frontend (@videocall/call) — port 5173
├── packages/
│   └── server/            # Express + Socket.io signaling server (@videocall/server) — port 4000
├── pnpm-workspace.yaml
└── tsconfig.base.json     # Shared TS config (strict, ESNext, bundler resolution)
```

## Tech Stack

- **Package Manager**: pnpm (workspaces)
- **Build System**: Vite (frontend), tsc (backend)
- **Node**: 22
- **Frontend**: React 18, React Router 7, Socket.io-client, TypeScript
- **Backend**: Express, Socket.io, nanoid, TypeScript, tsx (dev runner)
- **WebRTC**: Peer-to-peer full mesh; Google STUN servers; add TURN for production NAT traversal
- **Commits**: Conventional commits preferred

## Root Commands

| Command | Description |
|---|---|
| `pnpm dev` | Run frontend + backend concurrently |
| `pnpm build` | Build frontend only |s
| `pnpm --filter @videocall/call dev` | Frontend only (Vite, port 5173) |
| `pnpm --filter @videocall/server dev` | Backend only (tsx watch, port 4000) |

---

## apps/call (@videocall/call)

React app for Videocall platform.

### Key Files

```
apps/call/src/
├── main.tsx               # Entry point
├── App.tsx                # Root + router setup
├── constants.ts           # SIGNALING_URL, STUN_CONFIG
├── pages/
│   ├── Home.tsx           # Landing — create or join room
│   ├── Room.tsx           # Room entry — resolves participantKey, renders Lobby
│   └── ActiveCall.tsx     # Active call — renders VideoTile grid
├── components/
│   ├── Lobby.tsx          # Pre-call — camera/mic preview + join button
│   └── VideoTile.tsx      # Single peer video element
└── hooks/
    ├── useRoom.ts         # WebRTC + Socket.io signaling — core logic
    └── useLocalMedia.ts   # getUserMedia — camera/mic access
```

### Environment Variables

```bash
VITE_SIGNALING_URL=http://localhost:4000   # defaults to this if unset
```

### WebRTC Flow (`useRoom.ts`)

1. Socket connects → emits `join-room(roomId, participantKey, displayName)`
2. Server responds with `existing-peers` — client creates offers to each
3. New joiners receive `peer-joined` — they create an RTCPeerConnection and wait for offer
4. Offer → Answer → ICE candidates exchanged via socket (routed by `socketId`)
5. `peer-left` / `disconnect` → close PC, remove from peers state

**Key detail:** Participants are identified by a stable `participantKey` (persists across reconnects for the same display name). Signaling routes by `socketId` but state is keyed by `participantKey`. Firefox `ontrack` fallback is handled — builds stream from individual tracks if `streams[]` is empty.

---

## packages/server (@videocall/server)

Express HTTP + Socket.io signaling server. All state is in-memory — restarts clear all rooms.

### Key Files

```
packages/server/src/
├── index.ts          # Express routes + Socket.io event handlers
├── rooms.ts          # In-memory room/participant store (Map)
├── participants.ts   # participantKey issuance + re-validation
└── constants.ts      # PORT
```

### REST API

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/rooms` | Create room → `{ roomId, joinUrl }` |
| `GET` | `/rooms/:roomId` | Check if room exists |
| `POST` | `/participants` | Issue/re-validate participantKey for a display name |

### Socket Events

| Direction | Event | Payload | Description |
|---|---|---|---|
| client → server | `join-room` | `roomId, participantKey, displayName` | Join room |
| server → client | `existing-peers` | `PeerInfo[]` | List of current participants |
| server → room | `peer-joined` | `PeerInfo` | Broadcast new joiner |
| client → server | `offer` | `{ to: socketId, sdp }` | WebRTC offer |
| client → server | `answer` | `{ to: socketId, sdp }` | WebRTC answer |
| client → server | `ice-candidate` | `{ to: socketId, candidate }` | ICE candidate |
| server → client | `peer-left` | `participantKey` | Peer disconnected |

### Environment Variables

```bash
FRONTEND_URL=http://localhost:5173   # CORS origin + joinUrl base; defaults to this
PORT=4000                            # from constants.ts
```

---

## Common Tasks

### Add a new page
1. Create page in `apps/call/src/pages/`
2. Add route in `apps/call/src/App.tsx`

### Add a new Socket event
1. Add handler in `packages/server/src/index.ts` (`io.on('connection', ...)`)
2. Emit/listen in `apps/call/src/hooks/useRoom.ts`

### Production checklist
- Add TURN server to `STUN_CONFIG` in `apps/call/src/constants.ts` (Google STUN alone fails behind symmetric NAT)
- Set `FRONTEND_URL` env var on server for correct CORS + join URLs
- Set `VITE_SIGNALING_URL` in frontend build env
- Replace in-memory room store with persistent store if restart resilience needed
