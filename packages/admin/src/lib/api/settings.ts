/**
 * Site settings APIs
 */

import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

import { API_BASE, apiFetch, parseApiResponse } from "./client.js";

export interface SiteSettings {
	// Identity
	title: string;
	tagline?: string;
	logo?: { mediaId: string; alt?: string; url?: string };
	favicon?: { mediaId: string; url?: string };

	// URLs
	url?: string;

	// Display
	postsPerPage: number;
	dateFormat: string;
	timezone: string;
	theme?: {
		colors?: {
			primary?: string;
			primaryHover?: string;
			secondary?: string;
			secondaryHover?: string;
			background?: string;
			surface?: string;
			text?: string;
			muted?: string;
			border?: string;
			link?: string;
			success?: string;
			warning?: string;
			danger?: string;
			onPrimary?: string;
			onSecondary?: string;
		};
		fonts?: { body?: string; heading?: string };
	};

	// Social
	social?: {
		twitter?: string;
		github?: string;
		facebook?: string;
		instagram?: string;
		linkedin?: string;
		youtube?: string;
	};

	// SEO
	seo?: {
		titleSeparator?: string;
		defaultOgImage?: { mediaId: string; alt?: string; url?: string };
		robotsTxt?: string;
		googleVerification?: string;
		bingVerification?: string;
	};
}

/**
 * Fetch site settings
 */
export async function fetchSettings(): Promise<Partial<SiteSettings>> {
	const response = await apiFetch(`${API_BASE}/settings`);
	return parseApiResponse<Partial<SiteSettings>>(response, i18n._(msg`Failed to fetch settings`));
}

/**
 * Update site settings
 */
export async function updateSettings(
	settings: Partial<SiteSettings>,
): Promise<Partial<SiteSettings>> {
	const response = await apiFetch(`${API_BASE}/settings`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(settings),
	});
	return parseApiResponse<Partial<SiteSettings>>(response, i18n._(msg`Failed to update settings`));
}
