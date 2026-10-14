import {
  isValidDateKey,
  selectedDateParts,
  normalizeGuestName,
  formatCheckinTime,
} from "./utils.js";
import { MEMBERS, getMember, GUEST_AVATAR } from "./members.js";
import { emulatorSuffix, preserveLocalCalendarLinks } from "./navigation.js";

preserveLocalCalendarLinks();

const $ = (selector) => document.querySelector(selector);
const parameters = new URLSearchParams(location.search);
const date = parameters.get("date");
let service,
  unsubscribe,
  selectedId = null,
  pending = null,
  ready = false,
  suspended = false,
  generation = 0;
let records = [];
const cards = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function status(message, error = false) {
  $("#data-status").textContent = message;
  $("#data-status").classList.toggle("is-error", error);
  $("#retry-button").hidden = !error;
}
function notice(message, error = false) {
  $("#notice").textContent = message;
  $("#notice").hidden = false;
  $("#notice").classList.toggle("is-error", error);
}
function buildCards() {
  for (const member of MEMBERS) {
    const card = element("article", "member-card");
    card.dataset.memberId = member.id;
    const select = element("button", "member-select");
    select.type = "button";
    select.setAttribute("aria-expanded", "false");
    select.setAttribute("aria-controls", `action-${member.id}`);
    const avatar = element("img");
    avatar.src = member.avatar;
    avatar.alt = "";
    avatar.width = 49;
    avatar.height = 49;
    const info = element("span", "member-info");
    const state = element("span", "member-state", "Chưa check-in");
    info.append(
      element("span", "member-name", member.name),
      element("span", "member-meta", `${member.level} · ${member.gender}`),
      state,
    );
    const indicator = element("span", "selection-indicator");
    indicator.setAttribute("aria-hidden", "true");
    select.append(avatar, info, indicator);
    const action = element("div", "member-action");
    action.id = `action-${member.id}`;
    action.hidden = true;
    const button = element(
      "button",
      "button button-primary checkin-button",
      "Check-in",
    );
    button.type = "button";
    button.disabled = true;
    action.append(button);
    card.append(select, action);
    $("#member-grid").append(card);
    cards.set(member.id, { card, select, state, indicator, action, button });
    select.addEventListener("click", () => {
      selectedId = selectedId === member.id ? null : member.id;
      updateCards();
    });
    button.addEventListener("click", () => submitMember(member));
  }
}
function updateCards() {
  for (const member of MEMBERS) {
    const view = cards.get(member.id);
    const record = records.find(
      (item) => item.type === "member" && item.memberId === member.id,
    );
    const selected = selectedId === member.id;
    const sending = pending?.memberId === member.id;
    view.card.classList.toggle("is-checked", Boolean(record));
    view.card.classList.toggle("is-selected", selected && !record);
    view.select.setAttribute("aria-expanded", String(selected && !record));
    view.select.disabled = Boolean(pending);
    view.state.textContent = record
      ? `✓ Đã check-in · ${formatCheckinTime(record.checkedInAt)}`
      : sending
        ? "Đang chờ xác nhận…"
        : "Chưa check-in";
    view.state.classList.toggle("checked", Boolean(record));
    view.indicator.textContent = record || selected ? "✓" : "";
    view.action.hidden = (!selected || Boolean(record)) && !sending;
    view.button.disabled = !ready || Boolean(pending) || Boolean(record);
    view.button.textContent = sending ? "Đang gửi…" : "Check-in";
  }
  $("#guest-submit").disabled = !ready || Boolean(pending);
  $("#guest-submit").textContent =
    pending?.type === "guest" ? "Đang chờ xác nhận…" : "Xác nhận check-in";
  $("#guest-name").disabled = Boolean(pending);
  $("#guest-toggle").disabled = Boolean(pending);
}
function renderAttendees() {
  $("#attendee-count").textContent = String(records.length);
  $("#date-count").textContent = `${records.length} người đã check-in`;
  const list = $("#attendee-list");
  list.replaceChildren();
  if (!records.length) {
    list.append(element("li", "empty-state", "Chưa có ai check-in ngày này."));
    return;
  }
  for (const record of records) {
    const row = element("li", "attendee");
    const avatar = element("img");
    avatar.src =
      record.type === "member"
        ? getMember(record.memberId)?.avatar || GUEST_AVATAR
        : GUEST_AVATAR;
    avatar.alt = "";
    avatar.width = 37;
    avatar.height = 37;
    const info = element("div", "attendee-info");
    info.append(
      element("p", "attendee-name", record.name),
      element(
        "p",
        "attendee-type",
        record.type === "member" ? "Thành viên" : "Khách vãng lai",
      ),
    );
    const time = element(
      "div",
      "attendee-time",
      formatCheckinTime(record.checkedInAt),
    );
    time.append(element("span", "success-label", "✓ Thành công"));
    row.append(avatar, info, time);
    list.append(row);
  }
}
function subscribe() {
  unsubscribe?.();
  unsubscribe = undefined;
  const current = ++generation;
  ready = false;
  updateCards();
  status("Đang tải danh sách check-in…");
  if (!service || suspended) return;
  unsubscribe = service.watchCheckins(
    { date },
    (result) => {
      if (current !== generation || suspended) return;
      if (result.fromCache && !result.records.length && !ready) {
        status("Đang kết nối Firebase… Chờ xác nhận dữ liệu của ngày này.");
        return;
      }
      records = result.records;
      // Cached empty data alone must never enable an initial check-in.
      if (!result.fromCache) ready = true;
      renderAttendees();
      updateCards();
      status(
        result.fromCache
          ? "Đang hiển thị dữ liệu đã tải. Chờ kết nối để cập nhật."
          : `Đã đồng bộ${emulatorSuffix ? " · Môi trường kiểm thử cục bộ" : ""}. Danh sách tự cập nhật khi có người check-in.`,
      );
    },
    (error) => {
      if (current !== generation || suspended) return;
      ready = false;
      updateCards();
      status(service.checkinErrorMessage(error), true);
      if (!records.length)
        $("#attendee-list").replaceChildren(
          element(
            "li",
            "empty-state",
            "Chưa tải được danh sách. Vui lòng thử lại.",
          ),
        );
    },
  );
}
function pendingNotice() {
  notice(
    navigator.onLine
      ? "Đang gửi check-in, chờ Firebase xác nhận…"
      : "Bạn đang ngoại tuyến. Check-in đang chờ kết nối và xác nhận từ Firebase.",
  );
}
async function submitMember(member) {
  if (
    !ready ||
    pending ||
    records.some(
      (item) => item.type === "member" && item.memberId === member.id,
    )
  )
    return;
  pending = { type: "member", memberId: member.id };
  updateCards();
  pendingNotice();
  try {
    const result = await service.checkInMember(date, member.id);
    notice(
      result.alreadyExists
        ? `${member.name} đã check-in ngày này từ thiết bị khác.`
        : `${member.name} đã check-in thành công. Hẹn gặp trên sân!`,
    );
  } catch (error) {
    notice(service.checkinErrorMessage(error), true);
  } finally {
    pending = null;
    updateCards();
  }
}
async function submitGuest(event) {
  event.preventDefault();
  if (!ready || pending) return;
  $("#guest-error").textContent = "";
  $("#guest-name").removeAttribute("aria-invalid");
  let name;
  try {
    name = normalizeGuestName($("#guest-name").value);
  } catch (error) {
    $("#guest-error").textContent = error.message;
    $("#guest-name").setAttribute("aria-invalid", "true");
    $("#guest-name").focus();
    return;
  }
  pending = { type: "guest" };
  updateCards();
  pendingNotice();
  try {
    await service.checkInGuest(date, name);
    $("#guest-name").value = "";
    notice(`Check-in thành công. Chào mừng ${name} đến với buổi cầu!`);
  } catch (error) {
    notice(service.checkinErrorMessage(error), true);
  } finally {
    pending = null;
    updateCards();
  }
}
async function boot() {
  if (!isValidDateKey(date)) {
    $("#invalid-date").hidden = false;
    return;
  }
  $("#detail-content").hidden = false;
  const parts = selectedDateParts(date);
  document.title = `Check-in ${parts.day}/${parts.month}/${parts.year} · Cầu lông`;
  $("#date-weekday").textContent = parts.weekday;
  $("#date-number").textContent = parts.day;
  $("#date-month").textContent = `Tháng ${parts.month}, ${parts.year}`;
  $("#back-link").href =
    `./index.html?month=${date.slice(0, 7)}${emulatorSuffix}`;
  buildCards();
  $("#guest-toggle").addEventListener("click", () => {
    const expanded = $("#guest-form").hidden;
    $("#guest-form").hidden = !expanded;
    $("#guest-toggle").setAttribute("aria-expanded", String(expanded));
    if (expanded) $("#guest-name").focus();
  });
  $("#guest-form").addEventListener("submit", submitGuest);
  $("#retry-button").addEventListener("click", () =>
    service ? subscribe() : location.reload(),
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
      subscribe();
    }
  });
  window.addEventListener("offline", () => {
    status("Bạn đang ngoại tuyến. Dữ liệu sẽ cập nhật khi có kết nối.");
    if (pending) pendingNotice();
  });
  window.addEventListener("online", () => {
    if (pending) pendingNotice();
  });
  try {
    service = await import("./checkin-service.js");
    subscribe();
  } catch {
    status("Không tải được Firebase. Kiểm tra kết nối mạng và thử lại.", true);
  }
}
await boot();
