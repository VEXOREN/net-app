import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./style.css";

import { registerSW } from "virtual:pwa-register";
import { $, $$ } from "./lib/dom";
import { clearAll } from "./lib/store";
import { drawXp, KEY, toast } from "./lib/progress";
import { initHero } from "./ui/hero";
import { initTrening } from "./ui/trening";
import { initFlash } from "./ui/flash";
import { initVlsm } from "./ui/vlsm";
import { initQuiz } from "./ui/quiz";
import { initWalkthrough } from "./ui/walkthrough";
import { initSync } from "./lib/sync";
import { initAccount } from "./ui/account";
import { initDuel } from "./ui/duel";

const root = document.documentElement;
try { const t = localStorage.getItem(KEY + "theme"); if (t) root.dataset.theme = JSON.parse(t); } catch {}
function syncThemeColor() {
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}
$("#themeBtn").addEventListener("click", () => {
  const light = root.dataset.theme ? root.dataset.theme === "light" : matchMedia("(prefers-color-scheme: light)").matches;
  root.dataset.theme = light ? "dark" : "light";
  try { localStorage.setItem(KEY + "theme", JSON.stringify(root.dataset.theme)); } catch {}
  syncThemeColor();
});
syncThemeColor();

const tabs = $$<HTMLButtonElement>("#tabs button");
function openTab(name: string) {
  if (!tabs.some((b) => b.dataset.t === name)) name = "metoda";
  tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === name)));
  $$("section.tab").forEach((s) => s.classList.toggle("on", s.id === "t-" + name));
}
tabs.forEach((b) => b.addEventListener("click", () => {
  history.replaceState(null, "", "#" + b.dataset.t);
  openTab(b.dataset.t!);
}));
window.addEventListener("hashchange", () => openTab(location.hash.slice(1)));
openTab(location.hash.slice(1));

drawXp();
initHero();
initWalkthrough();
initTrening();
initFlash();
initVlsm();
initQuiz();
initSync();
initAccount();
initDuel();

$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Wyzerować lokalne XP, statystyki i rekordy? Postęp zapisany na koncie zostanie.")) return;
  clearAll(KEY);
  location.reload();
});

const dot = $("#offDot");
const label = $("#offTxt");
function setStatus(ready: boolean) {
  dot.classList.toggle("on", ready);
  label.textContent = ready ? "Gotowe offline" : "Ładowanie do pracy offline…";
}
setStatus(!!navigator.serviceWorker?.controller);
registerSW({
  immediate: true,
  onOfflineReady() { setStatus(true); toast("Aplikacja działa teraz offline"); },
  onRegisteredSW() { if (navigator.serviceWorker?.controller) setStatus(true); },
  onRegisterError() { label.textContent = "Tryb offline niedostępny w tej przeglądarce"; },
});
