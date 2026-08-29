import assert from "node:assert/strict";
import test from "node:test";

import { effectiveHourlyCost, ownerCostIsMissing } from "../src/lib/labor-cost.ts";

test("uses the current owner rate for historical owner entries saved at zero", () => {
  const entry = { team_member_id: null, hourly_cost: 0 };
  assert.equal(effectiveHourlyCost(entry, 47.5), 47.5);
  assert.equal(ownerCostIsMissing(entry, 47.5), false);
});

test("keeps the saved snapshot rate when an owner entry already has one", () => {
  const entry = { team_member_id: null, hourly_cost: 38 };
  assert.equal(effectiveHourlyCost(entry, 47.5), 38);
});

test("never replaces a worker rate with the owner rate", () => {
  const entry = { team_member_id: "worker-id", hourly_cost: 24 };
  assert.equal(effectiveHourlyCost(entry, 47.5), 24);
  assert.equal(ownerCostIsMissing(entry, 0), false);
});

test("flags only uncosted owner entries when no owner rate is configured", () => {
  assert.equal(ownerCostIsMissing({ team_member_id: null, hourly_cost: 0 }, 0), true);
  assert.equal(ownerCostIsMissing({ team_member_id: null, hourly_cost: 1 }, 0), false);
});
