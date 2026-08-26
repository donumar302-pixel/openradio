/**
 * Repeatable test for the engine-health slowness signal
 * (computeEngineHealth / GET /api/os/engine-health in
 * artifacts/api-server/src/routes/openspeaker.ts).
 *
 * Part 1 — pure unit assertions against summarizeEngineHealth (no DB, fully
 * deterministic): stuck-task threshold, slow-median threshold + boundaries,
 * minimum-sample rule, longform-parent exclusion, clone-voice exclusion.
 *
 * Part 2 — endpoint assertions: boots the Express app in-process on an
 * ephemeral port, seeds os_tasks rows for a dedicated test user, and scopes
 * the health query to that user via __engineHealthTestHooks so real traffic
 * can never skew results. Asserts slow:true / slow:false per engine, then the
 * CLEAR path: after the slow rows are deleted the cached response still says
 * slow (45 s cache), and after a simulated cache expiry the warnings clear.
 *
 * All seeded rows, the session, and the test user are deleted afterwards.
 *
 * Run: pnpm --filter @workspace/api-server run test:engine-health
 */
import { db, usersTable, osTasksTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import app from "../app";
import {
  summarizeEngineHealth,
  __engineHealthTestHooks,
  __resetEngineHealthCacheForTests,
} from "../routes/openspeaker";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const MIN = 60_000;
const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const TEST_EMAIL = `engine-health-test-${nonce}@example.test`;
const TEST_PASSWORD = `eh-test-${nonce}-Aa1!`;

const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures.push(msg);
    console.error(`FAIL  ${msg}`);
  }
}

/* ── Fixture helpers ─────────────────────────────────────────────────── */

type Fixture = {
  voiceId: string;
  status: "processing" | "done";
  /** minutes ago the task was created (relative to `now`) */
  createdMinAgo: number;
  /** for done rows: settle time in minutes (updatedAt - createdAt) */
  settleMin?: number;
  extraInput?: Record<string, unknown>;
};

function fixtureRow(now: number, f: Fixture) {
  const createdAt = new Date(now - f.createdMinAgo * MIN);
  const updatedAt =
    f.status === "done" ? new Date(createdAt.getTime() + (f.settleMin ?? 0) * MIN) : createdAt;
  return {
    status: f.status,
    input: { voiceId: f.voiceId, text: "engine-health test", ...(f.extraInput ?? {}) },
    createdAt,
    updatedAt,
  };
}

/* ── Part 1: pure unit assertions (no DB) ────────────────────────────── */

