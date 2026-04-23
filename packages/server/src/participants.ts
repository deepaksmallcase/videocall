import { nanoid } from 'nanoid'

// Maps participantKey → display name
const keyToName = new Map<string, string>()

/**
 * Returns the provided key if it's valid for the given name,
 * otherwise issues a new key. "Different name = new user."
 */
export function resolveParticipantKey(name: string, providedKey?: string): string {
  if (providedKey && keyToName.get(providedKey) === name) {
    return providedKey
  }
  const key = nanoid(16)
  keyToName.set(key, name)
  return key
}
