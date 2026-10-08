import { describe, expect, it } from "vitest";
import { intToIp, ipToInt, magic, prefixForHosts, subnet } from "./ip";
import { generateTask, solve, validate } from "./vlsm";

const s = (ip: string, p: number) => {
  const r = subnet(ipToInt(ip)!, p);
  return { net: intToIp(r.net), bc: intToIp(r.bc), hosts: r.hosts };
};

describe("ip", () => {
  it("parsuje i odrzuca błędne adresy", () => {
    expect(ipToInt("192.168.1.1")).toBe(3232235777);
    expect(ipToInt("256.1.1.1")).toBeNull();
    expect(ipToInt("1.2.3")).toBeNull();
  });
  it("liczy przykłady z labu", () => {
    expect(s("192.168.202.183", 28)).toEqual({ net: "192.168.202.176", bc: "192.168.202.191", hosts: 14 });
    expect(s("192.168.202.172", 27)).toEqual({ net: "192.168.202.160", bc: "192.168.202.191", hosts: 30 });
    expect(s("10.1.37.5", 21)).toEqual({ net: "10.1.32.0", bc: "10.1.39.255", hosts: 2046 });
  });
  it("obsługuje /31 i /32", () => {
    expect(subnet(ipToInt("10.0.0.1")!, 31).hosts).toBe(2);
    expect(subnet(ipToInt("10.0.0.1")!, 32).hosts).toBe(1);
  });
  it("magiczna liczba", () => {
    expect(magic(27)).toEqual({ k: 4, bitsIn: 3, block: 32, maskOctet: 224 });
    expect(magic(20)?.block).toBe(16);
    expect(magic(24)).toBeNull();
  });
  it("prefiks dla liczby hostów", () => {
    expect(prefixForHosts(30)).toBe(27);
    expect(prefixForHosts(31)).toBe(26);
    expect(prefixForHosts(2)).toBe(30);
  });
});

describe("vlsm", () => {
  it("rozwiązanie wzorcowe zawsze przechodzi walidację", () => {
    for (let i = 0; i < 200; i++) {
      const t = generateTask(i % 2 ? 1 : 2);
      const sol = solve(t);
      const ans = t.reqs.map((r) => `${intToIp(sol.get(r.name)!)}/${r.p}`);
      expect(validate(t, ans).all).toBe(true);
    }
  });
  it("wyłapuje nakładanie i złe wyrównanie", () => {
    const t = { base: ipToInt("192.168.1.0")!, bp: 24, reqs: [
      { name: "A", hosts: 50, p: 26 }, { name: "B", hosts: 20, p: 27 } ] };
    expect(validate(t, ["192.168.1.0/26", "192.168.1.32/27"]).rows[1].msg).toMatch(/Nakłada/);
    expect(validate(t, ["192.168.1.0/26", "192.168.1.70/27"]).rows[1].msg).toMatch(/nie jest adresem sieci/);
  });
});
