import { $, pick, pulse, rnd } from "../lib/dom";
import { intToIp, maskFromPrefix, prefixForHosts, subnet } from "../lib/ip";
import { bump, gain, saveStats, stats, statsHtml } from "../lib/progress";
import { randomIp } from "./trening";

interface Card { q: string; a: string[]; e: string }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/^\//, "");

export function generateCard(): Card {
  const t = pick(["mask", "pfx", "hosts", "need", "block", "wild", "same", "same", "need"] as const);
  if (t === "mask") { const p = rnd(9, 30); return { q: `Maska dla /${p}?`, a: [intToIp(maskFromPrefix(p))], e: `/${p} → ${intToIp(maskFromPrefix(p))}` }; }
  if (t === "pfx") { const p = rnd(9, 30); return { q: `Prefiks dla maski ${intToIp(maskFromPrefix(p))}?`, a: [String(p)], e: `/${p}` }; }
  if (t === "hosts") { const p = rnd(16, 30); const h = 2 ** (32 - p) - 2; return { q: `Ile hostów w /${p}?`, a: [String(h)], e: `2^${32 - p} − 2 = ${h}` }; }
  if (t === "need") {
    const n = pick([rnd(2, 14), rnd(15, 62), rnd(63, 500), rnd(500, 4000)]);
    const p = prefixForHosts(n), b = 32 - p;
    return { q: `Najmniejszy prefiks dla ${n} hostów?`, a: [String(p)], e: `${n} + 2 = ${n + 2} → 2^${b} = ${2 ** b} → /${p}` };
  }
  if (t === "block") {
    const p = rnd(17, 30); const k = Math.ceil(p / 8); const bl = 2 ** (8 - (p - 8 * (k - 1)));
    return { q: `Blok (magiczna liczba) dla /${p}?`, a: [String(bl)], e: `256 − ${256 - bl} = ${bl}, w ${k}. oktecie` };
  }
  if (t === "wild") { const p = rnd(17, 30); const w = intToIp(~maskFromPrefix(p) >>> 0); return { q: `Wildcard dla /${p}?`, a: [w], e: w }; }
  const p = rnd(18, 29);
  const a = randomIp();
  const r = subnet(a, p);
  let b: number;
  if (Math.random() < 0.5) b = (r.net + rnd(0, r.size - 1)) >>> 0;
  else if (Math.random() < 0.5 && r.net >= r.size) b = (r.net - r.size + rnd(0, r.size - 1)) >>> 0;
  else b = (r.net + r.size + rnd(0, r.size - 1)) >>> 0;
  const bn = subnet(b, p).net;
  const yes = bn === r.net;
  return {
    q: `Czy ${intToIp(a)} i ${intToIp(b)} są w tej samej sieci /${p}?`,
    a: yes ? ["tak", "t", "yes", "y"] : ["nie", "n", "no"],
    e: `${yes ? "Tak" : "Nie"}: ${intToIp(a)} → ${intToIp(r.net)}, ${intToIp(b)} → ${intToIp(bn)}`,
  };
}

export function initFlash() {
  let card: Card;
  let start = 0, done = false;
  const sprint = { on: false, end: 0, score: 0, tick: 0 };
  const input = $<HTMLInputElement>("#flA");
  const fb = $("#flFb");

  function next() {
    card = generateCard();
    start = performance.now(); done = false;
    $("#flQ").textContent = card.q;
    input.value = ""; input.className = "";
    fb.className = "fb";
    $("#flStats").innerHTML = statsHtml("fl");
  }

  function check() {
    if (done) { if (!sprint.on) { next(); input.focus(); } return; }
    const v = norm(input.value);
    if (!v) return;
    const ok = card.a.map(norm).includes(v);
    const ms = performance.now() - start;
    done = true;
    bump("fl", ok, ms);
    input.className = ok ? "ok" : "bad";
    pulse($("#flCard"), ok);
    if (ok) gain(ms < 5000 ? 5 : 3);

    if (sprint.on) {
      if (ok) {
        sprint.score++;
        $("#spScore").textContent = String(sprint.score);
        const prev = card.e;
        next();
        fb.className = "fb show ok";
        fb.textContent = `Poprzednie: ${prev}`;
      } else {
        fb.className = "fb show bad";
        fb.textContent = `Nie. ${card.e}`;
        setTimeout(() => { if (sprint.on) { next(); input.focus(); } }, 1100);
      }
    } else {
      fb.className = "fb show " + (ok ? "ok" : "bad");
      fb.innerHTML = (ok ? `Dobrze, ${(ms / 1000).toFixed(1)} s. ` : "Nie. ") + card.e + `<br><span class="note">Enter → następne</span>`;
    }
    $("#flStats").innerHTML = statsHtml("fl");
  }

  function stopSprint() {
    sprint.on = false;
    clearInterval(sprint.tick);
    const btn = $<HTMLButtonElement>("#spBtn");
    btn.disabled = false; btn.textContent = "Sprint 60 s";
    const record = sprint.score > stats.sprint;
    if (record) { stats.sprint = sprint.score; saveStats(); }
    gain(sprint.score * 2);
    fb.className = "fb show ok";
    fb.innerHTML = `Koniec sprintu: <b>${sprint.score}</b> trafionych${record ? ". Nowy rekord!" : `. Rekord: ${stats.sprint}.`}`;
    $("#flStats").innerHTML = statsHtml("fl");
    done = true;
  }

  $("#spBtn").addEventListener("click", () => {
    sprint.on = true; sprint.score = 0; sprint.end = performance.now() + 60000;
    $("#spBar").hidden = false;
    $("#spScore").textContent = "0";
    const btn = $<HTMLButtonElement>("#spBtn");
    btn.disabled = true; btn.textContent = "Trwa…";
    next(); input.focus();
    sprint.tick = window.setInterval(() => {
      const left = Math.max(0, (sprint.end - performance.now()) / 1000);
      $("#spTime").textContent = String(Math.ceil(left));
      if (left <= 0) stopSprint();
    }, 200);
  });
  $("#flCheck").addEventListener("click", check);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
  next();
}