function runUnitAssertions() {
  console.log("\n── unit: summarizeEngineHealth ──");
  const now = Date.now();
  const rows = (fs: Fixture[]) => fs.map((f) => fixtureRow(now, f));

  // Stuck-task rule: 2 tasks processing > 4 min flag the engine; 1 does not.
  let r = summarizeEngineHealth(
    rows([
      { voiceId: "elevenlabs_a", status: "processing", createdMinAgo: 5 },
      { voiceId: "elevenlabs_b", status: "processing", createdMinAgo: 6 },
      { voiceId: "minimax_a", status: "processing", createdMinAgo: 6 },
      // young processing row: not stuck yet
      { voiceId: "minimax_b", status: "processing", createdMinAgo: 1 },
    ]),
    now,
  );
  expect(r.elevenlabs.slow === true, "2 tasks stuck > 4 min flag the engine slow");
  expect(r.minimax.slow === false, "1 stuck task (plus a young one) stays below the 2-stuck threshold");

  // Slow-median rule with boundary: median must EXCEED 3 min.
  r = summarizeEngineHealth(
    rows([
      { voiceId: "minimax_a", status: "done", createdMinAgo: 20, settleMin: 3.5 },
      { voiceId: "minimax_a", status: "done", createdMinAgo: 15, settleMin: 3.5 },
      { voiceId: "minimax_a", status: "done", createdMinAgo: 10, settleMin: 0.1 },
      { voiceId: "edge_a", status: "done", createdMinAgo: 20, settleMin: 3 },
      { voiceId: "edge_a", status: "done", createdMinAgo: 15, settleMin: 3 },
      { voiceId: "edge_a", status: "done", createdMinAgo: 10, settleMin: 3 },
    ]),
    now,
  );
  expect(r.minimax.slow === true && r.minimax.medianMs === 3.5 * MIN, "median settle > 3 min flags the engine slow");
  expect(r.edge.slow === false && r.edge.medianMs === 3 * MIN, "median settle EXACTLY 3 min does not flag (strict >)");

  // Minimum-sample rule: 2 slow completions are not enough to trust a median.
  r = summarizeEngineHealth(
    rows([
      { voiceId: "fishaudio_a", status: "done", createdMinAgo: 20, settleMin: 10 },
      { voiceId: "fishaudio_a", status: "done", createdMinAgo: 15, settleMin: 10 },
    ]),
    now,
  );
  expect(r.fishaudio.slow === false && r.fishaudio.medianMs === undefined, "2 slow completions are below the 3-sample minimum");

  // Longform-parent exclusion: stuck + slow longform rows must be ignored.
  r = summarizeEngineHealth(
    rows([
      { voiceId: "edge_a", status: "processing", createdMinAgo: 10, extraInput: { _longform: true } },
      { voiceId: "edge_a", status: "processing", createdMinAgo: 12, extraInput: { _longform: true } },
      { voiceId: "edge_a", status: "done", createdMinAgo: 20, settleMin: 10, extraInput: { _longform: true } },
      { voiceId: "edge_a", status: "done", createdMinAgo: 15, settleMin: 10, extraInput: { _longform: true } },
      { voiceId: "edge_a", status: "done", createdMinAgo: 10, settleMin: 10, extraInput: { _longform: true } },
    ]),
    now,
  );
  expect(r.edge.slow === false && r.edge.medianMs === undefined, "longform parents are excluded from stuck and median counts");

  // Clone-voice exclusion: no engine prefix ⇒ no engine gets the signal.
  r = summarizeEngineHealth(
    rows([
      { voiceId: "clone_abc", status: "processing", createdMinAgo: 10 },
      { voiceId: "clone_abc", status: "processing", createdMinAgo: 12 },
      { voiceId: "clone_abc", status: "done", createdMinAgo: 20, settleMin: 10 },
      { voiceId: "clone_abc", status: "done", createdMinAgo: 15, settleMin: 10 },
      { voiceId: "clone_abc", status: "done", createdMinAgo: 10, settleMin: 10 },
    ]),
    now,
  );
  expect(
    Object.values(r).every((info) => info.slow === false && info.medianMs === undefined),
    "clone-voice rows (no engine prefix) flag no engine",
  );

  // Healthy engine: fast completions + sub-threshold stuck count.
  r = summarizeEngineHealth(
    rows([
      { voiceId: "fishaudio_a", status: "done", createdMinAgo: 20, settleMin: 0.1 },
      { voiceId: "fishaudio_a", status: "done", createdMinAgo: 15, settleMin: 0.1 },
      { voiceId: "fishaudio_a", status: "done", createdMinAgo: 10, settleMin: 0.1 },
      { voiceId: "fishaudio_a", status: "processing", createdMinAgo: 6 },
    ]),
    now,
  );
  expect(r.fishaudio.slow === false, "fast engine with a single stuck task stays healthy");
}

/* ── Part 2: endpoint assertions (isolated via test-user scoping) ────── */

