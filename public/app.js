"use strict";

const navLinks = [...document.querySelectorAll("[data-view]")];
const breadcrumb = document.getElementById("breadcrumbCurrent");
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const toast = document.getElementById("toast");

const labels = {
  start: "Übersicht",
  faecher: "Meine Fächer",
  lernen: "Lernbereich",
  pruefungen: "Prüfungen",
  fortschritt: "Fortschritt",
  konto: "Anmelden"
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function navigate(view) {
  if (!labels[view]) return;
  navLinks.forEach(link => link.classList.toggle("active", link.dataset.view === view));
  breadcrumb.textContent = labels[view];
  sidebar.classList.remove("open");
  if (view !== "start") {
    const messages = {
      faecher: "Die Fachübersicht wird als Nächstes mit echten Lerninhalten verbunden.",
      lernen: "Der Lernbereich wird gerade vorbereitet.",
      pruefungen: "Der Prüfungsmodus wird als Nächstes eingerichtet.",
      fortschritt: "Deine persönlichen Statistiken folgen mit dem Benutzerkonto.",
      konto: "Die sichere Konto- und Anmeldefunktion wird als Nächstes eingerichtet."
    };
    showToast(messages[view]);
  }
}

navLinks.forEach(link => link.addEventListener("click", event => {
  event.preventDefault();
  const view = link.dataset.view;
  history.replaceState(null, "", "#" + view);
  navigate(view);
}));

menuButton?.addEventListener("click", () => sidebar.classList.toggle("open"));

async function checkWorker() {
  try {
    const response = await fetch("/api/health", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("API nicht erreichbar");
    const result = await response.json();
    document.documentElement.dataset.api = result.status === "ok" ? "online" : "offline";
  } catch {
    document.documentElement.dataset.api = "offline";
  }
}

const initialView = location.hash.slice(1);
if (labels[initialView]) navigate(initialView);
checkWorker();