'use client';
import { useEffect, type ReactNode } from 'react';
import { X, ArrowUpRight, Loader2 } from 'lucide-react';
import { patientInitials } from '@/lib/types';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const dialog = document.querySelector('[role="dialog"]');
        const items = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            '[role="dialog"] input, [role="dialog"] button',
          )
          ?.focus(),
      0,
    );
    return () => {
      document.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
      original?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'modal-wide' : ''}`}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">LÚMINA · CLÍNICA CONECTADA</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  full = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? 'field-full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <i />}
      {children}
    </span>
  );
}
export function Avatar({
  name,
  color = 'sage',
  small = false,
}: {
  name: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      style={color.startsWith('#') ? { backgroundColor: color } : undefined}
      className={`avatar avatar-${color} ${small ? 'avatar-small' : ''}`}
    >
      {patientInitials(name)}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <ArrowUpRight size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Submit({
  busy = false,
  children = 'Salvar',
}: {
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <button type="submit" className="button button-primary" disabled={busy}>
      {busy ? <Loader2 className="spin" size={16} /> : null}
      {children}
    </button>
  );
}
export function moneyInput(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error('Informe um valor válido.');
  return Math.round(amount * 100);
}
export const dateLabel = (v: string) =>
  v
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${v.slice(0, 10)}T12:00:00Z`))
    : 'Não informado';
