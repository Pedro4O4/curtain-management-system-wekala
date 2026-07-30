export function todayIsoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function isFutureDate(date: string) {
  return date > todayIsoDate();
}

export function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function isValidMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return false;
  }

  const monthNumber = Number(month.slice(5, 7));
  return monthNumber >= 1 && monthNumber <= 12;
}

export function monthDates(month: string) {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${month}-${day}`;
  });
}

export function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}
