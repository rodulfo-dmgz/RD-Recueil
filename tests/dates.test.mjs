import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formaterDate, formaterDateCourte } from '../app/js/engine/dates.js';

test('formaterDateCourte : jj/mm/aaaa, vide si ce n’est pas une date aaaa-mm-jj', () => {
  assert.equal(formaterDateCourte('2026-10-01'), '01/10/2026');
  assert.equal(formaterDateCourte(''), '');
  assert.equal(formaterDateCourte(null), '');
  assert.equal(formaterDateCourte('01/10/2026'), '');
  assert.equal(formaterDateCourte('2026-10-01T09:00:00'), '');
});

test('formaterDate : date lisible, tiret si vide, heure facultative', () => {
  assert.equal(formaterDate(null), '-');
  assert.equal(formaterDate(''), '-');
  assert.match(formaterDate('2026-10-03T09:30:00'), /^3 oct\.? 2026$/);
  assert.match(formaterDate('2026-10-03T09:30:00', { heure: true }), /^3 oct\.? 2026,? (à )?09:30$/);
});
