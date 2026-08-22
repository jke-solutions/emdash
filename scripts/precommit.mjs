import { execFileSync, spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const CODE_FILE = /\.(?:[cm]?[jt]sx?|astro)$/;
const OXFMT_FILE = /\.(?:[cm]?[jt]sx?|jsonc?|css)$/;
const stagedFiles = execFileSync("git", [
	"diff",
	"--cached",
	"--name-only",
	"--diff-filter=ACMR",
	"-z",
])
	.toString()
	.split("\0")
	.filter(Boolean);

if (stagedFiles.length === 0) process.exit(0);

const isCode = (file) => CODE_FILE.test(file);
const isOxfmtFile = (file) => OXFMT_FILE.test(file);

const run = (args) => {
	const result = spawnSync(pnpm, ["exec", ...args], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
};

const oxfmtFiles = stagedFiles.filter(isOxfmtFile);
if (oxfmtFiles.length > 0) {
	console.log("Checking staged files with oxfmt...");
	run(["oxfmt", "--check", "--ignore-path", ".gitignore", ...oxfmtFiles]);
}

console.log("Checking staged files with Prettier...");
run(["prettier", "--check", ...stagedFiles]);

const lintFiles = stagedFiles.filter(isCode);
if (lintFiles.length > 0) {
	console.log("Linting staged files...");
	run(["oxlint", "--type-aware", "--deny-warnings", ...lintFiles]);
}
