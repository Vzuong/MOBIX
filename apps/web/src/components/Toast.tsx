export type ToastMessage = {
  id: string
  text: string
  type?: 'success' | 'info'
}

type Props = {
  toasts: ToastMessage[]
}

export default function Toast({ toasts }: Props) {
  if (!toasts.length) return null

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>✨</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
