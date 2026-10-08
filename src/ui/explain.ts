import { intToIp, magic, octet, subnet } from "../lib/ip";
import { fmt } from "../lib/dom";

export function stepsHtml(ip: number, p: number): string {
  const r = subnet(ip, p);
  const mg = magic(p);
  if (!mg) {
    const k = p / 8;
    return `<ol><li>/${p} kończy się na granicy oktetu: ${k} oktet(y) sieci, reszta hosta.</li>
<li>Sieć: kopiujesz ${k} oktet(y), resztę zerujesz → <b class="mono">${intToIp(r.net)}</b>.</li>
<li>Broadcast: resztę ustawiasz na 255 → <b class="mono">${intToIp(r.bc)}</b>.</li>
<li>Hosty: 2<sup>${32 - p}</sup>${p < 31 ? " − 2" : ""} = ${fmt(r.hosts)}.</li></ol>`;
  }
  const { k, bitsIn, block, maskOctet } = mg;
  const v = octet(ip, k - 1);
  const no = Math.floor(v / block) * block;
  const mult: number[] = [];
  for (let x = 0; x <= Math.min(255, no + block); x += block) mult.push(x);
  const shown = mult.length > 7 ? ["…", ...mult.slice(-4)] : mult;
  const tail = k < 4;
  return `<ol>
<li>/${p} = ${8 * (k - 1)} + ${bitsIn} → ciekawy jest <b>${k}. oktet</b> (wartość ${v}).</li>
<li>${bitsIn} bit(y) sieci w oktecie → maska ${maskOctet}, blok = 256 − ${maskOctet} = <b>${block}</b>.</li>
<li>Wielokrotności ${block}: ${shown.join(", ")}. Ostatnia ≤ ${v} to <b>${no}</b>.</li>
<li>Sieć: ${no}${tail ? ", dalej zera" : ""} → <b class="mono">${intToIp(r.net)}</b>.</li>
<li>Broadcast: ${no} + ${block} − 1 = ${no + block - 1}${tail ? ", dalej 255" : ""} → <b class="mono">${intToIp(r.bc)}</b>.</li>
${p < 31
    ? `<li>Hosty: <span class="mono">${intToIp(r.first)}</span> – <span class="mono">${intToIp(r.last)}</span>, razem 2<sup>${32 - p}</sup> − 2 = ${fmt(r.hosts)}.</li>`
    : `<li>/${p}: specjalny przypadek (łącze punkt-punkt / pojedynczy host).</li>`}
</ol>`;
}

export function blockMapHtml(ip: number, p: number): string {
  const mg = magic(p);
  if (!mg) return `<div class="bmap-head"><span>Prefiks na granicy oktetu, nie ma czego dzielić.</span></div>`;
  const { k, block } = mg;
  const count = 256 / block;
  const cur = Math.floor(octet(ip, k - 1) / block);
  const head = `<div class="bmap-head"><span>${k}. oktet: 256 / ${block} = <b style="color:var(--ink)">${count}</b> podsieci</span>` +
    `<span>Twoja: <b style="color:var(--amber)" class="mono">${cur * block}–${cur * block + block - 1}</b></span></div>`;
  if (count > 64) return head + `<div class="note">Bloki po ${block} są za drobne do narysowania (${count} sztuk).</div>`;
  const cols = Math.min(count, 16);
  let cells = "";
  for (let i = 0; i < count; i++) {
    const s = i * block;
    const label = count <= 32 || i === cur ? String(s) : "";
    cells += `<div class="blk${i === cur ? " cur" : ""}" title="${s}–${s + block - 1}">${label}</div>`;
  }
  return head + `<div class="bmap-grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>`;
}
