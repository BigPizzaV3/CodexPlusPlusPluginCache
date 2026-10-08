const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("query_fingerprint_clusterer groups query variants into high-impact families", async () => {
  const result = await dispatch("query_fingerprint_clusterer", {
    queries: [
      { queryId: "q1", sql: "SELECT * FROM events WHERE user_id = 1", calls: 1000, p95Ms: 120 },
      { queryId: "q2", sql: "SELECT * FROM events WHERE user_id = 2", calls: 800, p95Ms: 140 },
      { queryId: "q3", sql: "SELECT * FROM orders WHERE status = 'paid'", calls: 50, p95Ms: 900 },
    ],
  });

  assert.equal(result.usp, "query_fingerprint_clusterer");
  assert.ok(result.clusters.length >= 2);
  assert.equal(result.clusters[0].queryIds.includes("q1"), true);
  assert.ok(result.clusters[0].impactScore > 0);
});

test("wait_event_root_cause maps wait pressure to likely causes and actions", async () => {
  const result = await dispatch("wait_event_root_cause", {
    waits: [
      { waitType: "LCK_M_X", waitMs: 5000, sessions: 4 },
      { waitType: "PAGEIOLATCH_SH", waitMs: 1200, sessions: 2 },
    ],
  });

  assert.equal(result.usp, "wait_event_root_cause");
  assert.equal(result.primaryCause.id, "blocking_lock_chain");
  assert.ok(result.actions.includes("inspect_blocking_sessions"));
});

test("data_skew_detector identifies hot values and skew risk", async () => {
  const result = await dispatch("data_skew_detector", {
    column: "tenant_id",
    distribution: [
      { value: "tenant-a", rows: 900000 },
      { value: "tenant-b", rows: 50000 },
      { value: "tenant-c", rows: 50000 },
    ],
  });

  assert.equal(result.usp, "data_skew_detector");
  assert.equal(result.skewDetected, true);
  assert.equal(result.hotValues[0].value, "tenant-a");
  assert.ok(result.recommendations.includes("evaluate_filtered_or_partial_indexes"));
});

test("cache_efficiency_advisor flags low hit ratio and high read amplification", async () => {
  const result = await dispatch("cache_efficiency_advisor", {
    bufferHitRatio: 0.82,
    physicalReads: 900000,
    logicalReads: 1200000,
    table: "events",
  });

  assert.equal(result.usp, "cache_efficiency_advisor");
  assert.equal(result.status, "cache_pressure");
  assert.ok(result.findings.some((finding) => finding.id === "low_buffer_hit_ratio"));
});

test("capacity_headroom_forecast predicts saturation from growth trend", async () => {
  const result = await dispatch("capacity_headroom_forecast", {
    currentSizeGb: 820,
    maxSizeGb: 1000,
    dailyGrowthGb: 15,
    cpuP95Pct: 88,
    ioP95Pct: 74,
  });

  assert.equal(result.usp, "capacity_headroom_forecast");
  assert.equal(result.status, "capacity_risk");
  assert.ok(result.daysToStorageSaturation <= 12);
  assert.ok(result.actions.includes("schedule_capacity_increase"));
});
