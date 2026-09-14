export interface EmailBrandingSettings {
	title?: string;
	logo?: { alt?: string; url?: string };
	theme?: {
		colors?: {
			primary?: string;
			background?: string;
			surface?: string;
			text?: string;
			onPrimary?: string;
		};
		fonts?: { body?: string };
	};
}

export interface EmailBrandingValues {
	logoUrl?: string;
	logoAlt: string;
	siteName: string;
	primary: string;
	background: string;
	surface: string;
	text: string;
	onPrimary: string;
	font: string;
}

export const DEFAULT_EMAIL_BRANDING: EmailBrandingValues = {
	logoAlt: "",
	siteName: "",
	primary: "#000000",
	background: "#f4f4f5",
	surface: "#ffffff",
	text: "#18181b",
	onPrimary: "#ffffff",
	font: "Arial, Helvetica, sans-serif",
};

const BRANDING_HEADER_RE = /<div data-emdash-email-branding="true"[^>]*>[\s\S]*?<\/div>/i;
const BODY_TAG_RE = /<body\b[^>]*>/i;
const STYLE_ATTRIBUTE_RE = /\bstyle="([^"]*)"/i;
const STYLE_ATTRIBUTE_ANY_RE = /\bstyle="[^"]*"/i;
const BRANDING_STYLE_PROPERTIES_RE = /(?:background-color|color|font-family):[^;]*;?/gi;
const TAG_END_RE = />$/;

export function resolveEmailBranding(
	settings?: EmailBrandingSettings,
): EmailBrandingValues {
	const colors = settings?.theme?.colors;
	return {
		logoUrl: settings?.logo?.url,
		logoAlt: settings?.logo?.alt || settings?.title || "",
		siteName: settings?.title || "",
		primary: colors?.primary ?? DEFAULT_EMAIL_BRANDING.primary,
		background: colors?.background ?? DEFAULT_EMAIL_BRANDING.background,
		surface: colors?.surface ?? DEFAULT_EMAIL_BRANDING.surface,
		text: colors?.text ?? DEFAULT_EMAIL_BRANDING.text,
		onPrimary: colors?.onPrimary ?? DEFAULT_EMAIL_BRANDING.onPrimary,
		font: settings?.theme?.fonts?.body ?? DEFAULT_EMAIL_BRANDING.font,
	};
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>'"]/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"'": "&#39;",
			'"': "&quot;",
		};
		return entities[character] ?? character;
	});
}

/** Applies current site colors and typography to generated email HTML. */
export function applyEmailBranding(
	html: string,
	branding: EmailBrandingValues,
): string {
	const withoutPreviousHeader = html.replace(BRANDING_HEADER_RE, "");
	if (!BODY_TAG_RE.test(withoutPreviousHeader)) return withoutPreviousHeader;
	return withoutPreviousHeader.replace(BODY_TAG_RE, (tag) => {
		const existingStyle = (tag.match(STYLE_ATTRIBUTE_RE)?.[1] ?? "").replace(
			BRANDING_STYLE_PROPERTIES_RE,
			"",
		);
		const style = `${existingStyle}${existingStyle && !existingStyle.endsWith(";") ? ";" : ""}background-color:${branding.background};color:${branding.text};font-family:${branding.font};`;
		const styledTag = STYLE_ATTRIBUTE_ANY_RE.test(tag)
			? tag.replace(STYLE_ATTRIBUTE_ANY_RE, `style="${escapeHtml(style)}"`)
			: tag.replace(TAG_END_RE, ` style="${escapeHtml(style)}">`);
		return styledTag;
	});
}
