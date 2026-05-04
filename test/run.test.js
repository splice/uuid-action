import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY = fileURLToPath(new URL("../index.js", import.meta.url));
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function runAction(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "uuid-action-test-"));
  const outputFile = join(dir, "output");
  const envFile = join(dir, "env");
  writeFileSync(outputFile, "");
  writeFileSync(envFile, "");

  const result = spawnSync("node", [ENTRY], {
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputFile,
      GITHUB_ENV: envFile,
      INPUT_NAME: "",
      INPUT_NAMESPACE: "",
      ...env,
    },
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: readFileSync(outputFile, "utf8"),
  };
}

function extractUuid(output) {
  const match = output.match(
    /uuid<<[^\n]+\n([0-9a-f-]+)\n/i,
  );
  return match ? match[1] : null;
}

test("with no inputs, generates a v4 UUID and exits cleanly", () => {
  const r = runAction();
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\nstdout: ${r.stdout}`);
  const uuid = extractUuid(r.output);
  assert.ok(uuid, `no uuid in output file: ${r.output}`);
  assert.match(uuid, UUID_RE);
  // v4 has '4' as the version nibble (15th hex char).
  assert.equal(uuid[14], "4", `expected v4 UUID, got ${uuid}`);
});

test("with a name input, generates a deterministic v5 UUID", () => {
  const r1 = runAction({ INPUT_NAME: "hello" });
  const r2 = runAction({ INPUT_NAME: "hello" });
  assert.equal(r1.status, 0);
  assert.equal(r2.status, 0);
  const u1 = extractUuid(r1.output);
  const u2 = extractUuid(r2.output);
  assert.ok(u1);
  assert.equal(u1, u2, "v5 UUIDs for the same name+namespace must match");
  assert.equal(u1[14], "5", `expected v5 UUID, got ${u1}`);
});

test("with a custom valid namespace, generates a v5 UUID", () => {
  const r = runAction({
    INPUT_NAME: "hello",
    INPUT_NAMESPACE: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  });
  assert.equal(r.status, 0);
  const uuid = extractUuid(r.output);
  assert.ok(uuid);
  assert.equal(uuid[14], "5");
});

test("with an invalid namespace, fails with a clear error", () => {
  const r = runAction({
    INPUT_NAME: "hello",
    INPUT_NAMESPACE: "not-a-uuid",
  });
  assert.notEqual(r.status, 0, "action should fail on invalid namespace");
  assert.match(
    r.stdout,
    /Invalid namespace input/,
    `expected clear error message, got: ${r.stdout}`,
  );
});
