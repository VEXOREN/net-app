import { $, $$, fmt, reducedMotion } from "../lib/dom";
import { intToIp, ipToInt, maskFromPrefix, octet, subnet } from "../lib/ip";
import { blockMapHtml, stepsHtml } from "./explain";

const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1].map((w) => `<span>${w}</span>`).join("");

export function initHero() {
  const ipIn = $<HTMLInputElement>("#ipIn");
  const pfxIn = $<HTMLInputElement>("#pfxIn");

  function render() {
    const ip = ipToInt(ipIn.value);
    const p = Number(pfxIn.value);
    $("#pfxOut").textContent = "/" + p;
    ipIn.classList.toggle("bad", ip === null);
    if (ip === null) {
      $("#results").innerHTML = "";
      $("#bmap").innerHTML = "";
      $("#steps").innerHTML = "<p>Wpisz poprawny adres, np. 10.20.30.40.</p>";
      return;
    }
    const hot = p % 8 === 0 ? -1 : Math.ceil(p / 8) - 1;
    const mask = maskFromPrefix(p);
    let html = "";
    for (let o = 0; o < 4; o++) {
      const v = octet(ip, o);
      let bits = "";
      for (let b = 0; b < 8; b++) bits += `<span class="bit ${o * 8 + b < p ? "n" : "h"}">${(v >> (7 - b)) & 1}</span>`;
      html += `<div class="oct ${o === hot ? "hot" : ""}"><div class="weights">${WEIGHTS}</div><div class="bits">${bits}</div>` +
        `<div class="oct-val"><span>maska ${octet(mask, o)}</span><b>${v}</b></div></div>`;
    }
    $("#ruler").innerHTML = html;
    $("#bmap").innerHTML = blockMapHtml(ip, p);
    const r = subnet(ip, p);
    const cell = (l: string, v: string) => `<div class="res"><span>${l}</span><b>${v}</b></div>`;
    $("#results").innerHTML =
      cell("Sieć", `${intToIp(r.net)}/${p}`) + cell("Broadcast", intToIp(r.bc)) +
      cell("Liczba hostów", fmt(r.hosts)) + cell("Maska", intToIp(r.mask)) + cell("Wildcard", intToIp(r.wild)) +
      cell("Zakres hostów", `${intToIp(r.first)} – ${intToIp(r.last)}`);
    $("#steps").innerHTML = stepsHtml(ip, p);
    try { localStorage.setItem("pt-hero", JSON.stringify({ ip: ipIn.value, p })); } catch {}
  }

  try {
    const last = JSON.parse(localStorage.getItem("pt-hero") || "null");
    if (last) { ipIn.value = last.ip; pfxIn.value = String(last.p); }
  } catch {}

  ipIn.addEventListener("input", render);
  pfxIn.addEventListener("input", render);
  render();

  if (!reducedMotion()) {
    const bits = $$("#ruler .bit");
    const keep = bits.map((b) => b.textContent);
    let f = 0;
    const id = setInterval(() => {
      f++;
      bits.forEach((b, i) => (b.textContent = f >= 14 ? keep[i] : Math.random() < 0.5 ? "0" : "1"));
      if (f >= 14) clearInterval(id);
    }, 45);
  }
}
