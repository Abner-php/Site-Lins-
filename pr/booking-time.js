export const BOOKING_TIME_ZONE = 'America/Sao_Paulo';

const formatterCache = new Map();

function zonedPartsFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }));
  }
  return formatterCache.get(timeZone);
}

function partsAtInstant(instant, timeZone) {
  return Object.fromEntries(
    zonedPartsFormatter(timeZone)
      .formatToParts(instant)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );
}

export function dateParts(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

export function addCalendarDays(parts, amount) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

export function zonedDateTimeToUtc(parts, timeZone = BOOKING_TIME_ZONE) {
  const desiredTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  );
  let candidateTimestamp = desiredTimestamp;

  // Intl exposes the local wall-clock time for an instant. Iterating the
  // difference also keeps this conversion correct if timezone rules change.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = partsAtInstant(new Date(candidateTimestamp), timeZone);
    const observedTimestamp = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const adjustment = desiredTimestamp - observedTimestamp;
    candidateTimestamp += adjustment;
    if (adjustment === 0) break;
  }

  const result = new Date(candidateTimestamp);
  const roundTrip = partsAtInstant(result, timeZone);
  const expected = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0
  };
  if (Object.keys(expected).some(key => expected[key] !== roundTrip[key])) {
    throw new RangeError(`Horário inválido para o fuso ${timeZone}.`);
  }

  return result;
}

export function bookingInstant(date, time, timeZone = BOOKING_TIME_ZONE) {
  const [hour, minute] = time.split(':').map(Number);
  return zonedDateTimeToUtc({ ...dateParts(date), hour, minute }, timeZone);
}

export function bookingDayRange(date, timeZone = BOOKING_TIME_ZONE) {
  const startParts = dateParts(date);
  const endParts = addCalendarDays(startParts, 1);
  return {
    from: zonedDateTimeToUtc(startParts, timeZone),
    to: zonedDateTimeToUtc(endParts, timeZone)
  };
}

export function displayDateForCalendar(date, timeZone = BOOKING_TIME_ZONE) {
  return zonedDateTimeToUtc({ ...dateParts(date), hour: 12 }, timeZone);
}
