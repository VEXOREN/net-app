import type { User } from "@supabase/supabase-js";
import { sb, type Profile } from "./supabase";
import { getXp, onProgress, replaceStats, setXp, stats, totalAttempts } from "./progress";

export const auth = { user: null as User | null, profile: null as Profile | null };
export const isGuest = () => !!auth.user?.is_anonymous;

const listeners: (() => void)[] = [];
export const onAuth = (cb: () => void) => { listeners.push(cb); cb(); };
const emit = () => listeners.forEach((cb) => cb());

let timer: number | undefined;
let inFlight: Promise<void> | null = null;

export function syncNow(announce = false): Promise<void> {
  if (!sb || !auth.user) return Promise.resolve();
  if (inFlight) return inFlight;
  const client = sb;
  inFlight = (async () => {
    const { data, error } = await client.rpc("sync_progress", { p_xp: getXp(), p_stats: stats });
    if (error || !data) return;
    const row = data as { xp: number; stats: Parameters<typeof replaceStats>[0] };
    if (row.xp !== getXp()) setXp(row.xp, announce);
    if (totalAttempts(row.stats) > totalAttempts(stats)) replaceStats(row.stats);
  })().finally(() => { inFlight = null; });
  return inFlight;
}

function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), 3000);
}

async function loadProfile() {
  if (!sb || !auth.user) { auth.profile = null; return; }
  const { data } = await sb.from("profiles").select("id, display_name, avatar_url").eq("id", auth.user.id).maybeSingle();
  auth.profile = (data as Profile | null) ?? null;
}

export function initSync() {
  if (!sb) return;
  sb.auth.onAuthStateChange((_event, session) => {
    const prev = auth.user?.id;
    auth.user = session?.user ?? null;
    if (auth.user?.id === prev) return;
    setTimeout(async () => {
      await loadProfile();
      emit();
      if (auth.user) void syncNow(true);
    });
  });
  void sb.auth.getSession().then(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("code") || params.has("error")) {
      history.replaceState(null, "", location.pathname + location.hash);
    }
  });
  onProgress(schedule);
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void syncNow(); });
}

export async function signIn(provider: "github" | "google") {
  if (!sb) return;
  await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + import.meta.env.BASE_URL } });
}

export function cleanNick(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
}

export async function signInGuest(nick: string): Promise<string | null> {
  if (!sb) return "Brak połączenia z serwerem.";
  const name = cleanNick(nick);
  if (name.length < 2) return "Nick musi mieć co najmniej 2 znaki.";
  const { error } = await sb.auth.signInAnonymously({ options: { data: { name } } });
  if (!error) return null;
  if (/anonymous/i.test(error.message)) return "Gra bez logowania jest chwilowo wyłączona. Zaloguj się przez GitHub lub Google.";
  if (/rate|too many/i.test(error.message)) return "Za dużo prób z tej sieci. Spróbuj za chwilę albo zaloguj się.";
  return error.message;
}

export async function signOut() {
  if (!sb) return;
  await syncNow();
  await sb.auth.signOut();
}
