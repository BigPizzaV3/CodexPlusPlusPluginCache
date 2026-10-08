/**
 * Dependency-free workspace linker.
 *
 * In the canonical stack, `npm install` creates node_modules symlinks for the
 * @devrecap/* workspace packages. This environment has no npm registry access,
 * so this script creates those symlinks directly, letting Node resolve bare
 * `@devrecap/*` specifiers. Idempotent; safe to re-run. Invoked by `predev`,
 * `pretest`, and `prestart`.
 */
import {
  mkdirSync,
  symlinkSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// On Windows, a plain directory symlink (`symlinkSync(..., "dir")`) requires
// elevated privileges or Developer Mode and otherwise fails with EPERM. A
// "junction" is the cross-platform-safe equivalent for directories: it needs no
// special privileges on Windows and is ignored (treated as "dir") elsewhere.
// This keeps `npm run setup` working for normal users on Windows, macOS, Linux.
const LINK_TYPE = process.platform === "win32" ? "junction" : "dir";
const QUIET = process.env.DEVRECAP_LINK_QUIET === "1";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
mkdirSync(join(nm, "@devrecap"), { recursive: true });

const pkgDir = join(root, "packages");
const dirs = readdirSync(pkgDir).filter((n) => {
  try {
    return statSync(join(pkgDir, n)).isDirectory();
  } catch {
    return false;
  }
});

let linked = 0;
for (const d of dirs) {
  const target = join(pkgDir, d);
  const pkgJsonPath = join(target, "package.json");
  if (!existsSync(pkgJsonPath)) continue;
  const name = JSON.parse(readFileSync(pkgJsonPath, "utf8")).name;
  if (!name) continue;
  // name like "@devrecap/shared" → link node_modules/@devrecap/shared
  const link = join(nm, name);
  mkdirSync(dirname(link), { recursive: true });

  let current = false;
  if (existsSync(link)) {
    try {
      current = resolve(realpathSync(link)) === resolve(realpathSync(target));
    } catch {
      current = false;
    }
  }

  // Keep an already-correct link in place. This matters when multiple Node test
  // workers or plugin invocations overlap on Windows: deleting and recreating a
  // valid junction can briefly break package resolution in another process.
  if (!current) {
    if (existsSync(link)) rmSync(link, { recursive: true, force: true });
    // `target` is absolute (derived from resolve()), which junctions require.
    symlinkSync(target, link, LINK_TYPE);
  }

  // Verify the link actually resolves. On Windows a privilege/EPERM failure or
  // a broken junction would otherwise pass silently and break `npm test`; fail
  // loudly here so CI catches the regression.
  if (!existsSync(join(link, "package.json"))) {
    throw new Error(
      `workspace link for ${name} did not resolve (link type "${LINK_TYPE}"). ` +
      `On Windows this usually means junction creation failed.`,
    );
  }
  linked++;
  if (!QUIET) process.stdout.write(`linked ${name} -> packages/${d}\n`);
}

if (linked === 0) {
  throw new Error(`no @devrecap/* workspace packages were linked from ${pkgDir}`);
}
