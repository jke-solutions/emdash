import { fileURLToPath } from "node:url";

import node from "@astrojs/node";
import react from "@astrojs/react";
import {
	brevoEmail,
	emailTemplatesPlugin,
	localEmail,
	resendEmail,
} from "@emdash-cms/plugin-email-templates";
import { mcpSmokePlugin } from "@emdash-cms/plugin-mcp-smoke";
import { defineConfig, fontProviders, passthroughImageService } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

if (globalThis.process?.env) {
	globalThis.process.env.EMDASH_ADMIN_SOURCE ??= "0";
}

const entitiesDecode = fileURLToPath(
	new URL(
		"../../node_modules/.pnpm/entities@6.0.1/node_modules/entities/dist/esm/decode.js",
		import.meta.url,
	),
);

export default defineConfig({
	output: "server",
	vite: {
		optimizeDeps: {
			include: [
				"@cloudflare/kumo",
				"@react-email/editor",
				"@react-email/editor-extensions",
				"@react-email/editor-plugins",
				"@react-email/render",
			],
		},
		resolve: {
			alias: {
				"entities/decode": entitiesDecode,
				"entities/lib/decode.js": entitiesDecode,
			},
		},
	},
	adapter: node({
		mode: "standalone",
	}),
	image: {
		layout: "constrained",
		responsiveStyles: true,
		service: passthroughImageService(),
	},
	integrations: [
		react(),
		emdash({
			shop: { enabled: true },
			database: sqlite({ url: "file:./data.db" }),
			storage: local({
				directory: "./uploads",
				baseUrl: "/_emdash/api/media/file",
			}),
			storageQuota: 1024 * 1024 * 1024,
			plugins: [
				mcpSmokePlugin(),
				emailTemplatesPlugin({ enabled: true }),
				localEmail(),
				resendEmail(),
				brevoEmail(),
			],
		}),
	],
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-sans",
			weights: [400, 500, 600, 700],
			fallbacks: ["sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-mono",
			weights: [400, 500],
			fallbacks: ["monospace"],
		},
	],
	devToolbar: { enabled: false },
});
