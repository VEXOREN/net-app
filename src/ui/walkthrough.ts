import { $, rnd, reducedMotion } from "../lib/dom";
import { intToIp, ipToInt, magic, octet, subnet } from "../lib/ip";
import { gain } from "../lib/progress";

interface Example {
  ip: number; p: number; octs: number[];
  k: number; bitsIn: number; block: number; maskOct: number; v: number; no: number;
  net: number; bc: number; first: number; last: number; hosts: number;
}

interface Ask { q: string; check: (raw: string) => boolean; answer: string }
interface Step {
  title: string;
  text: string;
  draw: (stage: HTMLElement, ex: Example) => void;
  octs: (ex: Example) => { vals: (number | string)[]; cls: string[] };
  ask?: Ask;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reducedMotion() ? 0 : ms));
let runId = 0;

function build(ip: number, p: number): Example {
  const s = subnet(ip, p);
  const mg = magic(p);
  const k = mg ? mg.k : p / 8;
  const block = mg ? mg.block : 1;
  const v = octet(ip, Math.max(0, k - 1));
  return {
    ip, p, octs: [0, 1, 2, 3].map((i) => octet(ip, i)),
    k, bitsIn: mg ? mg.bitsIn : 8, block, maskOct: mg ? mg.maskOctet : 255, v,
    no: Math.floor(v / block) * block, net: s.net, bc: s.bc, first: s.first, last: s.last, hosts: s.hosts,
  };
}

