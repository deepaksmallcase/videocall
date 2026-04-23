import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'
import { PORT } from './constants.js'
import { createRoom, getRoom, addParticipant, removeParticipant } from './rooms.js'
import { resolveParticipantKey } from './participants.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/rooms', (_req, res) => {
  const roomId = nanoid(10)
  createRoom(roomId)
  res.json({ roomId, joinUrl: `${FRONTEND_URL}/room/${roomId}` })
})

app.get('/rooms/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId)
  if (!room) {
    res.status(404).json({ error: 'room_not_found' })
    return
  }
  res.json({ exists: true })
})

// Issues or re-validates a stable participantKey for a given name.
// If the provided key was issued for a different name, a new key is returned.
app.post('/participants', (req, res) => {
  const { name, key } = req.body as { name: string; key?: string }
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name_required' })
    return
  }
  const participantKey = resolveParticipantKey(name.trim(), key)
  res.json({ participantKey })
})

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'] },
})

// Maps socketId → participantKey for disconnect cleanup
const socketToKey = new Map<string, string>()
// Maps socketId → roomId for disconnect cleanup
const socketToRoom = new Map<string, string>()

io.on('connection', (socket) => {
  socket.on('join-room', (roomId: string, participantKey: string, displayName: string) => {
    const room = getRoom(roomId)
    if (!room) { socket.emit('error', 'room_not_found'); return }

    const existingPeers = [...room.participants.entries()].map(([key, p]) => ({
      participantKey: key,
      socketId: p.socketId,
      displayName: p.displayName,
    }))

    socket.join(roomId)
    socketToKey.set(socket.id, participantKey)
    socketToRoom.set(socket.id, roomId)
    addParticipant(roomId, participantKey, socket.id, displayName)

    socket.emit('existing-peers', existingPeers)
    socket.to(roomId).emit('peer-joined', { participantKey, socketId: socket.id, displayName })
  })

  socket.on('offer', ({ to, sdp }: { to: string; sdp: object }) => {
    io.to(to).emit('offer', { from: socket.id, sdp })
  })

  socket.on('answer', ({ to, sdp }: { to: string; sdp: object }) => {
    io.to(to).emit('answer', { from: socket.id, sdp })
  })

  socket.on('ice-candidate', ({ to, candidate }: { to: string; candidate: object }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate })
  })

  function leaveRoom() {
    const roomId = socketToRoom.get(socket.id)
    const participantKey = socketToKey.get(socket.id)
    if (!roomId || !participantKey) return

    removeParticipant(roomId, participantKey)
    socket.to(roomId).emit('peer-left', participantKey)
    socketToKey.delete(socket.id)
    socketToRoom.delete(socket.id)
  }

  socket.on('leave-room', leaveRoom)
  socket.on('disconnect', leaveRoom)
})

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
