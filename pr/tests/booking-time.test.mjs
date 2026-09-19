import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_TIME_ZONE,
  addCalendarDays,
  bookingDayRange,
  bookingInstant,
  zonedDateTimeToUtc
} from '../booking-time.js';

test('converts a Sao Paulo booking to an UTC instant', () => {
  const selectedDay = new Date(2026, 8, 18);
  assert.equal(bookingInstant(selectedDay, '09:00').toISOString(), '2026-09-18T12:00:00.000Z');
});

test('builds an exclusive UTC range for one Sao Paulo calendar day', () => {
  const selectedDay = new Date(2026, 8, 18);
  const range = bookingDayRange(selectedDay);
  assert.equal(range.from.toISOString(), '2026-09-18T03:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-09-19T03:00:00.000Z');
});

test('handles month and year boundaries as calendar days', () => {
  assert.deepEqual(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1), {
    year: 2027,
    month: 1,
    day: 1
  });
});

test('round-trips a wall-clock time in the configured timezone', () => {
  const instant = zonedDateTimeToUtc({
    year: 2026,
    month: 9,
    day: 18,
    hour: 18,
    minute: 30
  });
  const displayed = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BOOKING_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(instant);
  assert.match(displayed, /18\/09\/2026.*18:30/);
});
