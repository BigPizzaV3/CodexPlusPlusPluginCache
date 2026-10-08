import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const scenario = process.env.SEQUENCE_VIEWER_E2E_FAULT_SCENARIO;
const allowedScenarios = new Set([
  "accession-missing",
  "deterministic-subset-failure",
  "malformed-database-response",
  "network-unavailable",
  "output-quota-failure",
  "oversized-source-or-analysis-budget",
  "payload-format-mismatch",
  "rate-limit",
]);

if (!allowedScenarios.has(scenario)) {
  throw new Error("Invalid Sequence Viewer qualification fault scenario.");
}

const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (scenario === "network-unavailable") {
    throw new TypeError("Injected qualification network outage.");
  }
  if (scenario === "rate-limit") {
    return response("rate limited\n", {
      headers: { "retry-after": "60 seconds" },
      status: 429,
    });
  }
  if (scenario === "malformed-database-response") {
    return response("<!doctype html><title>Error</title>database unavailable\n", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (scenario === "accession-missing") {
    return response("NC_001416.1 was not found\n", { status: 404 });
  }
  if (
    scenario === "payload-format-mismatch" &&
    url.hostname === "www.ebi.ac.uk"
  ) {
    return response(
      [
        "run_accession\tfastq_ftp\tfastq_md5\tfastq_bytes",
        "DRR000000\tftp.sra.ebi.ac.uk/vol1/fastq/DRR037/DRR037765/DRR037765.fastq.gz\t81735432a6f578b332aae58cdbd95231\t127526",
        "",
      ].join("\n"),
      { headers: { "content-type": "text/tab-separated-values" } },
    );
  }
  if (scenario === "oversized-source-or-analysis-budget") {
    return response("oversized\n", {
      headers: { "content-length": String(2 * 1_024 * 1_024 + 1) },
    });
  }
  return await originalFetch(input, init);
};

if (scenario === "deterministic-subset-failure") {
  const OriginalTextDecoder = globalThis.TextDecoder;
  globalThis.TextDecoder = class QualificationTextDecoder extends OriginalTextDecoder {
    decode(input, options) {
      const decoded = super.decode(input, options);
      if (!decoded.startsWith("@DRR037765.")) return decoded;
      const lines = decoded.trimEnd().split(/\r?\n/u);
      return `${lines.slice(0, 499 * 4).join("\n")}\n`;
    }
  };
}

if (scenario === "output-quota-failure") {
  const originalStatfs = fs.promises.statfs.bind(fs.promises);
  fs.promises.statfs = async (...args) => {
    const fileSystem = await originalStatfs(...args);
    return {
      ...fileSystem,
      bavail: typeof fileSystem.bavail === "bigint" ? 0n : 0,
      bfree: typeof fileSystem.bfree === "bigint" ? 0n : 0,
    };
  };
  syncBuiltinESMExports();
}

function response(body, { headers = {}, status = 200 } = {}) {
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...headers,
    },
    status,
  });
}
