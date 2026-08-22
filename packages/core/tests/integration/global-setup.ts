import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(execFile);
const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../../..");
const PNPM_COMMAND = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

export default async function setupIntegrationBuild(): Promise<void> {
	console.log("[integration] Running pnpm build...");
	await execAsync(PNPM_COMMAND, ["build"], {
		cwd: WORKSPACE_ROOT,
		shell: process.platform === "win32",
		timeout: 120_000,
	});
	console.log("[integration] Build complete.");
}
