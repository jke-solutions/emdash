import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

import { version } from "../../package.json";
import { createProviderHandler, jsonRequest, type EmailProviderConfig } from "./http.js";

export interface ResendEmailConfig extends EmailProviderConfig {}

export function createResendEmailDeliver(config: ResendEmailConfig) {
	return createProviderHandler(
		config,
		(event, apiKey, from) =>
			jsonRequest(apiKey, {
				from,
				to: event.message.to,
				subject: event.message.subject,
				text: event.message.text,
				...(event.message.html ? { html: event.message.html } : {}),
			}),
		"https://api.resend.com/emails",
		"resend-email",
	);
}

export function createPlugin(config: ResendEmailConfig): ResolvedPlugin {
	return definePlugin({
		id: "resend-email",
		version,
		capabilities: ["hooks.email-transport:register", "network:request"],
		allowedHosts: ["api.resend.com"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: createResendEmailDeliver(config),
			},
		},
		admin: {
			settingsSchema: {
				apiKey: { type: "secret", label: "Resend API key", encrypted: true },
				from: { type: "email", label: "Sender email" },
			},
		},
	});
}

export function resendEmail(config: ResendEmailConfig = {}): PluginDescriptor<ResendEmailConfig> {
	return {
		id: "resend-email",
		version,
		entrypoint: "@emdash-cms/plugin-email-templates/providers/resend",
		format: "native",
		options: config,
		capabilities: ["hooks.email-transport:register", "network:request"],
		allowedHosts: ["api.resend.com"],
	};
}

export default resendEmail;