async function main() {
  runUnitAssertions();

  console.log("\n── endpoint: GET /api/os/engine-health ──");
  let userId: number | undefined;
  let server: Server | undefined;
  let exitCode = 1;

  try {
    // Seed the test user.
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
    const [user] = await db
      .insert(usersTable)
      .values({ name: "Engine Health Test", email: TEST_EMAIL, passwordHash, plan: "free", status: "active" })
      .returning({ id: usersTable.id });
    userId = user!.id;

    // Scope the health query to the test user (isolates from real traffic)
    // and start from an empty cache.
    __engineHealthTestHooks.scopeUserId = userId;
    __resetEngineHealthCacheForTests();

    const now = Date.now();
    const toDbRow = (f: Fixture) => ({ userId: userId!, tool: "tts", title: "engine-health test row", ...fixtureRow(now, f) });

    // Rows that must FLAG engines — deleted later to verify the clear path.
    const slowSeeds: Fixture[] = [
      { voiceId: "elevenlabs_stuck_a", status: "processing", createdMinAgo: 6 },
      { voiceId: "elevenlabs_stuck_b", status: "processing", createdMinAgo: 8 },
      { voiceId: "minimax_slow", status: "done", createdMinAgo: 20, settleMin: 3.5 },
      { voiceId: "minimax_slow", status: "done", createdMinAgo: 15, settleMin: 3.5 },
      { voiceId: "minimax_slow", status: "done", createdMinAgo: 10, settleMin: 3.5 },
    ];
    // Rows that must NOT flag engines.
    const healthySeeds: Fixture[] = [
      // fishaudio: fast median, 1 in-window stuck (below threshold), 2 stuck OUTSIDE the 30-min window.
      { voiceId: "fishaudio_fast", status: "done", createdMinAgo: 20, settleMin: 0.1 },
      { voiceId: "fishaudio_fast", status: "done", createdMinAgo: 15, settleMin: 0.1 },
      { voiceId: "fishaudio_fast", status: "done", createdMinAgo: 10, settleMin: 0.1 },
      { voiceId: "fishaudio_fast", status: "processing", createdMinAgo: 6 },
      { voiceId: "fishaudio_fast", status: "processing", createdMinAgo: 40 },
      { voiceId: "fishaudio_fast", status: "processing", createdMinAgo: 45 },
      // edge: stuck/slow rows are all longform parents (excluded); fast rows give a healthy median.
      { voiceId: "edge_longform", status: "processing", createdMinAgo: 10, extraInput: { _longform: true } },
      { voiceId: "edge_longform", status: "processing", createdMinAgo: 12, extraInput: { _longform: true } },
      { voiceId: "edge_longform", status: "done", createdMinAgo: 20, settleMin: 10, extraInput: { _longform: true } },
      { voiceId: "edge_longform", status: "done", createdMinAgo: 22, settleMin: 10, extraInput: { _longform: true } },
      { voiceId: "edge_fast", status: "done", createdMinAgo: 20, settleMin: 0.1 },
      { voiceId: "edge_fast", status: "done", createdMinAgo: 15, settleMin: 0.1 },
      { voiceId: "edge_fast", status: "done", createdMinAgo: 10, settleMin: 0.1 },
      // clone voices: stuck + slow rows that must flag nothing.
      { voiceId: "clone_abc123", status: "processing", createdMinAgo: 10 },
      { voiceId: "clone_abc123", status: "processing", createdMinAgo: 12 },
      { voiceId: "clone_abc123", status: "done", createdMinAgo: 20, settleMin: 10 },
      { voiceId: "clone_abc123", status: "done", createdMinAgo: 15, settleMin: 10 },
      { voiceId: "clone_abc123", status: "done", createdMinAgo: 10, settleMin: 10 },
    ];
    const slowRows = await db.insert(osTasksTable).values(slowSeeds.map(toDbRow)).returning({ id: osTasksTable.id });
    await db.insert(osTasksTable).values(healthySeeds.map(toDbRow));
    console.log(`Seeded ${slowSeeds.length + healthySeeds.length} os_tasks rows for test user #${userId}`);

    // Boot the app in-process on an ephemeral port.
    server = app.listen(0);
    await new Promise<void>((resolve, reject) => {
      server!.once("listening", () => resolve());
      server!.once("error", reject);
    });
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    // Session cookies are secure-only; trust proxy + this header satisfies that.
    const proxyHeaders = { "x-forwarded-proto": "https" };

    // Log in (the route requires an active user).
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", ...proxyHeaders },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (loginRes.status !== 200) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    const cookie = loginRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    if (!cookie) throw new Error("Login returned no session cookie");

    const getHealth = async () => {
      const res = await fetch(`${base}/api/os/engine-health`, { headers: { cookie, ...proxyHeaders } });
      if (res.status !== 200) throw new Error(`engine-health failed: ${res.status} ${await res.text()}`);
      return (await res.json()) as { engines: Record<string, { slow: boolean; medianMs?: number }> };
    };

    // ── Phase A: warnings APPEAR for the right engines ──
    let e = (await getHealth()).engines;
    console.log("phase A response:", JSON.stringify(e));
    expect(e.elevenlabs?.slow === true, "elevenlabs is flagged slow (2 tasks stuck > 4 min)");
    expect(e.minimax?.slow === true, "minimax is flagged slow (median settle > 3 min)");
    expect(
      typeof e.minimax?.medianMs === "number" && e.minimax.medianMs > 3 * MIN,
      `minimax medianMs (${e.minimax?.medianMs}) exceeds the 3-min threshold`,
    );
    expect(e.fishaudio?.slow === false, "fishaudio stays healthy (fast median, 1 stuck < threshold, old stuck rows outside window)");
    expect(e.edge?.slow === false, "edge stays healthy (stuck/slow longform parents excluded)");
    expect(
      typeof e.edge?.medianMs === "number" && e.edge.medianMs < 3 * MIN,
      `edge medianMs (${e.edge?.medianMs}) ignores slow longform completions`,
    );
    expect(
      Object.entries(e).every(([name, info]) => info.slow === (name === "elevenlabs" || name === "minimax")),
      "stuck/slow clone-voice rows flag no engine",
    );

    // ── Phase B: slow rows resolve, but the 45s cache still serves the warning ──
    await db.delete(osTasksTable).where(inArray(osTasksTable.id, slowRows.map((r) => r.id)));
    e = (await getHealth()).engines;
    expect(
      e.elevenlabs?.slow === true && e.minimax?.slow === true,
      "within the 45s cache window the warning is still served (cache behavior)",
    );

    // ── Phase C: after cache expiry the warnings CLEAR ──
    __resetEngineHealthCacheForTests();
    e = (await getHealth()).engines;
    console.log("phase C response:", JSON.stringify(e));
    expect(
      Object.values(e).every((info) => info.slow === false),
      "after the slow tasks resolve and the cache expires, every engine reports healthy",
    );

    if (failures.length === 0) {
      console.log("\nengine-health test PASSED");
      exitCode = 0;
    } else {
      console.error(`\nengine-health test FAILED (${failures.length} assertion(s)):`);
      for (const f of failures) console.error(`  - ${f}`);
    }
  } finally {
    // Cleanup: seeded rows, session, test user, and the test-scope hook.
    try {
      __engineHealthTestHooks.scopeUserId = undefined;
      __resetEngineHealthCacheForTests();
      if (userId !== undefined) {
        const deleted = await db.delete(osTasksTable).where(eq(osTasksTable.userId, userId)).returning({ id: osTasksTable.id });
        await db.execute(sql`DELETE FROM user_sessions WHERE sess->>'userId' = ${String(userId)}`);
        await db.delete(usersTable).where(eq(usersTable.id, userId));
        console.log(`Cleaned up ${deleted.length} remaining seeded rows and test user #${userId}`);
      }
    } catch (err) {
      console.error("Cleanup failed:", err);
      exitCode = 1;
    }
    server?.close();
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("engine-health test crashed:", err);
  process.exit(1);
});
