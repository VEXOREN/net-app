import { intToIp, parseCidr, prefixForHosts, subnet } from "./ip";

export interface Requirement { name: string; hosts: number; p: number }
export interface Task { base: number; bp: number; reqs: Requirement[] }
export interface Placed { name: string; net: number; bc: number; p: number }
export interface RowResult { ok: boolean; msg: string }

const req = (name: string, hosts: number): Requirement => ({ name, hosts, p: prefixForHosts(hosts) });
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export function generateTask(level: 1 | 2): Task {
  for (let tries = 0; tries < 200; tries++) {
    let base: number, bp: number, reqs: Requirement[];
    if (level === 1) {
      base = (192 * 16777216 + 168 * 65536 + rnd(0, 255) * 256) >>> 0; bp = 24;
      reqs = [req("LAN Biuro", rnd(40, 110)), req("LAN Lab", rnd(20, 60)), req("LAN Serwery", rnd(5, 28)),
        req("LAN Druk", rnd(2, 12)), req("Łącze R1–R2", 2)];
      if (Math.random() < 0.5) reqs.push(req("Łącze R2–R3", 2));
    } else {
      base = (10 * 16777216 + rnd(0, 255) * 65536 + rnd(0, 63) * 4 * 256) >>> 0; bp = 22;
      reqs = [req("Akademik", rnd(250, 480)), req("Wydział", rnd(110, 240)), req("Biblioteka", rnd(40, 120)),
        req("Wi-Fi gości", rnd(20, 60)), req("DMZ", rnd(3, 14)), req("Łącze 1", 2), req("Łącze 2", 2)];
    }
    const total = reqs.reduce((s, r) => s + 2 ** (32 - r.p), 0);
    if (total <= 2 ** (32 - bp)) return { base, bp, reqs };
  }
  throw new Error("Nie udało się wygenerować zadania");
}

export function solve(task: Task): Map<string, number> {
  let cur = task.base;
  const out = new Map<string, number>();
  [...task.reqs].sort((a, b) => a.p - b.p).forEach((r) => {
    out.set(r.name, cur);
    cur = (cur + 2 ** (32 - r.p)) >>> 0;
  });
  return out;
}

export function validate(task: Task, answers: string[]): { rows: RowResult[]; placed: Placed[]; all: boolean } {
  const poolEnd = (task.base + 2 ** (32 - task.bp) - 1) >>> 0;
  const placed: Placed[] = [];
  const rows = task.reqs.map((r, i): RowResult => {
    const c = parseCidr(answers[i] ?? "");
    if (!c) return { ok: false, msg: "Format: adres/prefiks." };
    const s = subnet(c.ip, c.p);
    if (c.p > r.p) return { ok: false, msg: `/${c.p} ma za mało adresów. Potrzebujesz /${r.p}.` };
    if (c.p < r.p) return { ok: false, msg: `/${c.p} działa, ale marnuje adresy. Wystarczy /${r.p}.` };
    if (s.net !== c.ip) return { ok: false, msg: `${intToIp(c.ip)} nie jest adresem sieci dla /${c.p}. Najbliższy: ${intToIp(s.net)}.` };
    if (s.net < task.base || s.bc > poolEnd) return { ok: false, msg: "Poza pulą." };
    const clash = placed.find((g) => !(s.bc < g.net || s.net > g.bc));
    if (clash) return { ok: false, msg: `Nakłada się z: ${clash.name}.` };
    placed.push({ name: r.name, net: s.net, bc: s.bc, p: c.p });
    return { ok: true, msg: `OK: ${intToIp(s.first)} – ${intToIp(s.last)}, bc ${intToIp(s.bc)}` };
  });
  return { rows, placed: placed.sort((a, b) => a.net - b.net), all: rows.every((r) => r.ok) };
}
