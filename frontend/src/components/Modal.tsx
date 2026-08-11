import { ReactNode, useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const prevOpen = useRef(false)

  // Captura o elemento que abriu o modal (o "gatilho") na transição fechado→aberto,
  // DURANTE o render — antes do autoFocus dos filhos mudar o foco. Se capturássemos num
  // useEffect, pegaríamos o input já focado, e o foco não voltaria pro gatilho ao fechar.
  if (open && !prevOpen.current) {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null
  }
  prevOpen.current = open

  // Efeito A — trava scroll do fundo + foca dentro do modal + devolve o foco ao fechar.
  // Depende só de `open` pra não re-executar quando onClose muda de identidade (evitaria
  // restaurar o overflow errado e deixar a página travada).
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Foca o 1º focável do modal — mas só se o React (autoFocus) não focou nada ainda.
    const raf = requestAnimationFrame(() => {
      const box = boxRef.current
      if (box && !box.contains(document.activeElement)) {
        box.querySelector<HTMLElement>(FOCUSABLE)?.focus()
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      document.body.style.overflow = prevOverflow
      // Devolve o foco ao gatilho após o React remover o modal do DOM (rAF garante a ordem)
      const el = triggerRef.current
      requestAnimationFrame(() => el?.focus?.())
    }
  }, [open])

  // Efeito B — teclado: Esc fecha, Tab fica preso dentro do modal (focus trap).
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const box = boxRef.current
      if (!box) return
      const focusables = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizeClass = size === 'sm' ? 'modal-box-sm' : size === 'lg' ? 'modal-box-lg' : ''
  const titleId = 'modal-title'

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className={`modal-box ${sizeClass}`}
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <span className="modal-title" id={titleId}>{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
