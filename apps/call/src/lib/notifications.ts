type ModalOptions = {
  title: string
  message: string
  autoDismissMs?: number
}

type ModalData = ModalOptions & { id: number }

type ToastOptions = {
  message: string
}

type ToastData = ToastOptions & { id: number }

type ModalListener = (modal: ModalData | null) => void
type ToastsListener = (toasts: ToastData[]) => void

let modalListeners: ModalListener[] = []
let toastsListeners: ToastsListener[] = []
let currentToasts: ToastData[] = []
let nextId = 1

function notifyModal(modal: ModalData | null) {
  modalListeners.forEach(l => l(modal))
}

function notifyToasts() {
  const snapshot = [...currentToasts]
  toastsListeners.forEach(l => l(snapshot))
}

export function onModalChange(listener: ModalListener): () => void {
  modalListeners.push(listener)
  return () => { modalListeners = modalListeners.filter(l => l !== listener) }
}

export function onToastsChange(listener: ToastsListener): () => void {
  toastsListeners.push(listener)
  return () => { toastsListeners = toastsListeners.filter(l => l !== listener) }
}

export function showModal(options: ModalOptions): void {
  const id = nextId++
  notifyModal({ ...options, id })
}

export function dismissModal(): void {
  notifyModal(null)
}

export function showToast(options: ToastOptions): { id: number; dismiss: () => void } {
  const id = nextId++
  currentToasts = [...currentToasts, { ...options, id }]
  notifyToasts()

  const safety = setTimeout(dismiss, 10_000)

  function dismiss() {
    clearTimeout(safety)
    currentToasts = currentToasts.filter(t => t.id !== id)
    notifyToasts()
  }

  return { id, dismiss }
}
