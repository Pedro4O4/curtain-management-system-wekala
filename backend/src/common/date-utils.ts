export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function isFutureDate(date: string) {
  return date > todayIsoDate();
}

export function isValidIsoDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function isValidMonth(month: string) {
  return /^\d{4}-\d{2}$/.test(month);
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