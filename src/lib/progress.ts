import { $ } from "./dom";
import { load, save } from "./store";

export const KEY = "pt-";

let toastTimer: number | undefined;
export function toast(msg: string) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove("on"), 1800);
}

const RANKS = ["Script kiddie", "Pinger", "Packet sniffer", "ARP whisperer", "Subnet ninja",
  "CIDR wizard", "VLSM architect", "Router root", "CCIE wannabe", "Netgod"];
let xp = load<number>(KEY + "xp", 0);
const levelOf = (x: number) => Math.floor(Math.sqrt(x / 40)) + 1;
const rankOf = (l: number) => RANKS[Math.min(l - 1, RANKS.length - 1)];

export function drawXp() {
  const l = levelOf(xp), lo = 40 * (l - 1) ** 2, hi = 40 * l ** 2;
  $("#rank").textContent = `Lv ${l} ${rankOf(l)}`;
  $("#xpFill").style.width = (((xp - lo) / (hi - lo)) * 100).toFixed(1) + "%";
  $("#xpTxt").textContent = `${xp} XP`;
}

export function gain(n: number) {
  if (n <= 0) return;
  const before = levelOf(xp);
  xp += n;
  save(KEY + "xp", xp);
  drawXp();
  const after = levelOf(xp);
  toast(after > before ? `Awans: Lv ${after} ${rankOf(after)}` : `+${n} XP`);
}

interface Track { n: number; ok: number; streak: number; best: number; time: number }
interface Stats { tr: Track; fl: Track; sprint: number }
const empty = (): Track => ({ n: 0, ok: 0, streak: 0, best: 0, time: 0 });
export const stats: Stats = Object.assign({ tr: empty(), fl: empty(), sprint: 0 }, load<Partial<Stats>>(KEY + "stats", {}));

export function bump(key: "tr" | "fl", ok: boolean, ms: number) {
  const s = stats[key];
  s.n++;
  if (ok) { s.ok++; s.streak++; s.best = Math.max(s.best, s.streak); s.time += ms; }
  else s.streak = 0;
  saveStats();
}
export const saveStats = () => save(KEY + "stats", stats);

export function statsHtml(key: "tr" | "fl") {
  const s = stats[key];
  const avg = s.ok ? (s.time / s.ok / 1000).toFixed(1) : "–";
  return `<span>Poprawne <b>${s.ok}/${s.n}</b></span><span>Seria <b>${s.streak}</b></span>` +
    `<span>Rekord serii <b>${s.best}</b></span><span>Średni czas <b>${avg} s</b></span>` +
    (key === "fl" ? `<span>Rekord sprintu <b>${stats.sprint}</b></span>` : "");
}