const num = (want: number) => (raw: string) => Number(raw.trim().replace(/^\//, "")) === want && raw.trim() !== "";
const ipEq = (want: number) => (raw: string) => ipToInt(raw) === want;

function bitStrip(stage: HTMLElement, ex: Example, id: number) {
  let cells = "";
  for (let i = 0; i < 32; i++) {
    const bit = (ex.octs[Math.floor(i / 8)] >> (7 - (i % 8))) & 1;
    cells += `<span class="wt-bit" data-i="${i}">${bit}</span>`;
    if (i % 8 === 7 && i < 31) cells += `<span class="wt-sep">.</span>`;
  }
  stage.innerHTML = `<div class="wt-strip">${cells}</div>
    <div class="wt-cap"><span class="wt-chip net">sieć: <b id="wtN">0</b> bitów</span><span class="wt-chip host">host: <b id="wtH">32</b> bitów</span></div>`;
  const bits = Array.from(stage.querySelectorAll<HTMLElement>(".wt-bit"));
  (async () => {
    for (let i = 0; i < ex.p; i++) {
      if (id !== runId) return;
      bits[i].classList.add("n");
      $("#wtN").textContent = String(i + 1);
      $("#wtH").textContent = String(31 - i);
      await wait(32);
    }
    for (let i = ex.p; i < 32; i++) bits[i].classList.add("h");
    if (ex.p % 8) {
      const start = (ex.k - 1) * 8;
      for (let i = start; i < start + 8; i++) bits[i].classList.add("hot");
    }
  })();
}

function maskBuild(stage: HTMLElement, ex: Example, id: number) {
  const w = [128, 64, 32, 16, 8, 4, 2, 1];
  stage.innerHTML = `<div class="wt-mask">${w.map((x, i) =>
    `<div class="wt-mb" data-i="${i}"><small>${x}</small><span>0</span></div>`).join("")}</div>
    <div class="wt-sum" id="wtSum">0</div>`;
  const boxes = Array.from(stage.querySelectorAll<HTMLElement>(".wt-mb"));
  (async () => {
    await wait(300);
    let sum = 0;
    const parts: number[] = [];
    for (let i = 0; i < ex.bitsIn; i++) {
      if (id !== runId) return;
      boxes[i].classList.add("on");
      boxes[i].querySelector("span")!.textContent = "1";
      sum += w[i]; parts.push(w[i]);
      $("#wtSum").innerHTML = `${parts.join(" + ")} = <b>${sum}</b>`;
      await wait(550);
    }
  })();
}

function magicEq(stage: HTMLElement, ex: Example, id: number) {
  stage.innerHTML = `<div class="wt-eq">
    <span class="t">256</span><span class="o">−</span><span class="t">${ex.maskOct}</span><span class="o">=</span><span class="t big" id="wtBlk">?</span></div>
    <div class="wt-alt" id="wtAlt">albo szybciej: zostało ${8 - ex.bitsIn} bit(y) hosta w oktecie → 2<sup>${8 - ex.bitsIn}</sup> = ${ex.block}</div>`;
  (async () => {
    await wait(700);
    if (id !== runId) return;
    const b = $("#wtBlk"); b.textContent = String(ex.block); b.classList.add("pop");
    await wait(600);
    if (id !== runId) return;
    $("#wtAlt").classList.add("show");
  })();
}

function numberLine(stage: HTMLElement, ex: Example, id: number) {
  const count = 256 / ex.block;
  const maxLabels = Math.max(4, Math.floor((stage.clientWidth - 60) / 36));
  let every = 1;
  while (count / every > maxLabels) every *= 2;
  let ticks = "";
  for (let i = 0; i <= count; i++) {
    const x = i * ex.block;
    const near = Math.abs(i - ex.no / ex.block) < every && x !== ex.no;
    const lab = x === ex.no || (i % every === 0 && !near) ? `<em>${x}</em>` : "";
    ticks += `<div class="wt-tick${x === ex.no ? " cur" : ""}" style="left:${(x / 256) * 100}%">${lab}</div>`;
  }
  const seg = `<div class="wt-span" id="wtSpan" style="left:${(ex.no / 256) * 100}%;width:${(ex.block / 256) * 100}%"></div>`;
  stage.innerHTML = `<div class="wt-line">
      <div class="wt-axis"></div>${ticks}${seg}
      <div class="wt-pin" style="left:${(ex.v / 256) * 100}%"><span>${ex.v}</span></div>
      <div class="wt-hop" id="wtHop" style="left:0%"></div>
    </div>
    <div class="wt-hops" id="wtHops"></div>`;
  const hop = $("#wtHop");
  const log = $("#wtHops");
  const all: number[] = [];
  for (let x = 0; x <= ex.no + ex.block && x <= 256; x += ex.block) all.push(x);
  const seq = all.length > 10 ? [0, ...all.slice(-6)] : all;
  (async () => {
    await wait(400);
    for (let i = 0; i < seq.length; i++) {
      if (id !== runId) return;
      const x = seq[i];
      const over = x > ex.v;
      hop.style.left = `${(Math.min(x, 256) / 256) * 100}%`;
      hop.classList.toggle("over", over);
      if (i === 1 && seq[1] - seq[0] > ex.block) log.insertAdjacentHTML("beforeend", `<span class="dim">…</span>`);
      log.insertAdjacentHTML("beforeend", `<span class="${over ? "x" : ""}">${x}${over ? ` > ${ex.v}` : ""}</span>`);
      await wait(over ? 500 : 380);
    }
    if (id !== runId) return;
    hop.style.left = `${(ex.no / 256) * 100}%`;
    hop.classList.remove("over");
    $("#wtSpan").classList.add("show");
  })();
}

function resultCard(stage: HTMLElement, rows: [string, string][]) {
  stage.innerHTML = `<div class="wt-res">${rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("")}</div>`;
}

function plain(ex: Example) { return { vals: ex.octs, cls: ["", "", "", ""] }; }
function hot(ex: Example) { return { vals: ex.octs, cls: ex.octs.map((_, i) => (i === ex.k - 1 ? "hot" : i < ex.k - 1 ? "net" : "host")) }; }
function netOcts(ex: Example, fill: number) {
  const ko = ex.p % 8 ? ex.k - 1 : ex.k;
  return {
    vals: ex.octs.map((v, i) => (i < ko ? v : i === ko && ex.p % 8 ? (fill === 0 ? ex.no : ex.no + ex.block - 1) : fill)),
    cls: ex.octs.map((_, i) => (i < ko ? "net" : i === ko && ex.p % 8 ? "hot done" : "host done")),
  };
}

function steps(ex: Example): Step[] {
  const ipS = `${intToIp(ex.ip)}/${ex.p}`;
  const boundary = ex.p % 8 === 0;
  const list: Step[] = [
    {
      title: "Zadanie",
      text: `Masz <b class="mono">${ipS}</b>. Szukamy adresu sieci, broadcastu i zakresu hostów, bez zamiany całego adresu na binarny.`,
      draw: (st) => resultCard(st, [["Adres", intToIp(ex.ip)], ["Prefiks", `/${ex.p}`], ["Cel", "sieć, broadcast, hosty"]]),
      octs: plain,
    },
    {
      title: "Gdzie kończy się prefiks",
      text: boundary
        ? `/${ex.p} to równo ${ex.p / 8} pełne oktety sieci. Nic nie trzeba liczyć: oktety sieci kopiujesz, resztę zerujesz albo ustawiasz na 255.`
        : `/${ex.p} = ${8 * (ex.k - 1)} + ${ex.bitsIn}. Pierwsze ${ex.k - 1} oktet(y) to w całości sieć, więc je kopiujesz. Granica wypada w <b>${ex.k}. oktecie</b>: to jedyne miejsce, gdzie liczysz.`,
      draw: (st, e) => bitStrip(st, e, runId),
      octs: boundary ? plain : hot,
      ask: boundary ? undefined : { q: "Który oktet jest ciekawy?", check: num(ex.k), answer: String(ex.k) },
    },
  ];
  if (!boundary) {
    list.push(
      {
        title: "Maska w ciekawym oktecie",
        text: `W ${ex.k}. oktecie są ${ex.bitsIn} bit(y) sieci. Zapalasz je od lewej i sumujesz wagi. Te sumy (128, 192, 224, 240, 248, 252, 254) warto znać na pamięć.`,
        draw: (st, e) => maskBuild(st, e, runId),
        octs: hot,
        ask: { q: `Ile wynosi maska w ${ex.k}. oktecie?`, check: num(ex.maskOct), answer: String(ex.maskOct) },
      },
      {
        title: "Magiczna liczba",
        text: `Blok to rozmiar jednej podsieci w tym oktecie. Podsieci zaczynają się tylko na jego wielokrotnościach.`,
        draw: (st, e) => magicEq(st, e, runId),
        octs: hot,
        ask: { q: "Jaki jest blok?", check: num(ex.block), answer: String(ex.block) },
      },
      {
        title: "Skacz po wielokrotnościach",
        text: `Wartość oktetu to <b>${ex.v}</b>. Skaczesz co ${ex.block}, aż przeskoczysz ${ex.v}. Ostatni skok przed przeskokiem to początek Twojej podsieci: <b>${ex.no}</b>. W głowie: ${ex.v} / ${ex.block} = ${Math.floor(ex.v / ex.block)} reszty ${ex.v % ex.block}, ${Math.floor(ex.v / ex.block)} × ${ex.block} = ${ex.no}.`,
        draw: (st, e) => numberLine(st, e, runId),
        octs: hot,
        ask: { q: `Ostatnia wielokrotność ${ex.block} ≤ ${ex.v}?`, check: num(ex.no), answer: String(ex.no) },
      },
    );
  }
  list.push(
    {
      title: "Adres sieci",
      text: boundary
        ? `Kopiujesz ${ex.p / 8} oktet(y) sieci, resztę zerujesz.`
        : `Oktety przed ciekawym kopiujesz, w ciekawym wpisujesz ${ex.no}${ex.k < 4 ? ", a wszystko za nim to 0" : ""}.`,
      draw: (st) => resultCard(st, [["Sieć", `${intToIp(ex.net)}/${ex.p}`]]),
      octs: (e) => netOcts(e, 0),
      ask: { q: "Adres sieci?", check: ipEq(ex.net), answer: intToIp(ex.net) },
    },
    {
      title: "Broadcast",
      text: boundary
        ? `Te same oktety sieci, reszta to 255.`
        : `Następna podsieć zaczyna się od ${ex.no} + ${ex.block} = ${ex.no + ex.block}, więc broadcast to o jeden mniej: <b>${ex.no + ex.block - 1}</b>${ex.k < 4 ? ", a dalej same 255" : ""}.`,
      draw: (st) => resultCard(st, [["Sieć", intToIp(ex.net)], ["Broadcast", intToIp(ex.bc)]]),
      octs: (e) => netOcts(e, 255),
      ask: { q: "Broadcast?", check: ipEq(ex.bc), answer: intToIp(ex.bc) },
    },
    {
      title: "Hosty",
      text: ex.p >= 31
        ? `/${ex.p} to przypadek specjalny: ${ex.p === 31 ? "łącze punkt-punkt, oba adresy są hostami" : "pojedynczy host"}.`
        : `Pierwszy host = sieć + 1, ostatni = broadcast − 1. Liczba hostów: 2<sup>${32 - ex.p}</sup> − 2 (odejmujesz sieć i broadcast).`,
      draw: (st) => resultCard(st, [["Pierwszy", intToIp(ex.first)], ["Ostatni", intToIp(ex.last)], ["Liczba hostów", ex.hosts.toLocaleString("pl-PL")]]),
      octs: (e) => netOcts(e, 0),
      ask: { q: "Ile hostów?", check: num(ex.hosts), answer: String(ex.hosts) },
    },
    {
      title: "Gotowe",
      text: boundary
        ? `Przy prefiksach /8, /16, /24 to samo kopiowanie. Najwięcej czasu oszczędzasz na pozostałych, więc wylosuj inny przykład.`
        : `Cała praca to jedno odejmowanie (256 − ${ex.maskOct}) i jedno szukanie wielokrotności. Po kilkunastu powtórkach robisz to w kilka sekund.`,
      draw: (st) => resultCard(st, [["Sieć", `${intToIp(ex.net)}/${ex.p}`], ["Broadcast", intToIp(ex.bc)], ["Hosty", `${intToIp(ex.first)} – ${intToIp(ex.last)}`], ["Liczba", ex.hosts.toLocaleString("pl-PL")]]),
      octs: (e) => netOcts(e, 0),
    },
  );
  return list;
}

export function initWalkthrough() {
  const root = $("#wt");
  root.innerHTML = `
    <div class="wt-head">
      <h2>Jak to policzyć: pokaz krok po kroku</h2>
      <div class="row">
        <button class="btn ghost sm" id="wtRand" type="button">Losowy przykład</button>
        <button class="btn ghost sm" id="wtFromCalc" type="button">Z kalkulatora</button>
      </div>
    </div>
    <div class="wt-dots" id="wtDots" role="tablist" aria-label="Kroki"></div>
    <div class="wt-octs" id="wtOcts"></div>
    <div class="wt-stage" id="wtStage" aria-live="polite"></div>
    <h3 class="wt-title" id="wtTitle"></h3>
    <p class="wt-text" id="wtText"></p>
    <div class="wt-ask" id="wtAsk"></div>
    <div class="wt-ctrl">
      <button class="btn ghost" id="wtPrev" type="button">Wstecz</button>
      <button class="btn ghost" id="wtPlay" type="button">Odtwarzaj</button>
      <button class="btn" id="wtNext" type="button">Dalej</button>
    </div>`;

  let ex = build(ipToInt("192.168.202.183")!, 28);
  let list = steps(ex);
  let i = 0;
  let solved = new Set<number>();
  let play: number | undefined;

  function drawOcts() {
    const { vals, cls } = list[i].octs(ex);
    $("#wtOcts").innerHTML = vals.map((v, n) =>
      `<div class="wt-oct ${cls[n]}"><small>${n + 1}. oktet</small><b>${v}</b></div>`).join('<span class="wt-dot">.</span>');
  }

  function drawAsk() {
    const a = list[i].ask;
    const box = $("#wtAsk");
    if (!a) { box.innerHTML = ""; return; }
    const done = solved.has(i);
    box.innerHTML = `<span class="wt-q">Twoja kolej: ${a.q}</span>
      <input type="text" id="wtIn" autocomplete="off" spellcheck="false" inputmode="decimal" aria-label="${a.q}" ${done ? `value="${a.answer}" class="ok" disabled` : ""}>
      <button class="btn sm" id="wtCheck" type="button" ${done ? "disabled" : ""}>Sprawdź</button>
      <button class="btn ghost sm" id="wtShow" type="button" ${done ? "disabled" : ""}>Pokaż</button>
      <span class="wt-msg" id="wtMsg">${done ? "Dobrze." : ""}</span>`;
    if (done) return;
    const inp = $<HTMLInputElement>("#wtIn");
    const check = () => {
      if (!inp.value.trim()) return;
      if (a.check(inp.value)) {
        solved.add(i); inp.className = "ok"; inp.disabled = true;
        $("#wtMsg").textContent = "Dobrze.";
        $<HTMLButtonElement>("#wtCheck").disabled = true; $<HTMLButtonElement>("#wtShow").disabled = true;
        gain(2);
      } else {
        inp.className = "bad";
        $("#wtMsg").textContent = "Jeszcze nie. Spróbuj ponownie albo kliknij Pokaż.";
      }
    };
    $("#wtCheck").addEventListener("click", check);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(); } });
    $("#wtShow").addEventListener("click", () => {
      inp.value = a.answer; inp.className = "ok"; inp.disabled = true;
      $("#wtMsg").textContent = "Odpowiedź odsłonięta.";
      $<HTMLButtonElement>("#wtCheck").disabled = true; $<HTMLButtonElement>("#wtShow").disabled = true;
    });
  }

  function go(n: number) {
    i = Math.max(0, Math.min(list.length - 1, n));
    runId++;
    $("#wtDots").innerHTML = list.map((s, n) =>
      `<button type="button" class="${n === i ? "on" : n < i ? "past" : ""}" data-n="${n}" title="${s.title}" aria-label="Krok ${n + 1}: ${s.title}"><span>${n + 1}</span></button>`).join("");
    $("#wtTitle").textContent = `${i + 1}. ${list[i].title}`;
    $("#wtText").innerHTML = list[i].text;
    drawOcts();
    list[i].draw($("#wtStage"), ex);
    drawAsk();
    $<HTMLButtonElement>("#wtPrev").disabled = i === 0;
    $("#wtNext").textContent = i === list.length - 1 ? "Od nowa" : "Dalej";
  }

  function setExample(ip: number, p: number) {
    stop();
    ex = build(ip, p); list = steps(ex); solved = new Set(); go(0);
  }

  function stop() { clearInterval(play); play = undefined; $("#wtPlay").textContent = "Odtwarzaj"; }

  $("#wtDots").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-n]");
    if (b) { stop(); go(Number(b.dataset.n)); }
  });
  $("#wtPrev").addEventListener("click", () => { stop(); go(i - 1); });
  $("#wtNext").addEventListener("click", () => { stop(); go(i === list.length - 1 ? 0 : i + 1); });
  $("#wtPlay").addEventListener("click", () => {
    if (play) { stop(); return; }
    if (i === list.length - 1) go(0);
    $("#wtPlay").textContent = "Pauza";
    play = window.setInterval(() => { if (i >= list.length - 1) stop(); else go(i + 1); }, 6000);
  });
  $("#wtRand").addEventListener("click", () => {
    let p = rnd(17, 30); if (p % 8 === 0) p++;
    const ip = ((rnd(1, 223) * 16777216) + rnd(0, 255) * 65536 + rnd(0, 255) * 256 + rnd(0, 255)) >>> 0;
    setExample(ip, p);
  });
  $("#wtFromCalc").addEventListener("click", () => {
    const ip = ipToInt($<HTMLInputElement>("#ipIn").value);
    if (ip === null) return;
    setExample(ip, Number($<HTMLInputElement>("#pfxIn").value));
  });
  root.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "ArrowRight") { stop(); go(i + 1); }
    if (e.key === "ArrowLeft") { stop(); go(i - 1); }
  });

  go(0);
}
