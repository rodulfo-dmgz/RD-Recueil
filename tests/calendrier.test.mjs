import { test } from 'node:test';
import assert from 'node:assert/strict';

import { genererLienGoogleCalendar, genererIcs } from '../app/js/engine/calendrier.js';

const debut = new Date('2026-10-05T10:00:00.000Z');
const fin = new Date('2026-10-05T10:30:00.000Z');

test('genererLienGoogleCalendar : URL avec dates au format UTC compact', () => {
  const lien = genererLienGoogleCalendar({ titre: 'Entretien de cadrage', debut, fin });
  assert.ok(lien.startsWith('https://calendar.google.com/calendar/render?'));
  const url = new URL(lien);
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('text'), 'Entretien de cadrage');
  assert.equal(url.searchParams.get('dates'), '20261005T100000Z/20261005T103000Z');
});

test('genererIcs : structure VCALENDAR minimale valide', () => {
  const ics = genererIcs({ titre: 'Entretien de cadrage', debut, fin, uid: 'test-uid', maintenant: debut });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.endsWith('END:VCALENDAR'));
  assert.ok(ics.includes('UID:test-uid'));
  assert.ok(ics.includes('DTSTART:20261005T100000Z'));
  assert.ok(ics.includes('DTEND:20261005T103000Z'));
  assert.ok(ics.includes('SUMMARY:Entretien de cadrage'));
});

test('genererIcs : lieu et détails omis si vides', () => {
  const ics = genererIcs({ titre: 'Test', debut, fin, uid: 'x' });
  assert.ok(!ics.includes('LOCATION:'));
  assert.ok(!ics.includes('DESCRIPTION:'));
});

test('genererIcs : détails multi-lignes échappés', () => {
  const ics = genererIcs({ titre: 'Test', debut, fin, uid: 'x', details: 'Ligne 1\nLigne 2' });
  assert.ok(ics.includes('DESCRIPTION:Ligne 1\\nLigne 2'));
});
