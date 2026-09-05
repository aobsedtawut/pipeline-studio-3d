import test from "node:test";
import assert from "node:assert/strict";
import { extractResults } from "../app/lib/facebookAds.js";

test("REPLIES counts Messenger conversations started", () => {
  assert.deepEqual(
    extractResults({
      optimization_goal: "REPLIES",
      actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "22" }],
    }),
    { results: 22, resultType: "onsite_conversion.messaging_conversation_started_7d" }
  );
});

test("messaging purchase prefers order-created without double counting aliases", () => {
  assert.deepEqual(
    extractResults({
      optimization_goal: "MESSAGING_PURCHASE_CONVERSION",
      actions: [
        { action_type: "onsite_conversion.messaging_order_created_v2", value: "3" },
        { action_type: "onsite_conversion.purchase", value: "3" },
      ],
    }),
    { results: 3, resultType: "onsite_conversion.messaging_order_created_v2" }
  );
});

test("legacy unknown goal falls back only when a Messenger result exists", () => {
  assert.equal(
    extractResults({
      optimization_goal: "Unknown Optimization Goal",
      actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "4" }],
    }).results,
    4
  );
  assert.deepEqual(
    extractResults({
      optimization_goal: "Unknown Optimization Goal",
      actions: [{ action_type: "video_view", value: "500" }],
    }),
    { results: null, resultType: null }
  );
});

test("THRUPLAY uses the dedicated metric instead of Messenger actions", () => {
  assert.deepEqual(
    extractResults({
      optimization_goal: "THRUPLAY",
      video_thruplay_watched_actions: [{ action_type: "video_view", value: "2459" }],
      actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "1" }],
    }),
    { results: 2459, resultType: "video_thruplay_watched_actions" }
  );
});
