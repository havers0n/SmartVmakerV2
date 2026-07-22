import assert from "node:assert/strict";
import test from "node:test";
import { classifyGenerationMigrationState } from "./preflight-generation-migrations.mjs";

function state(schema0028, journal0028, schema0029, journal0029) {
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
  ];
}

test("allows a normal 0028 then 0029 migration", () => {
  assert.equal(
    classifyGenerationMigrationState(state(false, false, false, false)).code,
    "APPLY_0028_THEN_0029",
  );
});

test("allows 0029 after a fully journalled 0028", () => {
  assert.equal(
    classifyGenerationMigrationState(state(true, true, false, false)).code,
    "APPLY_0029",
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
    classifyGenerationMigrationState(state(true, true, true, true)).code,
    "UP_TO_DATE",
  );
});
