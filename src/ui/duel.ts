import type { RealtimeChannel } from "@supabase/supabase-js";
import { $, pulse } from "../lib/dom";
import { load, save } from "../lib/store";
import { KEY, toast } from "../lib/progress";
import { errorText, esc, sb, type Duel, type DuelAnswer, type Profile } from "../lib/supabase";
import { auth, onAuth, syncNow } from "../lib/sync";
import { avatar, openLogin } from "./account";

interface Question { idx: number; prompt: string }
interface Review { idx: number; prompt: string; answer: string; mine: string | null; mine_ok: boolean | null }

const STORE = KEY + "duel";

let duel: Duel | null = null;
let channel: RealtimeChannel | null = null;
let poll: number | undefined;
let tick: number | undefined;
let offset = 0;
let questions: Question[] = [];
let answers: DuelAnswer[] = [];
let players: Record<string, Profile> = {};
let busy = false;
let shownResult = false;

const root = () => $("#duelRoot");
const now = () => Date.now() + offset;
const me = () => auth.user?.id ?? "";
const opp = () => (duel ? (duel.host === me() ? duel.guest : duel.host) : null);
const nameOf = (id: string | null) => (id && players[id]?.display_name) || "Przeciwnik";

function stopAll() {
  clearInterval(poll);
  clearInterval(tick);
  poll = tick = undefined;
  if (channel && sb) void sb.removeChannel(channel);
  channel = null;
}

function reset(keepStore = false) {
  stopAll();
  duel = null;
  questions = [];
  answers = [];
  players = {};
  shownResult = false;
  if (!keepStore) save(STORE, null);
}

async function syncClock() {
  if (!sb) return;
  const t0 = Date.now();
  const { data } = await sb.rpc("server_time");
  if (data) offset = Date.parse(data as string) - (t0 + Date.now()) / 2;
}

async function loadPlayers() {
  if (!sb || !duel) return;
  const ids = [duel.host, duel.guest].filter(Boolean) as string[];
  const { data } = await sb.from("profiles").select("id, display_name, avatar_url").in("id", ids);
  for (const p of (data ?? []) as Profile[]) players[p.id] = p;
}

async function refresh() {
  if (!sb || !duel) return;
  const [{ data: d }, { data: a }] = await Promise.all([
    sb.from("duels").select("*").eq("id", duel.id).maybeSingle(),
    sb.from("duel_answers").select("*").eq("duel_id", duel.id),
  ]);
  if (a) answers = a as DuelAnswer[];
  if (d) onDuel(d as Duel);
  drawBars();
}

function subscribe() {
  if (!sb || !duel) return;
  const id = duel.id;
  channel = sb.channel("duel:" + id)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duels", filter: `id=eq.${id}` },
      (p) => onDuel(p.new as Duel))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "duel_answers", filter: `duel_id=eq.${id}` },
      (p) => {
        const a = p.new as DuelAnswer;
        if (!answers.some((x) => x.user_id === a.user_id && x.idx === a.idx)) answers.push(a);
        drawBars();
      })
    .subscribe();
  poll = window.setInterval(() => void refresh(), 2500);
}

function onDuel(d: Duel) {
  const prev = duel?.status;
  duel = d;
  if (d.status === "cancelled") {
    toast("Pojedynek anulowany");
    reset();
    renderLobby();
  } else if (d.status === "active" && prev === "waiting") {
    void startPlay();
  } else if (d.status === "finished" && !shownResult) {
    void showResult();
  }
}

function renderOff() {
  root().innerHTML = `<p>Pojedynki potrzebują backendu. Ta wersja aplikacji działa bez niego, reszta zakładek jest w pełni dostępna.</p>`;
}

function renderAnon() {
  root().innerHTML = `
    <p>Zmierz się z ziomkiem: ten sam zestaw 10 pytań, liczy się liczba trafień, a przy remisie czas. Odpowiedzi sprawdza serwer, więc nie da się podejrzeć klucza.</p>
    <button class="btn" type="button" id="duelLogin">Zaloguj się, żeby grać</button>`;
  $("#duelLogin").addEventListener("click", openLogin);
}

