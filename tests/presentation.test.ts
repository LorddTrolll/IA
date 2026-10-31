import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicDateOf, pendingReturns, type Evolution } from '../src/lib/types';
test('operational reminders use the latest patient evolution, not obsolete recommendations', () => {
  const evolution = (
    id: string,
    patientId: string,
    createdAt: string,
    returnDate: string,
  ): Evolution => ({
    id,
    patientId,
    createdAt,
    returnDate,
    authorId: 'dentist',
    text: 'Evolução',
  });
  const evolutions = [
    evolution('old', 'p1', '2026-01-01T12:00:00Z', '2026-01-15'),
    evolution('new', 'p1', '2026-02-01T12:00:00Z', ''),
    evolution('due', 'p2', '2026-02-02T12:00:00Z', '2026-02-15'),
  ];
  assert.deepEqual(
    pendingReturns({ evolutions }, '2026-02-15').map((e) => e.id),
    ['due'],
  );
});
test('daily receipts use Sao Paulo day around UTC midnight', () => {
  assert.equal(clinicDateOf('2026-10-31T01:30:00Z'), '2026-10-30');
});
