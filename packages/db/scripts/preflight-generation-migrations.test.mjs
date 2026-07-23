import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeMigrationSql,
  classifyGenerationMigrationState,
  hashMigrationSql,
} from "./preflight-generation-migrations.mjs";

test("canonical migration hash normalizes LF and CRLF without hiding content changes", () => {
  const lf = "select 1;\nselect 2;\n";
  const crlf = "select 1;\r\nselect 2;\r\n";

  assert.equal(canonicalizeMigrationSql(crlf), lf);
  assert.equal(
    hashMigrationSql(lf).canonicalHash,
    hashMigrationSql(crlf).canonicalHash,
  );
  assert.notEqual(
    hashMigrationSql(lf).executionHash,
    hashMigrationSql(crlf).executionHash,
  );
  assert.notEqual(
    hashMigrationSql(lf).canonicalHash,
    hashMigrationSql("select 1;\nselect 3;\n").canonicalHash,
  );
  assert.notEqual(
    hashMigrationSql("select 1;").canonicalHash,
    hashMigrationSql("select 1;\n").canonicalHash,
  );
});

function state(
  schema0028,
  journal0028,
  schema0029,
  journal0029,
  schema0030 = false,
  journal0030 = false,
) {
  return [
    {
      tag: "0028",
      schemaPresent: schema0028,
      journalPresent: journal0028,
      hashMismatch: false,
      objectCount: schema0028 ? 2 : 0,
      objectTotal: 2,
      createdAt: journal0028 ? 28 : null,
    },
    {
      tag: "0029",
      schemaPresent: schema0029,
      journalPresent: journal0029,
      hashMismatch: false,
      objectCount: schema0029 ? 3 : 0,
      objectTotal: 3,
      createdAt: journal0029 ? 29 : null,
    },
    {
      tag: "0030",
      schemaPresent: schema0030,
      journalPresent: journal0030,
      hashMismatch: false,
      objectCount: schema0030 ? 11 : 0,
      objectTotal: 11,
      createdAt: journal0030 ? 30 : null,
    },
  ];
}

test("allows a normal 0028 then 0029 then 0030 migration", () => {
  assert.equal(
    classifyGenerationMigrationState(state(false, false, false, false)).code,
    "APPLY_0028_THEN_0029_THEN_0030",
  );
});

test("allows 0029 and 0030 after a fully journalled 0028", () => {
  assert.equal(
    classifyGenerationMigrationState(state(true, true, false, false)).code,
    "APPLY_0029_THEN_0030",
  );
});

test("allows 0030 after fully journalled 0028 and 0029", () => {
  assert.equal(
    classifyGenerationMigrationState(
      state(true, true, true, true, false, false),
    ).code,
    "APPLY_0030",
  );
});

test("blocks schema without journal", () => {
  assert.equal(
    classifyGenerationMigrationState(state(true, false, false, false)).safe,
    false,
  );
});

test("blocks journal without schema", () => {
  assert.equal(
    classifyGenerationMigrationState(state(false, true, false, false)).safe,
    false,
  );
});

test("blocks a partial migration schema", () => {
  const targets = state(true, true, false, false);
  targets[0].objectCount = 1;
  targets[0].schemaPresent = false;
  assert.equal(
    classifyGenerationMigrationState(targets).code,
    "0028_PARTIAL_SCHEMA",
  );
});

test("blocks a journal timestamp with a different local hash", () => {
  const targets = state(true, true, false, false);
  targets[0].hashMismatch = true;
  assert.equal(
    classifyGenerationMigrationState(targets).code,
    "0028_HASH_MISMATCH",
  );
});

test("accepts a fully applied state", () => {
  assert.equal(
    classifyGenerationMigrationState(state(true, true, true, true, true, true))
      .code,
    "UP_TO_DATE",
  );
});
