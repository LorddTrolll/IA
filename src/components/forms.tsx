'use client';
import { useState, type FormEvent } from 'react';
import { Field, Modal, Submit } from './ui';
import { localDate, type ClinicState, type SessionInfo } from '@/lib/types';
export type ActionFn = (
  type: string,
  payload: Record<string, unknown>,
) => Promise<void>;
export function PatientForm({
  state,
  session,
  onAction,
  onClose,
}: {
  state: ClinicState;
  session: SessionInfo;
  onAction: ActionFn;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await onAction('createPatient', Object.fromEntries(f));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Um novo cuidado começa aqui" onClose={onClose}>
      <form onSubmit={submit} className="modal-body">
        <p className="form-intro">
          Cadastre o paciente para organizar toda a sua jornada de cuidado.
        </p>
        <div className="form-grid">
          <Field label="Nome completo" full>
            <input
              name="name"
              required
              maxLength={150}
              placeholder="Como o paciente se chama?"
            />
          </Field>
          <Field label="Data de nascimento">
            <input type="date" name="birthDate" max={localDate()} />
          </Field>
          <Field label="Telefone">
            <input
              type="tel"
              name="phone"
              placeholder="(11) 99999-9999"
              maxLength={30}
            />
          </Field>
          <Field label="E-mail">
            <input type="email" name="email" placeholder="paciente@email.com" />
          </Field>
          <Field label="Dentista responsável">
            <select name="dentistId" required>
              {state.members
                .filter(
                  (m) =>
                    m.status === 'active' &&
                    m.role !== 'reception' &&
                    (session.user.role !== 'dentist' ||
                      m.id === session.user.id),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Responsável (se necessário)" full>
            <input
              name="responsible"
              placeholder="Nome e contato do responsável"
              maxLength={200}
            />
          </Field>
          {session.user.role !== 'reception' && (
            <Field label="Queixa principal" full>
              <textarea
                name="complaint"
                rows={3}
                placeholder="O que trouxe o paciente até a clínica?"
                maxLength={4000}
              />
            </Field>
          )}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <Submit busy={busy}>Cadastrar paciente</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function AppointmentForm({
  state,
  session,
  onAction,
  onClose,
  defaultPatientId = '',
  defaultDate,
}: {
  state: ClinicState;
  session: SessionInfo;
  onAction: ActionFn;
  onClose: () => void;
  defaultPatientId?: string;
  defaultDate?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await onAction('createAppointment', {
        ...Object.fromEntries(f),
        duration: Number(f.get('duration')),
        status: 'scheduled',
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Novo atendimento" onClose={onClose}>
      <form onSubmit={submit} className="modal-body">
        <div className="form-grid">
          <Field label="Paciente" full>
            <select name="patientId" required defaultValue={defaultPatientId}>
              <option value="" disabled>
                Selecione um paciente
              </option>
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dentista">
            <select name="dentistId" required>
              {state.members
                .filter(
                  (m) =>
                    m.status === 'active' &&
                    m.role !== 'reception' &&
                    (session.user.role !== 'dentist' ||
                      m.id === session.user.id),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Cadeira / sala">
            <select name="room">
              <option>Cadeira 01</option>
              <option>Cadeira 02</option>
              <option>Cadeira 03</option>
            </select>
          </Field>
          <Field label="Data">
            <input
              type="date"
              name="date"
              defaultValue={defaultDate || localDate()}
              required
            />
          </Field>
          <Field label="Horário">
            <input type="time" name="time" defaultValue="09:00" required />
          </Field>
          <Field label="Duração">
            <select name="duration" defaultValue="45">
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1h30</option>
              <option value="120">2 horas</option>
            </select>
          </Field>
          <Field label="Procedimento">
            <input
              name="procedure"
              required
              placeholder="Ex.: Avaliação inicial"
              maxLength={200}
            />
          </Field>
        </div>
        <p className="field-hint">
          A disponibilidade do profissional e da cadeira será verificada ao
          salvar.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <Submit busy={busy}>Agendar atendimento</Submit>
        </div>
      </form>
    </Modal>
  );
}
