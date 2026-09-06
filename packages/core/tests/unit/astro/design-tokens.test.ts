import { describe, expect, it } from "vitest";

import { parseDesignMarkdown } from "../../../src/astro/integration/design-tokens.js";

describe("parseDesignMarkdown", () => {
	it("extracts recognized colors and font stacks", () => {
		expect(
			parseDesignMarkdown(`
## Colors
- Primary: #0066cc
- Secondary: #6b7280
- Secondary hover: #4b5563
- Link: #0066cc
- Success: #248a3d
- Warning: #9a6700
- Danger: #d70015
- Background: #ffffff
- Text on primary: #ffffff

## Fonts
- Body: Inter, Arial, sans-serif
- Heading: "Inter", Arial, sans-serif
`),
		).toEqual({
			colors: {
				primary: "#0066cc",
				secondary: "#6b7280",
				secondaryHover: "#4b5563",
				link: "#0066cc",
				success: "#248a3d",
				warning: "#9a6700",
				danger: "#d70015",
				background: "#ffffff",
				onPrimary: "#ffffff",
			},
			fonts: { body: "Inter, Arial, sans-serif", heading: '"Inter", Arial, sans-serif' },
		});
	});

	it("returns empty settings when the document has no recognized values", () => {
		expect(parseDesignMarkdown("# Design\n\nA description only.")).toEqual({});
	});
});
