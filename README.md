# videocall-sdk

Multi-peer WebRTC video call platform designed to be embedded in other applications via an iframe + postMessage SDK.

## Architecture

```
videocall-sdk/
├── apps/
│   └── call/          # React 18 frontend — port 5173
└── packages/
    └── server/        # Express + Socket.io signaling server — port 4000
```

**Full-mesh peer-to-peer WebRTC** — each participant connects directly to every other participant. The signaling server only brokers session setup (offer/answer/ICE) and is not in the media path.

## Getting Started

### Prerequisites

- Node 22+
- pnpm

```bash
npm install -g pnpm
```

### Install

```bash
pnpm install
```

### Run (dev)

```bash
pnpm dev          # starts both frontend (5173) and signaling server (4000)
```

Or run individually:

```bash
pnpm --filter @videocall/call dev     # frontend only
pnpm --filter @videocall/server dev   # server only
```

### Build

```bash
pnpm build        # builds the React frontend
```

## Environment Variables

### Frontend (`apps/call/.env`)

```bash
VITE_SIGNALING_URL=http://localhost:4000   # defaults to this if unset
```

### Server

```bash
FRONTEND_URL=http://localhost:5173   # CORS origin + join URL base; defaults to this
PORT=4000
```

## How It Works

1. A host calls `POST /rooms` to create a room and gets back a `joinUrl`.
2. Participants open the join URL (or the host shares it).
3. Before joining, participants enter a display name on the lobby screen.
4. On join, the frontend connects to the signaling server via Socket.io and exchanges WebRTC offers/answers/ICE candidates with existing peers.
5. Once ICE is complete, media flows peer-to-peer — the server is no longer involved.

### Signaling Flow

```
client ──join-room──────────────────────► server
       ◄──existing-peers────────────────── server   (list of current participants)
       ◄──peer-joined──────────────────── server    (broadcast to room on new join)

# For each peer pair:
A ──offer──► server ──► B
B ──answer─► server ──► A
A/B ──ice-candidate─► server ──► B/A
```

### REST API

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/rooms` | Create room → `{ roomId, joinUrl }` |
| `GET` | `/rooms/:roomId` | Check room exists |
| `POST` | `/participants` | Issue / re-validate a `participantKey` for a display name |

## Production Notes

- **TURN servers**: Google STUN alone fails behind symmetric NAT. Add TURN credentials to `STUN_CONFIG` in `apps/call/src/constants.ts`.
- **Persistence**: The signaling server keeps all state in memory — a restart clears all rooms. Replace with a persistent store (Redis, DB) if needed.
- **CORS**: Set `FRONTEND_URL` on the server to match your deployed frontend origin.
- **Scale**: Full-mesh doesn't scale well beyond ~6–8 participants. For larger rooms, consider an SFU (e.g. mediasoup, LiveKit).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 7, TypeScript, Vite |
| Signaling | Express, Socket.io, TypeScript, tsx |
| WebRTC | Browser native APIs, Google STUN |
| Package manager | pnpm workspaces |
