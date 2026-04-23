export interface Participant {
  socketId: string
  displayName: string
}

export interface Room {
  id: string
  participants: Map<string, Participant>
}

const rooms = new Map<string, Room>()

export function createRoom(id: string): Room {
  const room: Room = { id, participants: new Map() }
  rooms.set(id, room)
  return room
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id)
}

export function addParticipant(roomId: string, participantId: string, socketId: string, displayName: string): void {
  const room = rooms.get(roomId)
  if (!room) return
  room.participants.set(participantId, { socketId, displayName })
}

export function removeParticipant(roomId: string, participantId: string): void {
  const room = rooms.get(roomId)
  if (!room) return
  room.participants.delete(participantId)
}