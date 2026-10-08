import { buildProgram } from "./program.js";
export async function runCli(argv = process.argv) {
    const program = buildProgram();
    await program.parseAsync([...argv]);
}
//# sourceMappingURL=run.js.map