const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Each test worker owns its state and cannot modify a user's advisor history.
const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "codexdb-test-"));
process.env.CODEXDB_STATE_DIR = stateDir;
process.on("exit", () => fs.rmSync(stateDir, { recursive: true, force: true }));