function renderLobby() {
  root().innerHTML = `
    <p>Ten sam zestaw 10 pytań dla obu graczy, 3 minuty. Wygrywa więcej trafień, przy remisie szybszy. Za trafienie +3 XP, za wygraną +20 XP.</p>
    <div class="duel-lobby">
      <div class="duel-box">
        <h3>Nowy pojedynek</h3>
        <p class="note">Dostaniesz kod do przekazania przeciwnikowi.</p>
        <button class="btn" type="button" id="duelCreate">Utwórz</button>
      </div>
      <div class="duel-box">
        <h3>Mam kod</h3>
        <div class="row">
          <input type="text" id="duelCode" maxlength="6" autocomplete="off" spellcheck="false" placeholder="ABC123" aria-label="Kod pojedynku" style="text-transform:uppercase;width:150px">
          <button class="btn" type="button" id="duelJoin">Dołącz</button>
        </div>
      </div>
    </div>
    <div class="fb" id="duelFb"></div>`;
  $("#duelCreate").addEventListener("click", () => void create());
  $("#duelJoin").addEventListener("click", () => void join());
  $("#duelCode").addEventListener("keydown", (e) => { if (e.key === "Enter") void join(); });
}

function fail(e: unknown) {
  const fb = document.querySelector<HTMLElement>("#duelFb");
  if (fb) { fb.className = "fb show bad"; fb.textContent = errorText(e); }
  else toast(errorText(e));
}

async function create() {
  if (!sb || busy) return;
  busy = true;
  const { data, error } = await sb.rpc("create_duel");
  busy = false;
  if (error) return fail(error);
  duel = data as Duel;
  save(STORE, duel.id);
  renderWaiting();
  subscribe();
}

async function join() {
  if (!sb || busy) return;
  const code = $<HTMLInputElement>("#duelCode").value.trim();
  if (code.length !== 6) return fail({ message: "Kod ma 6 znaków." });
  busy = true;
  const { data, error } = await sb.rpc("join_duel", { p_code: code });
  busy = false;
  if (error) return fail(error);
  duel = data as Duel;
  save(STORE, duel.id);
  subscribe();
  void startPlay();
}

function renderWaiting() {
  if (!duel) return;
  root().innerHTML = `
    <p>Podaj ten kod przeciwnikowi:</p>
    <div class="duel-code" id="duelCodeBig">${esc(duel.code)}</div>
    <p class="note"><span class="dot on"></span>Czekam na drugiego gracza…</p>
    <div class="row">
      <button class="btn ghost" type="button" id="duelCopy">Kopiuj kod</button>
      <button class="btn ghost" type="button" id="duelCancel">Anuluj</button>
    </div>`;
  $("#duelCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(duel!.code); toast("Skopiowano"); } catch { toast(duel!.code); }
  });
  $("#duelCancel").addEventListener("click", async () => {
    if (sb && duel) await sb.rpc("cancel_duel", { p_duel: duel.id });
    reset();
    renderLobby();
  });
}

function drawBars() {
  const box = document.querySelector<HTMLElement>("#duelBars");
  if (!box || !duel) return;
  const row = (id: string | null, label: string) => {
    const mine = answers.filter((a) => a.user_id === id);
    const ok = mine.filter((a) => a.correct).length;
    const cells = Array.from({ length: duel!.n_questions }, (_, i) => {
      const a = mine.find((x) => x.idx === i);
      return `<i class="${a ? (a.correct ? "ok" : "bad") : ""}"></i>`;
    }).join("");
    const p = id ? players[id] : undefined;
    return `<div class="duel-bar">${avatar(p?.avatar_url, label, 20)}<span class="nm">${esc(label)}</span><div class="cells">${cells}</div><b>${ok}</b></div>`;
  };
  box.innerHTML = row(me(), "Ty") + row(opp(), nameOf(opp()));
}

