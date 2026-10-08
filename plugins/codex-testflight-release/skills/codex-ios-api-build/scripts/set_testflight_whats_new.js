#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const [, , bundleId, buildNumber, locale = "en-US", ...textParts] = process.argv;

if (!bundleId || !buildNumber || textParts.length === 0) {
  console.error("Usage: set_testflight_whats_new.js <bundle-id> <build-number> <locale> <what-to-test text>");
  process.exit(2);
}

const whatToTest = textParts.join(" ").trim();
const envPath = process.env.ASC_ENV_FILE || path.join(process.env.HOME || "", ".private_keys/appstoreconnect.env");

function readEnv(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJwt({ keyId, issuerId, keyPath }) {
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: fs.readFileSync(keyPath, "utf8"),
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64url(signature)}`;
}

async function request(token, method, endpoint, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status || res.status} ${e.code || ""} ${e.title || ""} ${e.detail || ""}`.trim()).join(" | ");
    throw new Error(detail || `${method} ${endpoint} failed with ${res.status}`);
  }
  return json;
}

async function requestAllowing(token, method, endpoint, body, allowedStatuses = []) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok && !allowedStatuses.includes(res.status)) {
    const detail = json?.errors?.map((e) => `${e.status || res.status} ${e.code || ""} ${e.title || ""} ${e.detail || ""}`.trim()).join(" | ");
    throw new Error(detail || `${method} ${endpoint} failed with ${res.status}`);
  }
  return { status: res.status, json };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadBuildBetaDetail(token, buildId) {
  const response = await request(token, "GET", `/v1/builds/${buildId}/buildBetaDetail`);
  return response.data;
}

async function main() {
  const env = readEnv(envPath);
  const keyId = process.env.ASC_KEY_ID || env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID || env.ASC_ISSUER_ID;
  const keyPath = process.env.ASC_KEY_PATH || env.ASC_KEY_PATH;
  const betaGroupName = process.env.ASC_BETA_GROUP || env.ASC_BETA_GROUP;
  const submitBetaReview = (process.env.ASC_SUBMIT_BETA_REVIEW || env.ASC_SUBMIT_BETA_REVIEW || "").toLowerCase() === "true";
  if (!keyId || !issuerId || !keyPath) throw new Error("Missing ASC_KEY_ID, ASC_ISSUER_ID, or ASC_KEY_PATH.");

  const token = makeJwt({ keyId, issuerId, keyPath });
  const appResponse = await request(token, "GET", `/v1/apps?filter%5BbundleId%5D=${encodeURIComponent(bundleId)}&limit=1`);
  const appId = appResponse.data?.[0]?.id;
  if (!appId) throw new Error(`No App Store Connect app found for ${bundleId}.`);

  let build;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const buildsResponse = await request(
      token,
      "GET",
      `/v1/builds?filter%5Bapp%5D=${encodeURIComponent(appId)}&filter%5Bversion%5D=${encodeURIComponent(buildNumber)}&sort=-uploadedDate&limit=5`
    );
    build = buildsResponse.data?.find((item) => item.attributes?.version === buildNumber) || buildsResponse.data?.[0];
    if (build) break;
    await sleep(20000);
  }

  if (!build) throw new Error(`Build ${buildNumber} was not visible in App Store Connect yet.`);

  const localizations = await request(token, "GET", `/v1/builds/${build.id}/betaBuildLocalizations`);
  const existing = localizations.data?.find((item) => item.attributes?.locale === locale) || localizations.data?.[0];

  if (existing) {
    await request(token, "PATCH", `/v1/betaBuildLocalizations/${existing.id}`, {
      data: {
        type: "betaBuildLocalizations",
        id: existing.id,
        attributes: { whatsNew: whatToTest },
      },
    });
    console.log(`Updated What to Test for build ${buildNumber} (${locale}).`);
  } else {
    await request(token, "POST", "/v1/betaBuildLocalizations", {
      data: {
        type: "betaBuildLocalizations",
        attributes: { locale, whatsNew: whatToTest },
        relationships: {
          build: {
            data: { type: "builds", id: build.id },
          },
        },
      },
    });
    console.log(`Created What to Test for build ${buildNumber} (${locale}).`);
  }

  console.log(`Build ${buildNumber} state: ${build.attributes?.processingState || "UNKNOWN"}.`);

  if (betaGroupName) {
    let betaDetail;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      betaDetail = await loadBuildBetaDetail(token, build.id);
      const externalState = betaDetail?.attributes?.externalBuildState || "UNKNOWN";
      const internalState = betaDetail?.attributes?.internalBuildState || "UNKNOWN";
      console.log(`TestFlight state for build ${buildNumber}: internal=${internalState}, external=${externalState}.`);
      if (!["PROCESSING", "UNKNOWN", "NOT_APPLICABLE"].includes(externalState)) break;
      await sleep(20000);
    }

    const externalState = betaDetail?.attributes?.externalBuildState || "UNKNOWN";
    if (externalState === "MISSING_EXPORT_COMPLIANCE") {
      throw new Error(`Build ${buildNumber} is missing export-compliance confirmation despite archive metadata.`);
    }
    if (["PROCESSING", "UNKNOWN", "NOT_APPLICABLE", "PROCESSING_EXCEPTION", "BETA_REJECTED", "EXPIRED"].includes(externalState)) {
      throw new Error(`Build ${buildNumber} is not ready for external assignment: ${externalState}.`);
    }

    const groups = await request(
      token,
      "GET",
      `/v1/betaGroups?filter%5Bapp%5D=${encodeURIComponent(appId)}&filter%5Bname%5D=${encodeURIComponent(betaGroupName)}&limit=10`
    );
    const group = groups.data?.find((item) => item.attributes?.name === betaGroupName) || groups.data?.[0];
    if (!group) throw new Error(`External TestFlight group '${betaGroupName}' was not found for ${bundleId}.`);

    const assignment = await requestAllowing(
      token,
      "POST",
      `/v1/betaGroups/${group.id}/relationships/builds`,
      { data: [{ type: "builds", id: build.id }] },
      [409]
    );
    console.log(
      assignment.status === 409
        ? `Build ${buildNumber} is already assigned to TestFlight group ${betaGroupName}.`
        : `Assigned build ${buildNumber} to TestFlight group ${betaGroupName}.`
    );

    if (submitBetaReview) {
      const review = await requestAllowing(
        token,
        "POST",
        "/v1/betaAppReviewSubmissions",
        {
          data: {
            type: "betaAppReviewSubmissions",
            relationships: { build: { data: { type: "builds", id: build.id } } },
          },
        },
        [409]
      );
      console.log(
        review.status === 409
          ? `Build ${buildNumber} already has a Beta App Review submission or does not need another one.`
          : `Submitted build ${buildNumber} for Beta App Review.`
      );
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
