export function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Brak elementu ${sel}`);
  return el;
}
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  Array.from(document.querySelectorAll<T>(sel));
export const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const fmt = (n: number) => n.toLocaleString("pl-PL");
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function pulse(el: HTMLElement, ok: boolean) {
  el.classList.remove("flash-ok", "flash-bad");
  void el.offsetWidth;
  el.classList.add(ok ? "flash-ok" : "flash-bad");
}
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function segmented(sel: string, cb: (level: number) => void) {
  const buttons = $$<HTMLButtonElement>(`${sel} button`);
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      cb(Number(b.dataset.l));
    })
  );
}