async function startPlay() {
  if (!duel || !sb) return;
  await Promise.all([syncClock(), loadPlayers()]);
  const { data } = await sb.from("duel_answers").select("*").eq("duel_id", duel.id);
  answers = (data ?? []) as DuelAnswer[];
  root().innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:baseline">
      <span class="note">vs <b style="color:var(--ink)">${esc(nameOf(opp()))}</b></span>
      <span class="timer" id="duelClock"></span>
    </div>
    <div id="duelBars"></div>
    <div id="duelStage"></div>`;
  drawBars();
  const start = Date.parse(duel.started_at!);
  const stage = $("#duelStage");
  clearInterval(tick);
  tick = window.setInterval(() => {
    if (!duel) return;
    const left = start - now();
    if (left > 0) {
      stage.innerHTML = `<div class="duel-count">${Math.ceil(left / 1000)}</div>`;
      $("#duelClock").textContent = "";
      return;
    }
    const remain = Math.max(0, start + duel.time_limit_s * 1000 - now());
    $("#duelClock").textContent = `${Math.floor(remain / 60000)}:${String(Math.floor((remain % 60000) / 1000)).padStart(2, "0")}`;
    if (!questions.length && !busy) void loadQuestions();
    if (remain === 0 && sb && duel.status === "active" && !busy) {
      busy = true;
      void sb.rpc("finish_duel", { p_duel: duel.id }).then(({ data }) => { busy = false; if (data) onDuel(data as Duel); });
    }
  }, 200);
}

async function loadQuestions() {
  if (!sb || !duel) return;
  busy = true;
  const { data } = await sb.from("duel_questions").select("idx, prompt").eq("duel_id", duel.id).order("idx");
  busy = false;
  if (!data?.length) return;
  questions = data as Question[];
  showQuestion();
}

function myNext() {
  return answers.filter((a) => a.user_id === me()).length;
}

function showQuestion() {
  const stage = document.querySelector<HTMLElement>("#duelStage");
  if (!stage || !duel) return;
  const i = myNext();
  if (i >= questions.length) {
    stage.innerHTML = `<p class="note"><span class="dot on"></span>Wszystko wysłane. Czekam na ${esc(nameOf(opp()))}…</p>`;
    return;
  }
  stage.innerHTML = `
    <p class="note">Pytanie ${i + 1} z ${questions.length}</p>
    <div class="task" style="font-size:clamp(18px,4vw,24px)">${esc(questions[i].prompt)}</div>
    <div class="row">
      <input type="text" id="duelA" autocomplete="off" spellcheck="false" style="flex:1;min-width:160px;width:auto" aria-label="Odpowiedź">
      <button class="btn" type="button" id="duelSend">Wyślij</button>
    </div>`;
  const input = $<HTMLInputElement>("#duelA");
  input.focus();
  const send = () => void submit(i, input.value);
  $("#duelSend").addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } });
}

async function submit(i: number, value: string) {
  if (!sb || !duel || busy || !value.trim()) return;
  busy = true;
  const { data, error } = await sb.rpc("submit_answer", { p_duel: duel.id, p_idx: i, p_answer: value });
  busy = false;
  if (error) { toast(errorText(error)); await refresh(); showQuestion(); return; }
  if (data === null) { await refresh(); return; }
  if (!answers.some((a) => a.user_id === me() && a.idx === i)) {
    answers.push({ duel_id: duel.id, idx: i, user_id: me(), correct: !!data, ms: 0 });
  }
  pulse($("#duelCard"), !!data);
  drawBars();
  showQuestion();
}

async function showResult() {
  if (!sb || !duel) return;
  shownResult = true;
  stopAll();
  save(STORE, null);
  await loadPlayers();
  const { data } = await sb.rpc("duel_review", { p_duel: duel.id });
  const review = (data ?? []) as Review[];
  const iAmHost = duel.host === me();
  const mine = (iAmHost ? duel.host_score : duel.guest_score) ?? 0;
  const theirs = (iAmHost ? duel.guest_score : duel.host_score) ?? 0;
  const verdict = duel.winner === null ? "Remis" : duel.winner === me() ? "Wygrana" : "Przegrana";
  const cls = duel.winner === null ? "" : duel.winner === me() ? "win" : "lose";
  root().innerHTML = `
    <div class="duel-result ${cls}">
      <div class="verdict">${verdict}</div>
      <div class="score"><span>Ty <b>${mine}</b></span><span class="vs">:</span><span><b>${theirs}</b> ${esc(nameOf(opp()))}</span></div>
    </div>
    <div class="tbl"><table>
      <thead><tr><th>#</th><th>Pytanie</th><th>Odpowiedź</th><th>Twoja</th></tr></thead>
      <tbody>${review.map((r) => `<tr><td>${r.idx + 1}</td><td style="font-family:var(--sans)">${esc(r.prompt)}</td><td>${esc(r.answer)}</td>` +
        `<td style="color:var(${r.mine_ok ? "--ok" : "--bad"})">${esc(r.mine ?? "–")}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="row" style="margin-top:14px"><button class="btn" type="button" id="duelAgain">Nowy pojedynek</button></div>`;
  $("#duelAgain").addEventListener("click", () => { reset(); renderLobby(); });
  await syncNow(true);
}

async function resume() {
  const id = load<string | null>(STORE, null);
  if (!sb || !id) return false;
  const { data } = await sb.from("duels").select("*").eq("id", id).maybeSingle();
  const d = data as Duel | null;
  if (!d || d.status === "cancelled") { save(STORE, null); return false; }
  duel = d;
  subscribe();
  if (d.status === "waiting") renderWaiting();
  else if (d.status === "active") void startPlay();
  else void showResult();
  return true;
}

export function initDuel() {
  if (!sb) { renderOff(); return; }
  let last: string | null = "init";
  onAuth(() => {
    const id = auth.user?.id ?? null;
    if (id === last) return;
    last = id;
    reset(true);
    if (!id) { renderAnon(); return; }
    void resume().then((ok) => { if (!ok) renderLobby(); });
  });
}
