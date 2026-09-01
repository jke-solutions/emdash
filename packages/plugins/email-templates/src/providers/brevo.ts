import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

import { version } from "../../package.json";
import { createProviderHandler, jsonRequest, type EmailProviderConfig } from "./http.js";

export interface BrevoEmailConfig extends EmailProviderConfig {}

export function createBrevoEmailDeliver(config: BrevoEmailConfig) {
	return createProviderHandler(
		config,
		(event, apiKey, from) =>
			jsonRequest(apiKey, {
				sender: { email: from },
				to: [{ email: event.message.to }],
				subject: event.message.subject,
				textContent: event.message.text,
				...(event.message.html ? { htmlContent: event.message.html } : {}),
			}),
		"https://api.brevo.com/v3/smtp/email",
		"brevo-email",
	);
}

export function createPlugin(config: BrevoEmailConfig): ResolvedPlugin {
	return definePlugin({
		id: "brevo-email",
		version,
		capabilities: ["hooks.email-transport:register", "network:request"],
		allowedHosts: ["api.brevo.com"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: createBrevoEmailDeliver(config),
			},
		},
		admin: {
			settingsSchema: {
				apiKey: { type: "secret", label: "Brevo API key", encrypted: true },
				from: { type: "email", label: "Sender email" },
			},
		},
	});
}

export function brevoEmail(config: BrevoEmailConfig = {}): PluginDescriptor<BrevoEmailConfig> {
	return {
		id: "brevo-email",
		version,
		entrypoint: "@emdash-cms/plugin-email-templates/providers/brevo",
		format: "native",
		options: config,
		capabilities: ["hooks.email-transport:register", "network:request"],
		allowedHosts: ["api.brevo.com"],
	};
}

export default brevoEmail;
