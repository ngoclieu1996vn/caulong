let viewer;
let viewerImage;
let viewerName;
let opener;
let openerScope;

function openAvatar(button, src, name) {
  if (!viewer) {
    viewer = document.createElement("dialog");
    viewer.className = "avatar-viewer";
    viewer.setAttribute("aria-labelledby", "avatar-viewer-name");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "avatar-viewer-close";
    close.setAttribute("aria-label", "Đóng ảnh");
    close.textContent = "×";
    close.autofocus = true;
    close.addEventListener("click", () => viewer.close());
    const figure = document.createElement("figure");
    viewerImage = document.createElement("img");
    viewerName = document.createElement("figcaption");
    viewerName.id = "avatar-viewer-name";
    figure.append(viewerImage, viewerName);
    viewer.append(close, figure);
    document.body.append(viewer);
    viewer.addEventListener("click", (event) => {
      if (event.target !== viewer) return;
      const rect = viewer.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
    });
    viewer.addEventListener("close", () => {
      document.body.classList.remove("avatar-viewer-open");
      viewerImage.removeAttribute("src");
      let target = opener;
      if (!target?.isConnected) {
        const replacements = openerScope?.isConnected
          ? [...openerScope.querySelectorAll(".avatar-trigger")]
          : [];
        target = replacements.find(candidate =>
          candidate.getAttribute("aria-label") === opener?.getAttribute("aria-label") &&
          candidate.querySelector("img")?.getAttribute("src") === opener?.querySelector("img")?.getAttribute("src")
        ) || replacements[0] || document.querySelector("#back-link, #today-button");
      }
      target?.focus({ preventScroll: true });
      opener = undefined;
      openerScope = undefined;
    });
    window.addEventListener("pagehide", () => { if (viewer.open) viewer.close(); });
  }
  opener = button;
  openerScope = button.closest("#calendar-grid, #member-grid, #attendee-list");
  viewerImage.src = src;
  viewerImage.alt = `Ảnh đại diện của ${name}`;
  viewerName.textContent = name;
  document.body.classList.add("avatar-viewer-open");
  viewer.showModal();
}

export function createAvatarButton(src, name, size) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "avatar-trigger";
  button.setAttribute("aria-label", `Xem ảnh của ${name}`);
  button.setAttribute("aria-haspopup", "dialog");
  button.title = `Xem ảnh của ${name}`;
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.width = size;
  image.height = size;
  button.append(image);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    openAvatar(button, src, name);
  });
  return button;
}
