import { execFileSync } from "node:child_process";

try {
	execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
	execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
		stdio: "inherit",
	});
} catch {
	// Installs outside a Git checkout do not need local hooks.
}
