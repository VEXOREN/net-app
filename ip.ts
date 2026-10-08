export interface Subnet {
  ip: number;
  p: number;
  mask: number;
  net: number;
  bc: number;
  first: number;
  last: number;
  hosts: number;
  size: number;
  wild: number;
}

export function ipToInt(s: string): number | null {
  const parts = String(s).trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const x of parts) {
    if (!/^\d{1,3}$/.test(x)) return null;
    const v = Number(x);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function intToIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function maskFromPrefix(p: number): number {
  return p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
}

export function octet(n: number, i: number): number {
  return (n >>> (24 - 8 * i)) & 255;
}

export function subnet(ip: number, p: number): Subnet {
  const mask = maskFromPrefix(p);
  const net = (ip & mask) >>> 0;
  const wild = ~mask >>> 0;
  const bc = (net | wild) >>> 0;
  const size = 2 ** (32 - p);
  let first: number, last: number, hosts: number;
  if (p === 32) { first = last = net; hosts = 1; }
  else if (p === 31) { first = net; last = bc; hosts = 2; }
  else { first = net + 1; last = bc - 1; hosts = size - 2; }
  return { ip, p, mask, net, bc, first, last, hosts, size, wild };
}

export function magic(p: number): { k: number; bitsIn: number; block: number; maskOctet: number } | null {
  if (p % 8 === 0) return null;
  const k = Math.ceil(p / 8);
  const bitsIn = p - 8 * (k - 1);
  const block = 2 ** (8 - bitsIn);
  return { k, bitsIn, block, maskOctet: 256 - block };
}

export function prefixForHosts(h: number): number {
  return 32 - Math.ceil(Math.log2(h + 2));
}

export function parseCidr(s: string): { ip: number; p: number } | null {
  const m = s.trim().match(/^(.+)\/(\d{1,2})$/);
  if (!m) return null;
  const ip = ipToInt(m[1]);
  const p = Number(m[2]);
  if (ip === null || p > 32) return null;
  return { ip, p };
}
