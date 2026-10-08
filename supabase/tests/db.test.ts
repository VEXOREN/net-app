import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "migrations");

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated;
`;

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
const EVE = "00000000-0000-0000-0000-00000000000e";

let db: PGlite;

async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  return (await db.query<T>(sql, params)).rows;
}

async function key(duel: string, idx: number) {
  const [r] = await admin<{ answer: string }>("select answer from duel_keys where duel_id = $1 and idx = $2", [duel, idx]);
  return r.answer;
}

async function startNow(duel: string) {
  await admin("update duels set started_at = now() - interval '1 second' where id = $1", [duel]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  await admin(`insert into auth.users (id, email, raw_user_meta_data) values
    ($1, 'alice@example.com', '{"full_name":"Alice"}'),
    ($2, 'bob@example.com', '{"user_name":"bob"}'),
    ($3, 'eve@example.com', null)`, [ALICE, BOB, EVE]);
});

describe("konta i postęp", () => {
  it("trigger tworzy profil i postęp", async () => {
    const rows = await admin<{ display_name: string }>("select display_name from profiles order by id");
    expect(rows.map((r) => r.display_name)).toEqual(["Alice", "bob", "eve"]);
  });

  it("użytkownik widzi tylko swój postęp", async () => {
    const rows = await as(ALICE, "select user_id from progress");
    expect(rows).toEqual([{ user_id: ALICE }]);
    expect(await as(null, "select 1 from progress").catch((e) => e.message)).toMatch(/permission denied/);
  });

  it("nie da się zapisać XP bezpośrednio", async () => {
    const err = await as(ALICE, "update progress set xp = 999999 where user_id = $1", [ALICE]).catch((e) => e.message);
    expect(err).toMatch(/permission denied/);
  });

  it("pierwszy sync importuje lokalny postęp, kolejne są limitowane czasem", async () => {
    const [first] = await as<{ xp: number }>(ALICE, "select xp from sync_progress(1500, '{}'::jsonb)");
    expect(first.xp).toBe(1500);
    const [second] = await as<{ xp: number }>(ALICE, "select xp from sync_progress(999999, '{}'::jsonb)");
    expect(second.xp).toBeLessThan(1520);
    const [lower] = await as<{ xp: number }>(ALICE, "select xp from sync_progress(10, '{}'::jsonb)");
    expect(lower.xp).toBe(second.xp);
  });

  it("odrzuca śmieciowe statystyki", async () => {
    const err = await as(ALICE, "select sync_progress(0, '[1,2]'::jsonb)").catch((e) => e.message);
    expect(err).toMatch(/invalid stats/);
  });

  it("anon nie może wołać RPC", async () => {
    const err = await as(null, "select sync_progress(1, '{}'::jsonb)").catch((e) => e.message);
    expect(err).toMatch(/permission denied/);
  });
});

describe("pojedynki", () => {
  let duel: string;

  it("tworzy pojedynek z 10 pytaniami i ukrytym kluczem", async () => {
    const [d] = await as<{ id: string; code: string; status: string }>(ALICE, "select id, code, status from create_duel()");
    duel = d.id;
    expect(d.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(d.status).toBe("waiting");
    expect(await as(ALICE, "select * from duel_keys").catch((e) => e.message)).toMatch(/permission denied/);
    expect(await as(ALICE, "select * from duel_questions where duel_id = $1", [duel])).toHaveLength(0);
  });

  it("host nie dołączy do siebie, obcy nie widzi pojedynku", async () => {
    const [{ code }] = await admin<{ code: string }>("select code from duels where id = $1", [duel]);
    expect(await as(ALICE, "select join_duel($1)", [code]).catch((e) => e.message)).toMatch(/własnego/);
    expect(await as(EVE, "select * from duels")).toHaveLength(0);
    await as(BOB, "select join_duel($1)", [code.toLowerCase()]);
    const [d] = await admin<{ status: string; guest: string }>("select status, guest from duels where id = $1", [duel]);
    expect(d).toEqual({ status: "active", guest: BOB });
  });

  it("pytania są niewidoczne przed startem odliczania", async () => {
    expect(await as(BOB, "select * from duel_questions where duel_id = $1", [duel])).toHaveLength(0);
    expect(await as(BOB, "select submit_answer($1, 0, 'x')", [duel]).catch((e) => e.message)).toMatch(/nie trwa/);
    await startNow(duel);
    expect(await as(BOB, "select * from duel_questions where duel_id = $1", [duel])).toHaveLength(10);
    expect(await as(EVE, "select * from duel_questions where duel_id = $1", [duel])).toHaveLength(0);
  });

  it("wymusza kolejność pytań i blokuje obcych", async () => {
    expect(await as(ALICE, "select submit_answer($1, 3, 'x')", [duel]).catch((e) => e.message)).toMatch(/numer pytania/);
    expect(await as(EVE, "select submit_answer($1, 0, 'x')", [duel]).catch((e) => e.message)).toMatch(/udziału/);
  });

  it("ocenia odpowiedzi, kończy pojedynek i przyznaje XP", async () => {
    const before = await admin<{ user_id: string; xp: number }>("select user_id, xp from progress where user_id in ($1, $2)", [ALICE, BOB]);
    for (let i = 0; i < 10; i++) {
      const k = await key(duel, i);
      const [a] = await as<{ ok: boolean }>(ALICE, "select submit_answer($1, $2, $3) as ok", [duel, i, ` ${k} `]);
      expect(a.ok).toBe(true);
      const [b] = await as<{ ok: boolean }>(BOB, "select submit_answer($1, $2, $3) as ok", [duel, i, i < 5 ? k : "nope"]);
      expect(b.ok).toBe(i < 5);
    }
    const [d] = await admin<{ status: string; winner: string; host_score: number; guest_score: number }>(
      "select status, winner, host_score, guest_score from duels where id = $1", [duel]);
    expect(d).toEqual({ status: "finished", winner: ALICE, host_score: 10, guest_score: 5 });
    const after = await admin<{ user_id: string; xp: number }>("select user_id, xp from progress where user_id in ($1, $2)", [ALICE, BOB]);
    const gained = (u: string) => after.find((r) => r.user_id === u)!.xp - before.find((r) => r.user_id === u)!.xp;
    expect(gained(ALICE)).toBe(50);
    expect(gained(BOB)).toBe(15);
  });

  it("przegląd pokazuje klucz tylko po zakończeniu i tylko uczestnikom", async () => {
    const rows = await as<{ answer: string; mine_ok: boolean }>(BOB, "select * from duel_review($1)", [duel]);
    expect(rows).toHaveLength(10);
    expect(rows.filter((r) => r.mine_ok)).toHaveLength(5);
    expect(await as(EVE, "select * from duel_review($1)", [duel]).catch((e) => e.message)).toMatch(/udziału/);
  });

  it("po czasie pojedynek kończy się sam", async () => {
    const [d] = await as<{ id: string; code: string }>(ALICE, "select id, code from create_duel()");
    await as(BOB, "select join_duel($1)", [d.code]);
    await admin("update duels set started_at = now() - interval '200 seconds' where id = $1", [d.id]);
    const [r] = await as<{ ok: boolean | null }>(BOB, "select submit_answer($1, 0, '1') as ok", [d.id]);
    expect(r.ok).toBeNull();
    const [s] = await admin<{ status: string }>("select status from duels where id = $1", [d.id]);
    expect(s.status).toBe("finished");
  });
});

describe("generator pytań", () => {
  it("klucz zawsze akceptuje sam siebie i odrzuca zły format", async () => {
    const rows = await admin<{ prompt: string; answer: string }>("select (q).* from (select _gen_question() q from generate_series(1, 300)) s");
    for (const r of rows) {
      const [{ ok }] = await admin<{ ok: boolean }>("select _check_answer($1, $2) as ok", [r.answer, r.answer]);
      expect(ok, r.prompt).toBe(true);
    }
    const [{ ok }] = await admin<{ ok: boolean }>("select _check_answer('10.0.0.0', '10.0.0.0/8') as ok");
    expect(ok).toBe(false);
  });
});
