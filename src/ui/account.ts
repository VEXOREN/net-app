import { $ } from "../lib/dom";
import { getXp } from "../lib/progress";
import { esc, sb } from "../lib/supabase";
import { auth, onAuth, signIn, signOut } from "../lib/sync";

const GITHUB = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;
const GOOGLE = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z"/></svg>`;

function avatar(url: string | null | undefined, name: string, size = 22) {
  const safe = url && /^https:\/\//.test(url) ? esc(url) : "";
  return safe
    ? `<img class="ava" src="${safe}" alt="" width="${size}" height="${size}" referrerpolicy="no-referrer">`
    : `<span class="ava ava-txt" style="width:${size}px;height:${size}px">${esc(name.slice(0, 1).toUpperCase())}</span>`;
}
export { avatar };

export function openLogin() {
  const dlg = $<HTMLDialogElement>("#authDlg");
  render();
  dlg.showModal();
}

function render() {
  const body = $("#authBody");
  if (!auth.user) {
    body.innerHTML = `
      <h2>Zaloguj się</h2>
      <p class="note">Postęp zsynchronizuje się między urządzeniami, a w zakładce Pojedynek zagrasz z ziomkami na czas. Bez konta wszystko inne działa jak dotąd.</p>
      <div class="auth-btns">
        <button class="oauth" type="button" data-p="github">${GITHUB}<span>Kontynuuj z GitHub</span></button>
        <button class="oauth" type="button" data-p="google">${GOOGLE}<span>Kontynuuj z Google</span></button>
      </div>`;
    body.querySelectorAll<HTMLButtonElement>(".oauth").forEach((b) =>
      b.addEventListener("click", () => {
        b.disabled = true;
        void signIn(b.dataset.p as "github" | "google");
      }));
  } else {
    const name = auth.profile?.display_name ?? auth.user.email ?? "Gracz";
    body.innerHTML = `
      <h2>Konto</h2>
      <div class="acct">${avatar(auth.profile?.avatar_url, name, 44)}<div><b>${esc(name)}</b><br><span class="note">${esc(auth.user.email ?? "")}</span></div></div>
      <p class="note">${getXp()} XP, zsynchronizowane z chmurą.</p>
      <div class="row"><button class="btn ghost" type="button" id="logoutBtn">Wyloguj</button></div>`;
    $("#logoutBtn").addEventListener("click", async () => {
      await signOut();
      $<HTMLDialogElement>("#authDlg").close();
    });
  }
}

export function initAccount() {
  const btn = $<HTMLButtonElement>("#authBtn");
  if (!sb) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.addEventListener("click", openLogin);
  $("#authClose").addEventListener("click", () => $<HTMLDialogElement>("#authDlg").close());
  $<HTMLDialogElement>("#authDlg").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close();
  });
  onAuth(() => {
    if (auth.user) {
      const name = auth.profile?.display_name ?? "Konto";
      btn.innerHTML = `${avatar(auth.profile?.avatar_url, name, 18)}<span>${esc(name)}</span>`;
    } else {
      btn.textContent = "Zaloguj";
    }
    if ($<HTMLDialogElement>("#authDlg").open) render();
  });
}
