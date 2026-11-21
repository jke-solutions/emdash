import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOP_LEVEL_KEY = /^\S/m;
const CATALOG_ENTRY = /^  "?([@\w./-]+)"?:\s+(\S+)/;

type Manifest = {
	name: string;
	version: string;
	files?: string[];
	workspaces?: string[];
	devDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	scripts?: Record<string, string>;
};

function readManifest(directory: string): Manifest {
	return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

function writeManifest(directory: string, manifest: Manifest): void {
	writeFileSync(join(directory, "package.json"), JSON.stringify(manifest, null, "\t") + "\n");
}

export function scaffoldEcommerce(variant: string, destination: string): void {
	const root = fileURLToPath(new URL("../../../", import.meta.url));
	const template = join(root, "templates", variant);
	const workspacePath = join(root, "pnpm-workspace.yaml");
	if (!existsSync(workspacePath) || !existsSync(template)) {
		throw new Error("Run the Ecommerce generator from a built checkout of the EmDash fork.");
	}

	const catalog = new Map<string, string>();
	const workspace = readFileSync(workspacePath, "utf8");
	const lines = workspace.split("\ncatalog:\n")[1]?.split(TOP_LEVEL_KEY)[0]?.split("\n") ?? [];
	for (const line of lines) {
		const entry = CATALOG_ENTRY.exec(line);
		if (entry) catalog.set(entry[1], entry[2]);
	}

	const packages = new Map<string, { manifest: Manifest; directory: string }>();
	for (const parent of ["packages", "packages/plugins"]) {
		for (const entry of readdirSync(join(root, parent))) {
			const directory = join(root, parent, entry);
			if (!existsSync(join(directory, "package.json"))) continue;
			const manifest = readManifest(directory);
			packages.set(manifest.name, { manifest, directory });
		}
	}

	const vendored = new Map<string, { manifest: Manifest; directory: string }>();
	function resolveDependencies(manifest: Manifest): void {
		for (const dependencies of [
			manifest.dependencies,
			manifest.peerDependencies,
			manifest.optionalDependencies,
			manifest.devDependencies,
		]) {
			if (!dependencies) continue;
			for (const [name, specifier] of Object.entries(dependencies)) {
				if (specifier === "catalog:") {
					const version = catalog.get(name);
					if (!version) throw new Error(`Missing catalog version for ${name}`);
					dependencies[name] = version;
				} else if (specifier.startsWith("workspace:")) {
					const pkg = packages.get(name);
					if (!pkg) throw new Error(`Missing workspace package ${name}`);
					dependencies[name] = pkg.manifest.version;
					if (!vendored.has(name)) {
						vendored.set(name, pkg);
						delete pkg.manifest.devDependencies;
						delete pkg.manifest.scripts;
						resolveDependencies(pkg.manifest);
					}
				}
			}
		}
	}

	const project = readManifest(template);
	resolveDependencies(project);
	project.workspaces = Array.from(vendored.keys(), (name) => `vendor/${name}`);
	for (const { manifest, directory } of vendored.values()) {
		for (const file of manifest.files ?? []) {
			if (!existsSync(resolve(directory, file))) {
				throw new Error(`Missing ${manifest.name}/${file}. Run pnpm build in the fork first.`);
			}
		}
	}

	mkdirSync(destination, { recursive: true });
	for (const file of [
		"src",
		"seed",
		"astro.config.mjs",
		"tsconfig.json",
		"emdash-env.d.ts",
		"wrangler.jsonc",
	]) {
		const source = join(template, file);
		if (existsSync(source)) cpSync(source, join(destination, file), { recursive: true });
	}
	for (const [name, { manifest, directory }] of vendored) {
		const target = join(destination, "vendor", name);
		mkdirSync(target, { recursive: true });
		for (const file of manifest.files ?? []) {
			cpSync(join(directory, file), join(target, file), { recursive: true });
		}
		cpSync(join(root, "LICENSE"), join(target, "LICENSE"));
		writeManifest(target, manifest);
	}
	writeManifest(destination, project);
}
