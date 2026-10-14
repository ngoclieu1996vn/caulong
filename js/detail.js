import {
  isValidDateKey,
  selectedDateParts,
  normalizeGuestName,
  formatCheckinTime,
} from "./utils.js";
import { MEMBERS, getMember, GUEST_AVATAR } from "./members.js";
import { emulatorSuffix, preserveLocalCalendarLinks } from "./navigation.js";
import { createAvatarButton } from "./avatar-preview.js";
import { buildParticipants } from './participants.js';
import { formatMoney } from './billing.js';
import { createBillingController } from './billing-ui.js';
import { createTeamGamesController } from './team-games-ui.js';
import { initializeDetailTabs } from './detail-tabs.js';

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
let confirmDeleteId = null;
const cards = new Map();
let billing,games;
let allocations=[];
function syncParticipants() {
  billing?.setParticipants(buildParticipants(records),{ready});
  games?.setParticipants(buildParticipants(records),{ready});
}
function renderAmounts() {
  for(const row of document.querySelectorAll('#attendee-list .attendee')) {
    row.querySelector('.attendee-billing')?.remove();
    const allocation=allocations.find(a=>a.id===row.dataset.checkinId);
    if(!allocation)continue;
    const info=element('div','attendee-billing');
    info.append(element('p','attendee-amount',formatMoney(allocation.amount)),element('p','attendee-hours',`${allocation.halfHours/2} giờ`));
    row.querySelector('.attendee-info').append(info);
  }
}

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
    const avatar = createAvatarButton(member.avatar, member.name, 49);
    avatar.classList.add("member-avatar");
    const info = element("span", "member-info");
    const state = element("span", "member-state", "Chưa check-in");
    info.append(
      element("span", "member-name", member.name),
      element("span", "member-meta", `${member.level} · ${member.gender}`),
      state,
    );
    const indicator = element("span", "selection-indicator");
    indicator.setAttribute("aria-hidden", "true");
    select.append(info, indicator);
    const main = element("div", "member-main");
    main.append(avatar, select);
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
    card.append(main, action);
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
  $('#guest-gender').disabled=Boolean(pending);
  $("#guest-toggle").disabled = Boolean(pending);
  for (const button of document.querySelectorAll(".cancel-checkin, .delete-confirm, .delete-keep")) {
    button.disabled = !ready || Boolean(pending);
  }
}
function focusRowAction(id, selector) {
  const row = [...$("#attendee-list").children].find(item => item.dataset.checkinId === id);
  const target = row?.querySelector(selector);
  if (!target || target.disabled) return false;
  target.focus({ preventScroll: true });
  return true;
}
function focusAttendeesHeading() {
  $("#attendees-title").tabIndex = -1;
  $("#attendees-title").focus({ preventScroll: true });
}
function renderAttendees() {
  $("#attendee-count").textContent = String(records.length);
  $("#date-count").textContent = `${records.length} người đã check-in`;
  const list = $("#attendee-list");
  const active = document.activeElement;
  const actionClass = ["cancel-checkin", "delete-confirm", "delete-keep"].find(name => active?.classList.contains(name));
  const focusedAction = list.contains(active) && actionClass
    ? { id: active.closest(".attendee")?.dataset.checkinId, selector: `.${actionClass}` }
    : null;
  const restoreActionFocus = () => {
    if (focusedAction && !pending && !focusRowAction(focusedAction.id, focusedAction.selector)) focusAttendeesHeading();
  };
  list.replaceChildren();
  if (!records.length) {
    list.append(element("li", "empty-state", "Chưa có ai check-in ngày này."));
    restoreActionFocus();
    return;
  }
  for (const record of records) {
    const row = element("li", "attendee");
    row.dataset.checkinId = record.id;
    const avatarSource =
      record.type === "member"
        ? getMember(record.memberId)?.avatar || GUEST_AVATAR
        : GUEST_AVATAR;
    const avatar = createAvatarButton(avatarSource, record.name, 37);
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
    const actions = element("div", "attendee-actions");
    const remove = element("button", "button cancel-checkin", "Hủy check-in");
    remove.type = "button";
    remove.disabled = !ready || Boolean(pending);
    remove.setAttribute("aria-expanded", String(confirmDeleteId === record.id));
    remove.addEventListener("click", () => {
      if (!ready || pending) return;
      confirmDeleteId = record.id;
      renderAttendees();
      focusRowAction(record.id, ".delete-confirm");
    });
    actions.append(remove);
    row.append(avatar, info, time, actions);
    if (confirmDeleteId === record.id) {
      const confirmation = element("div", "attendee-confirmation");
      confirmation.setAttribute("role", "group");
      confirmation.setAttribute("aria-label", `Hủy check-in của ${record.name}`);
      confirmation.append(element("p", "cancel-prompt", `Hủy check-in của ${record.name}?`));
      const controls = element("div", "cancel-controls");
      const deleting = pending?.type === "delete" && pending.record.id === record.id;
      const confirm = element("button", "button button-danger delete-confirm", deleting ? "Đang hủy…" : "Xác nhận hủy");
      confirm.type = "button";
      confirm.disabled = !ready || Boolean(pending);
      confirm.addEventListener("click", () => submitCancellation(record));
      const keep = element("button", "button button-light delete-keep", "Giữ lại");
      keep.type = "button";
      keep.disabled = !ready || Boolean(pending);
      keep.addEventListener("click", () => {
        if (pending) return;
        confirmDeleteId = null;
        renderAttendees();
        focusRowAction(record.id, ".cancel-checkin");
      });
      controls.append(confirm, keep);
      confirmation.append(controls);
      row.append(confirmation);
    }
    list.append(row);
  }
  restoreActionFocus();
  renderAmounts();
}
function subscribe() {
  unsubscribe?.();
  unsubscribe = undefined;
  const current = ++generation;
  ready = false;
  syncParticipants();
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
      // Firestore can emit a local removal before the delete promise is acknowledged.
      // Keep the confirmed row and member badge until that promise succeeds.
      if (pending?.type === "delete" && !records.some(item => item.id === pending.record.id)) {
        records = [...records, pending.record].sort((a, b) => a.checkedInAt.toMillis() - b.checkedInAt.toMillis());
      }
      if (confirmDeleteId && !records.some(item => item.id === confirmDeleteId)) confirmDeleteId = null;
      // Cached empty data alone must never enable an initial check-in.
      if (!result.fromCache) ready = true;
      syncParticipants();
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
      syncParticipants();
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
  if (pending?.type === "delete") {
    notice(navigator.onLine
      ? "Đang hủy check-in, chờ Firebase xác nhận…"
      : "Bạn đang ngoại tuyến. Yêu cầu hủy đang chờ kết nối và xác nhận từ Firebase.");
    return;
  }
  notice(
    navigator.onLine
      ? "Đang gửi check-in, chờ Firebase xác nhận…"
      : "Bạn đang ngoại tuyến. Check-in đang chờ kết nối và xác nhận từ Firebase.",
  );
}
async function submitCancellation(record) {
  if (!ready || pending || confirmDeleteId !== record.id || !records.some(item => item.id === record.id)) return;
  pending = { type: "delete", record };
  updateCards();
  renderAttendees();
  pendingNotice();
  let succeeded = false;
  try {
    await service.cancelCheckin(record.id);
    records = records.filter(item => item.id !== record.id);
    syncParticipants();
    confirmDeleteId = null;
    if (selectedId === record.memberId) selectedId = null;
    notice(`Đã hủy check-in của ${record.name}.`);
    succeeded = true;
  } catch (error) {
    notice(service.checkinErrorMessage(error), true);
  } finally {
    pending = null;
    renderAttendees();
    updateCards();
    if (!$("#panel-list").hidden) {
      if (!succeeded) focusRowAction(record.id, ".delete-confirm");
      else focusAttendeesHeading();
    }
  }
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
  $('#guest-gender').removeAttribute('aria-invalid');
  let name;
  try {
    name = normalizeGuestName($("#guest-name").value);
  } catch (error) {
    $("#guest-error").textContent = error.message;
    $("#guest-name").setAttribute("aria-invalid", "true");
    $("#guest-name").focus();
    return;
  }
  const gender=$('#guest-gender').value;
  if(!['Nam','Nữ'].includes(gender)) {
    $('#guest-error').textContent='Vui lòng chọn giới tính Nam hoặc Nữ.';
    $('#guest-gender').setAttribute('aria-invalid','true');$('#guest-gender').focus();return;
  }
  pending = { type: "guest" };
  updateCards();
  pendingNotice();
  try {
    await service.checkInGuest(date, name, gender);
    $("#guest-name").value = "";
    $('#guest-gender').value='';
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
  initializeDetailTabs($('#detail-content'));
  billing=createBillingController({date,root:$('#billing-root'),summaryRoot:$('#day-summary'),onAllocationsChange:result=>{allocations=result.allocations;renderAmounts();}});
  billing.start();
  games=createTeamGamesController({date,root:$('#games-root')});games.start();
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
    billing.stop();
    games.stop();
    ++generation;
    unsubscribe?.();
    unsubscribe = undefined;
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      suspended = false;
      billing.start();
      games.start();
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
