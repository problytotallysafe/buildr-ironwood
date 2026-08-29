import assert from "node:assert/strict";
import test from "node:test";

import {
  callbackInternalCost,
  callbackReadyForAcceptance,
  safeCallbackView,
  summarizeCallbackFinancials,
} from "../src/lib/project-callbacks.ts";

test("uses estimated callback cost until an actual cost is entered", () => {
  assert.equal(callbackInternalCost({
    status: "accepted",
    estimated_internal_cost: 450,
    actual_internal_cost: null,
    homeowner_amount: 0,
  }), 450);
});

test("keeps a deliberately entered zero actual cost", () => {
  assert.equal(callbackInternalCost({
    status: "completed",
    estimated_internal_cost: 450,
    actual_internal_cost: 0,
    homeowner_amount: 0,
  }), 0);
});

test("accepted callbacks adjust revenue, cost, and projected profit", () => {
  assert.deepEqual(summarizeCallbackFinancials([
    { status: "accepted", estimated_internal_cost: 300, actual_internal_cost: null, homeowner_amount: 500 },
    { status: "completed", estimated_internal_cost: 200, actual_internal_cost: 175, homeowner_amount: 0 },
  ]), { revenue: 500, cost: 475, net: 25 });
});

test("draft and deleted callbacks do not affect project financials", () => {
  assert.deepEqual(summarizeCallbackFinancials([
    { status: "draft", estimated_internal_cost: 200, actual_internal_cost: null, homeowner_amount: 500 },
    { status: "accepted", estimated_internal_cost: 300, actual_internal_cost: null, homeowner_amount: 500, deleted_at: "2026-08-29T00:00:00Z" },
  ]), { revenue: 0, cost: 0, net: 0 });
  assert.equal(safeCallbackView("anything"), "active");
});

test("acceptance requires a warranty decision, cost responsibility, and repair plan", () => {
  assert.equal(callbackReadyForAcceptance({ warranty_status: "under_review", cost_responsibility: "ironwood", repair_plan: "Inspect and reseal." }), false);
  assert.equal(callbackReadyForAcceptance({ warranty_status: "warranty", cost_responsibility: "undetermined", repair_plan: "Inspect and reseal." }), false);
  assert.equal(callbackReadyForAcceptance({ warranty_status: "warranty", cost_responsibility: "ironwood", repair_plan: "" }), false);
  assert.equal(callbackReadyForAcceptance({ warranty_status: "warranty", cost_responsibility: "ironwood", repair_plan: "Inspect and reseal." }), true);
});
