export const TIME_ZONE = "Asia/Ho_Chi_Minh";
const pad = (value) => String(value).padStart(2, "0");
export function dateKey(year, month, day) {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}
function utcDate(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}
export function todayKey(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
}
export function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31)
    return false;
  const date = utcDate(year, month, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
export function monthRange(year, month) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Tháng không hợp lệ.");
  }
  // The upper sentinel remains lexically after every four-digit date in year 9999.
  const end =
    year === 9999 && month === 12
      ? "9999-12-32"
      : dateKey(
          month === 12 ? year + 1 : year,
          month === 12 ? 1 : month + 1,
          1,
        );
  return { start: dateKey(year, month, 1), end };
}
export function calendarDays(year, month) {
  monthRange(year, month);
  const offset = (utcDate(year, month, 1).getUTCDay() + 6) % 7;
  const count = utcDate(year, month + 1, 0).getUTCDate();
  const days = Array(offset).fill(null);
  for (let day = 1; day <= count; day++) days.push(dateKey(year, month, day));
  while (days.length % 7) days.push(null);
  return days;
}
export function normalizeGuestName(input) {
  if (typeof input !== "string" || /[\p{Cc}\p{Cf}]/u.test(input))
    throw new Error("Tên chứa ký tự không hợp lệ.");
  const name = input.normalize("NFC").trim().replace(/\s+/gu, " ");
  if ([...name].length < 2 || [...name].length > 60)
    throw new Error("Họ tên cần từ 2 đến 60 ký tự.");
  if (!/^[\p{L}\p{M} .'-]+$/u.test(name) || !/\p{L}/u.test(name))
    throw new Error("Vui lòng nhập họ tên hợp lệ, chỉ gồm chữ và dấu tên.");
  return name;
}
export function formatCheckinTime(timestamp) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(timestamp.toDate());
}
export function selectedDateParts(key) {
  if (!isValidDateKey(key)) throw new Error("Ngày không hợp lệ.");
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    timeZone: "UTC",
  }).format(utcDate(year, month, day));
  return { year, month, day, weekday };
}
