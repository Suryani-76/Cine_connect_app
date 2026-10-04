import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'

export function ToastProvider() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: 'font-sans text-14 border border-line bg-surface text-ink shadow-floating rounded-lg',
        style: {
          background: 'var(--color-surface)',
          borderColor: 'var(--color-line)',
          color: 'var(--color-ink)',
          fontFamily: '"Archivo Variable", Archivo, system-ui, sans-serif',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-floating)',
          fontSize: '14px',
        },
      }}
    />
  )
}

export const showToast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      className: 'border-l-4 border-l-status-success',
    })
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      className: 'border-l-4 border-l-status-error',
    })
  },
  info: (message: string, description?: string) => {
    sonnerToast(message, {
      description,
      className: 'border-l-4 border-l-tungsten',
    })
  },
}

export { sonnerToast as toast }
