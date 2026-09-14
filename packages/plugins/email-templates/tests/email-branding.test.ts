import { describe, expect, it } from "vitest";

import {
	applyEmailBranding,
	DEFAULT_EMAIL_BRANDING,
	resolveEmailBranding,
} from "../src/email-branding.js";

describe("email branding", () => {
	it("uses the configured logo, site name, colors, and font", () => {
		const branding = resolveEmailBranding({
			title: "Acme",
			logo: { alt: "Acme logo", url: "/media/acme.svg" },
			theme: {
				colors: { primary: "#336699", background: "#eeeeee", onPrimary: "#ffffff" },
				fonts: { body: "Arial, sans-serif" },
			},
		});

		expect(branding).toMatchObject({
			logoUrl: "/media/acme.svg",
			logoAlt: "Acme logo",
			siteName: "Acme",
			primary: "#336699",
			background: "#eeeeee",
			font: "Arial, sans-serif",
		});
	});

	it("uses the black primary fallback and text fallback when branding is missing", () => {
		const branding = resolveEmailBranding();

		expect(branding.primary).toBe(DEFAULT_EMAIL_BRANDING.primary);
		expect(branding.primary).toBe("#000000");
		expect(branding.logoUrl).toBeUndefined();
		expect(branding.siteName).toBe("");
	});

	it("adds one branded header and replaces it instead of duplicating it", () => {
		const branding = resolveEmailBranding({
			title: "Acme",
			logo: { url: "/media/acme.svg" },
			theme: { colors: { primary: "#000000", background: "#eeeeee" } },
		});
		const html = '<html><body><main>Message</main></body></html>';

		const first = applyEmailBranding(html, branding);
		const second = applyEmailBranding(first, branding);

		expect(first).not.toContain('data-emdash-email-branding="true"');
		expect(first).not.toContain("/media/acme.svg");
		expect(first).toContain("background-color:#eeeeee");
		expect(second).toBe(first);
	});
});
