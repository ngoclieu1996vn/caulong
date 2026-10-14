export const isLocalEmulator =
  ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) &&
  new URLSearchParams(location.search).get("emulator") === "1";

export const emulatorSuffix = isLocalEmulator ? "&emulator=1" : "";

// Apply before validating the date: invalid-date recovery must also stay local.
export function preserveLocalCalendarLinks() {
  if (!isLocalEmulator) return;
  for (const link of document.querySelectorAll('a[href="./index.html"]')) {
    link.setAttribute("href", "./index.html?emulator=1");
  }
}
