import type { ThemeSettings } from "../../settings/types.js";

const COLOR_RE = /^#[0-9a-f]{6}$/i;
const FONT_RE = /^[a-z0-9 ,.'"-]+$/i;
const ENTRY_RE = /^\s*(?:[-*]|\|)?\s*([^:|]+?)\s*[:|]\s*([^|]+?)\s*(?:\||$)/i;
const HEADING_RE = /^##+\s+(.+?)\s*#*$/;
const NON_WORD_SPACE_RE = /\s+/g;
const MARKDOWN_LINES_RE = /\r?\n/;

const COLOR_KEYS: Record<string, keyof NonNullable<ThemeSettings["colors"]>> = {
	primary: "primary",
	"primary color": "primary",
	"primary hover": "primaryHover",
	"primary hover color": "primaryHover",
	secondary: "secondary",
	"secondary color": "secondary",
	"secondary hover": "secondaryHover",
	"secondary hover color": "secondaryHover",
	background: "background",
	"background color": "background",
	surface: "surface",
	"surface color": "surface",
	text: "text",
	"text color": "text",
	muted: "muted",
	"muted text": "muted",
	"muted text color": "muted",
	border: "border",
	"border color": "border",
	link: "link",
	"link color": "link",
	success: "success",
	"success color": "success",
	warning: "warning",
	"warning color": "warning",
	danger: "danger",
	"danger color": "danger",
	"on primary": "onPrimary",
	"text on primary": "onPrimary",
	"on secondary": "onSecondary",
	"text on secondary": "onSecondary",
};

const FONT_KEYS: Record<string, keyof NonNullable<ThemeSettings["fonts"]>> = {
	body: "body",
	"body font": "body",
	"body font stack": "body",
	heading: "heading",
	"heading font": "heading",
	"heading font stack": "heading",
};

function normalizeKey(value: string): string {
	return value.toLowerCase().replace(/[*_`]/g, "").replace(NON_WORD_SPACE_RE, " ").trim();
}

/** Parses the optional project design.md file during the Vite build. */
export function parseDesignMarkdown(markdown: string): ThemeSettings {
	const colors: NonNullable<ThemeSettings["colors"]> = {};
	const fonts: NonNullable<ThemeSettings["fonts"]> = {};
	let section: "colors" | "fonts" | null = null;

	for (const line of markdown.split(MARKDOWN_LINES_RE)) {
		const heading = line.match(HEADING_RE);
		if (heading) {
			const name = normalizeKey(heading[1] ?? "");
			section =
				name === "colors" || name === "colores"
					? "colors"
					: name === "fonts" || name === "fuentes"
						? "fonts"
						: null;
			continue;
		}
		if (!section) continue;
		const entry = line.match(ENTRY_RE);
		if (!entry) continue;
		const key = normalizeKey(entry[1] ?? "");
		const value = (entry[2] ?? "").trim();
		if (section === "colors") {
			const target = COLOR_KEYS[key];
			if (target && COLOR_RE.test(value)) colors[target] = value;
		} else {
			const target = FONT_KEYS[key];
			if (target && FONT_RE.test(value)) fonts[target] = value;
		}
	}

	return {
		...(Object.keys(colors).length > 0 ? { colors } : {}),
		...(Object.keys(fonts).length > 0 ? { fonts } : {}),
	};
}
