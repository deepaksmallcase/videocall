export type ErrorKind = 'user' | 'server'

export interface ClassifiedError {
  kind: ErrorKind
  message: string
  autoDismissMs: number | undefined
}

export function classifyError(opts: { status?: number; message?: string }): ClassifiedError {
  const { status, message } = opts

  if (status !== undefined && status >= 400 && status < 500) {
    return {
      kind: 'user',
      message: message ?? (status === 404 ? "This room doesn't exist." : 'Invalid request.'),
      autoDismissMs: undefined,
    }
  }

  return {
    kind: 'server',
    message: message ?? (
      status !== undefined
        ? `Server error (${status}).`
        : 'Could not connect to the server. Check your connection and try again.'
    ),
    autoDismissMs: 5000,
  }
}
