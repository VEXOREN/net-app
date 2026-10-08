import { $, fmt, pulse, rnd, segmented } from "../lib/dom";
import { intToIp, ipToInt, magic, octet, subnet, type Subnet } from "../lib/ip";
import { bump, gain, statsHtml } from "../lib/progress";
import { stepsHtml } from "./explain";

export function randomIp(): number {
  return (rnd(1, 223) * 16777216 + rnd(0, 255) * 65536 + rnd(0, 255) * 256 + rnd(0, 255)) >>> 0;
}

const FIELDS = ["#trNet", "#trBc", "#trFirst", "#trLast", "#trHosts"];

export function initTrening() {
  let level = 1;
  let task: Subnet | null = null;
  let start = 0, done = false, hinted = false, tick: number | undefined;

  function next() {
    const lo = level === 1 ? 24 : level === 2 ? 16 : 8;
    let p = rnd(lo, 30);
    if (p % 8 === 0) p++;
    task = subnet(randomIp(), p);
    start = performance.now(); done = false; hinted = false;
    $("#trTask").textContent = `${intToIp(task.ip)}/${p}`;
    FIELDS.forEach((s) => { const e = $<HTMLInputElement>(s); e.value = ""; e.className = ""; });
    $("#trFb").className = "fb";
    $("#trStats").innerHTML = statsHtml("tr");
    clearInterval(tick);
    tick = window.setInterval(() => { $("#trTime").textContent = ((performance.now() - start) / 1000).toFixed(1) + " s"; }, 100);
  }

  function check() {
    if (!task || done) return;
    const t = task;
    let all = true;
    ([["#trNet", t.net], ["#trBc", t.bc], ["#trFirst", t.first], ["#trLast", t.last]] as const).forEach(([s, v]) => {
      const e = $<HTMLInputElement>(s);
      const ok = ipToInt(e.value) === v;
      e.className = ok ? "ok" : "bad";
      all &&= ok;
    });
    const he = $<HTMLInputElement>("#trHosts");
    const hok = he.value !== "" && Number(he.value) === t.hosts;
    he.className = hok ? "ok" : "bad";
    all &&= hok;

    const ms = performance.now() - start;
    done = true;
    clearInterval(tick);
    bump("tr", all, ms);
    pulse($("#trCard"), all);
    const fb = $("#trFb");
    fb.className = "fb show " + (all ? "ok" : "bad");
    fb.innerHTML = all
      ? `Dobrze, ${(ms / 1000).toFixed(1)} s.`
      : `Poprawnie: sieć <b class="mono">${intToIp(t.net)}</b>, broadcast <b class="mono">${intToIp(t.bc)}</b>, ` +
        `hosty <b class="mono">${intToIp(t.first)} – ${intToIp(t.last)}</b> (${fmt(t.hosts)}).<div class="steps">${stepsHtml(t.ip, t.p)}</div>`;
    $("#trStats").innerHTML = statsHtml("tr");
    if (all) gain(hinted ? 4 : ms < 20000 ? 15 : 10);
  }

  $("#trHint").addEventListener("click", () => {
    if (!task || done) return;
    const mg = magic(task.p);
    if (!mg) return;
    hinted = true;
    const fb = $("#trFb");
    fb.className = "fb show ok";
    fb.innerHTML = `Ciekawy oktet: <b>${mg.k}.</b> (wartość ${octet(task.ip, mg.k - 1)}), blok <b>${mg.block}</b>. ` +
      `Szukaj wielokrotności ${mg.block} tuż pod tą wartością.`;
  });
  segmented("#lvl", (l) => { level = l; next(); });
  $("#trCheck").addEventListener("click", check);
  $("#trNext").addEventListener("click", next);
  $("#t-trening").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); done ? next() : check(); }
  });
  next();
}
