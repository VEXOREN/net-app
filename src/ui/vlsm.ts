import { $, segmented } from "../lib/dom";
import { intToIp } from "../lib/ip";
import { gain } from "../lib/progress";
import { generateTask, solve, validate, type Placed, type Task } from "../lib/vlsm";

export function initVlsm() {
  let level: 1 | 2 = 1;
  let task: Task;
  let rewarded = false;

  function poolMap(placed: Placed[]) {
    const size = 2 ** (32 - task.bp);
    const segs = placed.map((g, i) => {
      const l = ((g.net - task.base) / size) * 100;
      const w = ((g.bc - g.net + 1) / size) * 100;
      const c = i % 2 ? "host" : "net";
      return `<div title="${g.name}: ${intToIp(g.net)}/${g.p}" class="seg-${c}" style="left:${l}%;width:${w}%">${w > 6 ? g.name : ""}</div>`;
    }).join("");
    const used = placed.reduce((s, g) => s + g.bc - g.net + 1, 0);
    return `<div class="bmap-head" style="margin-top:12px"><span>Mapa puli</span><span>zajęte ${used} / ${size}</span></div>` +
      `<div class="pool">${segs}</div>` +
      `<div class="bmap-ax"><span>${intToIp(task.base)}</span><span>${intToIp((task.base + size - 1) >>> 0)}</span></div>`;
  }

  function fresh() {
    task = generateTask(level);
    rewarded = false;
    $("#vlBase").textContent = `${intToIp(task.base)}/${task.bp} (${2 ** (32 - task.bp)} adresów)`;
    $("#vlRows").innerHTML = task.reqs.map((r, i) =>
      `<div class="vl-row"><div><b>${r.name}</b><br><span class="note">${r.hosts} ${r.hosts === 2 ? "adresy (punkt-punkt)" : "hostów"}</span></div>` +
      `<input type="text" id="vl${i}" placeholder="a.b.c.d/p" autocomplete="off" spellcheck="false" aria-label="${r.name}">` +
      `<div class="msg" id="vm${i}"></div></div>`).join("");
    $("#vlFb").className = "fb";
    $("#vlMap").innerHTML = poolMap([]);
  }

  function check(fromSolution = false) {
    const answers = task.reqs.map((_, i) => $<HTMLInputElement>("#vl" + i).value);
    const res = validate(task, answers);
    res.rows.forEach((r, i) => {
      $("#vl" + i).className = r.ok ? "ok" : "bad";
      const m = $("#vm" + i);
      m.className = "msg " + (r.ok ? "ok" : "bad");
      m.textContent = r.msg;
    });
    $("#vlMap").innerHTML = poolMap(res.placed);
    const fb = $("#vlFb");
    fb.className = "fb show " + (res.all ? "ok" : "bad");
    fb.textContent = res.all ? "Cały plan poprawny." : "Popraw zaznaczone wiersze. Od największej, każda sieć na wielokrotności swojego bloku.";
    if (res.all && !rewarded && !fromSolution) { rewarded = true; gain(level === 1 ? 25 : 40); }
  }

  function showSolution() {
    rewarded = true;
    const s = solve(task);
    task.reqs.forEach((r, i) => { $<HTMLInputElement>("#vl" + i).value = `${intToIp(s.get(r.name)!)}/${r.p}`; });
    check(true);
    const order = [...task.reqs].sort((a, b) => a.p - b.p).map((r) => `${r.name} /${r.p} (blok ${2 ** (32 - r.p)})`).join(" → ");
    $("#vlFb").textContent = `Kolejność: ${order}. Każda kolejna sieć zaczyna się od broadcastu poprzedniej + 1.`;
  }

  segmented("#vlLvl", (l) => { level = l === 2 ? 2 : 1; fresh(); });
  $("#vlCheck").addEventListener("click", () => check());
  $("#vlShow").addEventListener("click", showSolution);
  $("#vlNew").addEventListener("click", fresh);
  $("#t-vlsm").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") check(); });
  fresh();
}
