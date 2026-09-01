import { definePlugin, type PluginDescriptor, type ResolvedPlugin } from "emdash";
import type { EmailDeliverEvent, PluginContext } from "emdash/plugin";

import { version } from "../../package.json";

export async function localEmailDeliver(
	event: EmailDeliverEvent,
	ctx: PluginContext,
): Promise<void> {
	ctx.log.info("email captured by local-email", {
		to: event.message.to,
		subject: event.message.subject,
		text: event.message.text,
		html: event.message.html,
	});
}

export function createPlugin(): ResolvedPlugin {
	return definePlugin({
		id: "local-email",
		version,
		capabilities: ["hooks.email-transport:register"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: localEmailDeliver,
			},
		},
	});
}

export function localEmail(): PluginDescriptor<Record<string, never>> {
	return {
		id: "local-email",
		version,
		entrypoint: "@emdash-cms/plugin-email-templates/providers/local",
		format: "native",
		options: {},
		capabilities: ["hooks.email-transport:register"],
	};
}

export default localEmail;
