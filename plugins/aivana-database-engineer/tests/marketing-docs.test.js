const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("marketing package covers launch-ready messaging blocks", () => {
  const marketing = fs.readFileSync(path.join(root, "MARKETING.md"), "utf8");

  for (const heading of [
    "## Positioning",
    "## Ideal Customer Profile",
    "## Buyer Personas",
    "## Pain Points",
    "## Value Propositions",
    "## USP Matrix",
    "## Competitive Positioning",
    "## Marketplace Listing Copy",
    "## Landing Page Copy",
    "## FAQ and Objection Handling",
    "## Pricing and Packaging Narrative",
    "## Launch Blurb",
  ]) {
    assert.ok(marketing.includes(heading), `${heading} missing`);
  }

  assert.ok(marketing.includes("Autonomous Database Operations without autonomous production risk."));
  assert.ok(marketing.includes("Enterprise platform teams"));
});

test("sales playbook includes demos, discovery, qualification, and close plan", () => {
  const playbook = fs.readFileSync(path.join(root, "demos", "SALES_PLAYBOOK.md"), "utf8");

  for (const phrase of [
    "## Discovery Questions",
    "## Qualification Signals",
    "## Demo Flow",
    "## Objection Handling",
    "## Follow-Up Email",
    "AI Detects a Dangerous Prompt and Stops Production Risk",
    "AI Operator Builds a Board-Level Briefing",
    "Cross-Agent Consensus Prevents the Wrong Index",
    "ROI Narrative for the CIO/CTO",
  ]) {
    assert.ok(playbook.includes(phrase), `${phrase} missing`);
  }
});
