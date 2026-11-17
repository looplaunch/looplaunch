import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanFirstName, isBlockedName } from "../names";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemoryStore, joinWaitlist, supabaseStore, type WaitlistStore } from "../board";

const DETAILS = { role: "Founder", brandLink: "brand.com", brandPlatform: "website" as const };

const join = (store: WaitlistStore, email: string, firstName: string, timeMs: number | null) =>
  joinWaitlist(store, { email, firstName, timeMs, source: null, userAgent: null, details: DETAILS });

describe("waitlist leaderboard", () => {
  test("fastest first, equal times in the order they were set", async () => {
    const store = createMemoryStore();
    const riya = await join(store, "riya@x.com", "Riya", 2400);
    assert.equal(riya.rank, 1);
    assert.equal(riya.improved, true);
    assert.equal(riya.alreadyJoined, false);

    const sam = await join(store, "sam@x.com", "Sam", 2080);
    assert.equal(sam.rank, 1);
    await new Promise((r) => setTimeout(r, 5));
    const priya = await join(store, "priya@x.com", "Priya", 2080);
    assert.equal(priya.rank, 2, "a tie ranks behind whoever set it first");

    const skipped = await join(store, "skip@x.com", "Skip", null);
    assert.equal(skipped.rank, null);
    assert.equal(skipped.bestMs, null);

    assert.deepEqual(
      priya.board.top.map((e) => [e.name, e.timeMs]),
      [["Sam", 2080], ["Priya", 2080], ["Riya", 2400]]
    );
    assert.deepEqual(skipped.board.counts, [[2080, 2], [2400, 1]]);
    assert.equal(skipped.board.total, 3, "people who skipped aren't on the board");
  });

  test("one go per person: only the first time is ever saved", async () => {
    const store = createMemoryStore();
    await join(store, "a@x.com", "Asha", 2560);
    await join(store, "b@x.com", "Ben", 2240);

    const slower = await join(store, "a@x.com", "Asha", 3040);
    assert.equal(slower.alreadyJoined, true);
    assert.equal(slower.improved, false);
    assert.equal(slower.bestMs, 2560);
    assert.equal(slower.rank, 2);

    const faster = await join(store, "a@x.com", "Asha", 1920);
    assert.equal(faster.improved, false, "a second run never replaces the first, even when faster");
    assert.equal(faster.bestMs, 2560);
    assert.equal(faster.rank, 2);
    assert.equal(faster.board.total, 2);

    const later = await join(store, "a@x.com", "Asha", null);
    assert.equal(later.bestMs, 2560, "joining again without playing keeps the time");
  });

  test("someone who joined without playing can still post their one time", async () => {
    const store = createMemoryStore();
    await join(store, "skip@x.com", "Sara", null);
    const first = await join(store, "skip@x.com", "Sara", 2400);
    assert.equal(first.improved, true);
    assert.equal(first.bestMs, 2400);
    const second = await join(store, "skip@x.com", "Sara", 2000);
    assert.equal(second.bestMs, 2400);
  });

  test("the first name someone joined with stays theirs", async () => {
    const store = createMemoryStore();
    await join(store, "owner@x.com", "Meera", 2400);
    const stranger = await join(store, "owner@x.com", "Prankster", 2080);
    assert.equal(stranger.firstName, "Meera");
    assert.deepEqual(stranger.board.top.map((e) => e.name), ["Meera"]);
  });

  test("someone from before the game gets their name with their first run", async () => {
    const rows = new Map();
    const store = createMemoryStore(rows);
    // A row from the email-only waitlist
    rows.set("early@x.com", {
      id: "early",
      email: "early@x.com",
      first_name: null,
      best_time_ms: null,
      best_time_at: null,
      consented_at: null,
      source: null,
      user_agent: null,
    });
    const result = await join(store, "early@x.com", "Kabir", 2720);
    assert.equal(result.alreadyJoined, true);
    assert.equal(result.firstName, "Kabir");
    assert.equal(result.improved, true);
    assert.equal(result.rank, 1);
  });

  test("the industry picked is saved, filled in later only when there was none", async () => {
    const rows = new Map();
    const store = createMemoryStore(rows);
    const base = { firstName: "Isha", timeMs: null, source: null, userAgent: null, details: DETAILS };
    await joinWaitlist(store, { ...base, email: "isha@x.com", industry: "Fashion" });
    assert.equal(rows.get("isha@x.com").industry, "Fashion");

    await joinWaitlist(store, { ...base, email: "isha@x.com", industry: "Food & Beverage" });
    assert.equal(rows.get("isha@x.com").industry, "Fashion", "someone who knows an email can't change it");

    await joinWaitlist(store, { ...base, email: "none@x.com" });
    assert.equal(rows.get("none@x.com").industry, null);
    await joinWaitlist(store, { ...base, email: "none@x.com", industry: "Beauty & Personal Care" });
    assert.equal(rows.get("none@x.com").industry, "Beauty & Personal Care");
  });
});

