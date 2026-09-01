/**
 * Email Templates Plugin for EmDash CMS.
 *
 * The plugin is opt-in. It contributes no routes, storage, or admin pages
 * until enabled in the host configuration.
 */

import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

import { version } from "../package.json";
export {
	DEFAULT_EMAIL_BLOCKS,
	DEFAULT_EMAIL_EDITOR_CONFIG,
	EMAIL_SAFE_FONTS,
	applyEmailSafeFont,
} from "./editor-config.js";
export { fetchEmailMedia } from "./media.js";
export type { EmailMediaItem } from "./media.js";
export type {
	EmailBlockCategory,
	EmailBlockDefinition,
	EmailBlockType,
	EmailEditorConfig,
	EmailEditorTheme,
	EmailFontDefinition,
	EmailLayoutNode,
} from "./editor-config.js";
import {
	createTemplateHandler,
	deleteTemplateHandler,
	getTemplateHandler,
	listTemplatesHandler,
	sendTemplateHandler,
	templateCreateSchema,
	templateIdSchema,
	templateSendSchema,
	templateUpdateSchema,
	updateTemplateHandler,
} from "./templates.js";

export { brevoEmail } from "./providers/brevo.js";
export type { BrevoEmailConfig } from "./providers/brevo.js";
export { resendEmail } from "./providers/resend.js";
export type { ResendEmailConfig } from "./providers/resend.js";
export { localEmail } from "./providers/local.js";

export interface EmailTemplatesPluginOptions {
	/** Enables template management for this site. Defaults to false. */
	enabled?: boolean;
	/** Enables campaign/newsletter features. Defaults to false. */
	campaignsEnabled?: boolean;
	/** Prefix used for objects stored by the plugin. */
	storagePrefix?: string;
}

const DEFAULT_STORAGE_PREFIX = "email-templates";

function isEnabled(options: EmailTemplatesPluginOptions): boolean {
	return options.enabled === true;
}

export function createPlugin(options: EmailTemplatesPluginOptions = {}): ResolvedPlugin {
	if (!isEnabled(options)) {
		return definePlugin({
			id: "email-templates",
			version,
		});
	}

	return definePlugin({
		id: "email-templates",
		version,
		storage: {
			templates: {
				indexes: ["status", "createdAt", "updatedAt"],
				uniqueIndexes: ["slug"],
			},
		},
		routes: {
			"templates/list": { permission: "settings:manage", handler: listTemplatesHandler },
			"templates/get": {
				permission: "settings:manage",
				input: templateIdSchema,
				handler: getTemplateHandler as never,
			},
			"templates/create": {
				permission: "settings:manage",
				input: templateCreateSchema,
				handler: createTemplateHandler as never,
			},
			"templates/update": {
				permission: "settings:manage",
				input: templateUpdateSchema,
				handler: updateTemplateHandler as never,
			},
			"templates/delete": {
				permission: "settings:manage",
				input: templateIdSchema,
				handler: deleteTemplateHandler as never,
			},
			"templates/send": {
				permission: "settings:manage",
				input: templateSendSchema,
				handler: sendTemplateHandler as never,
			},
		},
		admin: {
			entry: "@emdash-cms/plugin-email-templates/admin",
			pages: [{ path: "/", label: "Email Templates", icon: "mail" }],
			settingsSchema: {
				campaignsEnabled: {
					type: "boolean",
					label: "Enable email campaigns",
				},
				defaultSenderName: {
					type: "string",
					label: "Default sender name",
				},
				supportEmail: {
					type: "email",
					label: "Support email",
				},
				siteName: {
					type: "string",
					label: "Site name",
				},
				websiteUrl: {
					type: "url",
					label: "Website URL",
				},
				facebookUrl: {
					type: "url",
					label: "Facebook URL",
				},
				instagramUrl: {
					type: "url",
					label: "Instagram URL",
				},
				xUrl: {
					type: "url",
					label: "X URL",
				},
				githubUrl: {
					type: "url",
					label: "GitHub URL",
				},
				linkedinUrl: {
					type: "url",
					label: "LinkedIn URL",
				},
				youtubeUrl: {
					type: "url",
					label: "YouTube URL",
				},
			},
		},
	});
}

export function emailTemplatesPlugin(
	options: EmailTemplatesPluginOptions = {},
): PluginDescriptor<EmailTemplatesPluginOptions> {
	const storagePrefix = options.storagePrefix ?? DEFAULT_STORAGE_PREFIX;

	return {
		id: "email-templates",
		version,
		entrypoint: "@emdash-cms/plugin-email-templates",
		options: {
			...options,
			storagePrefix,
			campaignsEnabled: options.campaignsEnabled === true,
			enabled: options.enabled === true,
		},
		...(isEnabled(options)
			? {
					adminEntry: "@emdash-cms/plugin-email-templates/admin",
					adminPages: [{ path: "/", label: "Email Templates", icon: "mail" }],
				}
			: {}),
	};
}

export default emailTemplatesPlugin;
