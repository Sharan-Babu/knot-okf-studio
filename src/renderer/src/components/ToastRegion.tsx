import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useAppStore } from '@/store'

export function ToastRegion(): React.JSX.Element {
  const toasts = useAppStore((state) => state.toasts)
  const dismiss = useAppStore((state) => state.dismissToast)
  return <div className="toast-region" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.tone ?? 'default'}`}>
    {toast.tone === 'danger' ? <CircleAlert size={19} /> : <CheckCircle2 size={19} />}
    <span><strong>{toast.title}</strong>{toast.description && <small>{toast.description}</small>}</span>
    <button aria-label={`Dismiss ${toast.title}`} onClick={() => dismiss(toast.id)}><X size={15} /></button>
  </div>)}</div>
}
