import { todayKey, calendarDays, monthRange, isValidDateKey } from "./utils.js";
import { getMember, GUEST_AVATAR } from "./members.js";
import { emulatorSuffix, preserveLocalCalendarLinks } from "./navigation.js";
import { createAvatarButton } from "./avatar-preview.js";

preserveLocalCalendarLinks();

const $ = (selector) => document.querySelector(selector);
const parameters = new URLSearchParams(location.search);
const today = todayKey();
const initial = parameters.get("month");
const initialDate =
  initial && isValidDateKey(`${initial}-01`) ? `${initial}-01` : today;
let [year, month] = initialDate.split("-").map(Number);
let service,
  unsubscribe,
  generation = 0,
  suspended = false;
let records = [];
let loading = true;

function status(message, error = false) {
  $("#data-status").textContent = message;
  $("#data-status").classList.toggle("is-error", error);
  $("#retry-button").hidden = !error;
}
function render() {
  $("#month-title").textContent = `Tháng ${month}, ${year}`;
  $("#previous-month").disabled = year === 1 && month === 1;
  $("#next-month").disabled = year === 9999 && month === 12;
  $("#calendar-grid").replaceChildren();
  const grouped = new Map();
  for (const record of records) {
    if (!grouped.has(record.date)) grouped.set(record.date, []);
    grouped.get(record.date).push(record);
  }
  for (const [index, date] of calendarDays(year, month).entries()) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    if (!date) {
      cell.classList.add("empty");
      cell.setAttribute("aria-hidden", "true");
    } else {
      const attendees = grouped.get(date) || [];
      const dayLink = document.createElement("a");
      dayLink.className = "calendar-day-link";
      dayLink.href = `./detail.html?date=${date}${emulatorSuffix}`;
      dayLink.dataset.date = date;
      dayLink.setAttribute(
        "aria-label",
        `${Number(date.slice(-2))} tháng ${month} năm ${year}, ${loading ? "đang tải check-in" : `${attendees.length} người đã check-in`}`,
      );
      if (date === today) {
        cell.classList.add("is-today");
        dayLink.setAttribute("aria-current", "date");
      }
      if (index % 7 >= 5) cell.classList.add("is-weekend");
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = Number(date.slice(-2));
      dayLink.append(number);
      cell.append(dayLink);
      const avatars = document.createElement("span");
      avatars.className = "day-avatars";
      for (const person of attendees.slice(0, 3)) {
        const avatarSource =
          person.type === "member"
            ? getMember(person.memberId)?.avatar || GUEST_AVATAR
            : GUEST_AVATAR;
        const avatar = createAvatarButton(avatarSource, person.name, 25);
        avatars.append(avatar);
      }
      if (attendees.length > 3) {
        const more = document.createElement("span");
        more.className = "avatar-more";
        more.textContent = `+${attendees.length - 3}`;
        avatars.append(more);
      }
      cell.append(avatars);
    }
    $("#calendar-grid").append(cell);
  }
  $("#month-summary").textContent = loading
    ? "— lượt check-in"
    : `${records.length} lượt check-in`;
}
function load() {
  unsubscribe?.();
  unsubscribe = undefined;
  const current = ++generation;
  loading = true;
  records = [];
  render();
  status("Đang tải lịch của nhóm…");
  if (!service || suspended) return;
  unsubscribe = service.watchCheckins(
    monthRange(year, month),
    (result) => {
      if (current !== generation || suspended) return;
      // An empty cache is not evidence of an empty server query.
      if (result.fromCache && result.records.length === 0) {
        status(
          "Đang kết nối Firebase… Dữ liệu sẽ xuất hiện khi kết nối được xác nhận.",
        );
        return;
      }
      records = result.records;
      loading = false;
      render();
      status(
        result.fromCache
          ? "Đang hiển thị dữ liệu đã tải. Chờ kết nối để cập nhật."
          : `Đã đồng bộ${emulatorSuffix ? " · Môi trường kiểm thử cục bộ" : ""}. ${records.length === 0 ? "Tháng này chưa có ai check-in." : "Lịch tự cập nhật khi có người check-in."}`,
      );
    },
    (error) => {
      if (current !== generation || suspended) return;
      status(service.checkinErrorMessage(error), true);
    },
  );
}
function changeMonth(offset) {
  const nextIndex = year * 12 + month - 1 + offset;
  const nextYear = Math.floor(nextIndex / 12);
  if (nextYear < 1 || nextYear > 9999) return;
  year = nextYear;
  month = (nextIndex % 12) + 1;
  updateUrl();
  load();
}
function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set(
    "month",
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`,
  );
  history.replaceState(null, "", url);
}
$("#previous-month").addEventListener("click", () => changeMonth(-1));
$("#next-month").addEventListener("click", () => changeMonth(1));
$("#today-button").addEventListener("click", () => {
  [year, month] = todayKey().split("-").map(Number);
  updateUrl();
  load();
});
$("#retry-button").addEventListener("click", () =>
  service ? load() : location.reload(),
);
window.addEventListener("pagehide", () => {
  suspended = true;
  ++generation;
  unsubscribe?.();
  unsubscribe = undefined;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    suspended = false;
    load();
  }
});
window.addEventListener("offline", () =>
  status("Bạn đang ngoại tuyến. Lịch sẽ cập nhật khi kết nối trở lại."),
);
load();
try {
  service = await import("./checkin-service.js");
  load();
} catch {
  status("Không tải được Firebase. Kiểm tra kết nối mạng và thử lại.", true);
}