describe("first names on the board", () => {
  test("first word, letters only, one capital when typed all one case", () => {
    assert.equal(cleanFirstName("  rhythm sarma "), "Rhythm");
    assert.equal(cleanFirstName("RHYTHM"), "Rhythm");
    assert.equal(cleanFirstName("DeShawn"), "DeShawn");
    assert.equal(cleanFirstName("o'neil"), "O'neil");
    assert.equal(cleanFirstName("Anne-Marie"), "Anne-Marie");
    assert.equal(cleanFirstName("José"), "José");
    assert.equal(cleanFirstName("राहुल"), "राहुल");
    assert.equal(cleanFirstName("<script>alert(1)</script>"), "Scriptalert1script");
    assert.equal(cleanFirstName("🙂🙂"), "");
    assert.equal(cleanFirstName(42), "");
    assert.equal(cleanFirstName("Bartholomew-Alexander-Smith").length, 20);
  });

  test("abuse is refused, real names that look close are not", () => {
    for (const bad of ["Fuckface", "shit", "NAZI", "Bitchy"]) assert.ok(isBlockedName(bad), bad);
    for (const ok of ["Shital", "Nazia", "Nazir", "Anal", "Dick", "Dickson", "Ashita", "Pornchai", "Cassandra", "Hancock"]) {
      assert.ok(!isBlockedName(ok), ok);
    }
  });
});

describe("saving before a migration has been run", () => {
  /** A stand-in for the Supabase table that lacks some columns, recording what each insert sent. */
  function tableWithout(missing: string[]) {
    const inserts: Record<string, unknown>[] = [];
    const db = {
      from: () => ({
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              inserts.push(row);
              const absent = Object.keys(row).find((column) => missing.includes(column));
              return absent
                ? { data: null, error: { code: "PGRST204", message: `Could not find the '${absent}' column of 'waitlist' in the schema cache` } }
                : { data: { id: "1", first_name: row.first_name, best_time_ms: null, best_time_at: null }, error: null };
            },
          }),
        }),
      }),
    };
    return { store: supabaseStore(db as unknown as SupabaseClient), inserts };
  }
  const row = {
    email: "a@x.com", first_name: "Asha", best_time_ms: null, best_time_at: null, consented_at: "now",
    source: null, user_agent: null, role: "Founder", brand_link: "brand.com", brand_platform: "website", industry: "Fashion",
  };

  test("without 010, the row is saved without its industry and keeps everything else", async () => {
    const { store, inserts } = tableWithout(["industry"]);
    assert.ok(await store.insert(row));
    assert.equal(inserts.length, 2);
    assert.equal("industry" in inserts[1], false);
    assert.equal(inserts[1].role, "Founder");
  });

  test("without 009 or 010, the row is saved with name and email only", async () => {
    const { store, inserts } = tableWithout(["industry", "role", "brand_link", "brand_platform"]);
    assert.ok(await store.insert(row));
    assert.equal(inserts.length, 3);
    assert.deepEqual(Object.keys(inserts[2]).sort(), ["best_time_at", "best_time_ms", "consented_at", "email", "first_name", "source", "user_agent"]);
  });
});
