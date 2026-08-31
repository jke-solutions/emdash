import { decryptPluginSecret } from "emdash";
import type { EmailDeliverEvent, PluginContext } from "emdash/plugin";

export interface EmailProviderConfig {
	from?: string;
	apiKey?: string;
}

export type ProviderFetch = (url: string, init?: RequestInit) => Promise<Response>;

export function createProviderHandler(
	config: EmailProviderConfig,
	buildRequest: (event: EmailDeliverEvent, apiKey: string, from: string) => RequestInit,
	endpoint: string,
	providerName: string,
): (event: EmailDeliverEvent, ctx: PluginContext) => Promise<void> {
	return async (event, ctx) => {
		const storedApiKey = config.apiKey ?? (await ctx.kv.get<string>("settings:apiKey"));
		const apiKey = storedApiKey?.startsWith("emdash_plugin_secret_v1_")
			? await decryptPluginSecret(storedApiKey)
			: storedApiKey;
		const from = (await ctx.kv.get<string>("settings:from")) ?? config.from;
		if (!apiKey) {
			throw new Error(`[${providerName}] API key is not configured`);
		}
		if (!from) {
			throw new Error(`[${providerName}] sender email is not configured`);
		}
		if (!ctx.http) {
			throw new Error(`[${providerName}] requires the network:request capability`);
		}

		const response = await ctx.http.fetch(endpoint, buildRequest(event, apiKey, from));
		if (!response.ok) {
			throw new Error(`[${providerName}] email request failed with status ${response.status}`);
		}

		ctx.log.info(`email delivered via ${providerName}`, {
			to: event.message.to,
			subject: event.message.subject,
		});
	};
}

export function jsonRequest(apiKey: string, body: unknown): RequestInit {
	return {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	};
}
