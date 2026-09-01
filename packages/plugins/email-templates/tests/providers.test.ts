import { describe, expect, it, vi } from "vitest";

import { createBrevoEmailDeliver } from "../src/providers/brevo.js";
import { localEmailDeliver } from "../src/providers/local.js";
import { createResendEmailDeliver } from "../src/providers/resend.js";

function createContext(fetch: typeof globalThis.fetch, apiKey = "stored-key") {
	return {
		kv: { get: vi.fn(async (key: string) => (key === "settings:apiKey" ? apiKey : null)) },
		http: { fetch },
		log: { info: vi.fn() },
	} as never;
}

const event = {
	message: {
		to: "person@example.com",
		subject: "Welcome",
		text: "Welcome to the site",
		html: "<p>Welcome to the site</p>",
	},
	source: "system",
};

describe("email provider transports", () => {
	it("creates the Resend request from the email message", async () => {
		const fetch = vi.fn(
			async (_url: string, init?: RequestInit) =>
				new Response(null, { status: 200, headers: init?.headers }),
		);
		await createResendEmailDeliver({ from: "cms@example.com" })(event, createContext(fetch));

		expect(fetch).toHaveBeenCalledWith(
			"https://api.resend.com/emails",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({ Authorization: "Bearer stored-key" }),
				body: JSON.stringify({
					from: "cms@example.com",
					to: "person@example.com",
					subject: "Welcome",
					text: "Welcome to the site",
					html: "<p>Welcome to the site</p>",
				}),
			}),
		);
	});

	it("creates the Brevo request with its API shape", async () => {
		const fetch = vi.fn(async () => new Response(null, { status: 201 }));
		await createBrevoEmailDeliver({ from: "cms@example.com", apiKey: "brevo-key" })(
			event,
			createContext(fetch),
		);

		expect(fetch).toHaveBeenCalledWith(
			"https://api.brevo.com/v3/smtp/email",
			expect.objectContaining({
				body: JSON.stringify({
					sender: { email: "cms@example.com" },
					to: [{ email: "person@example.com" }],
					subject: "Welcome",
					textContent: "Welcome to the site",
					htmlContent: "<p>Welcome to the site</p>",
				}),
			}),
		);
	});

	it("fails before making a request when no API key exists", async () => {
		const fetch = vi.fn(async () => new Response(null, { status: 200 }));
		const context = createContext(fetch, "");

		await expect(
			createResendEmailDeliver({ from: "cms@example.com" })(event, context),
		).rejects.toThrow("API key is not configured");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("captures local email messages without making a network request", async () => {
		const context = createContext(vi.fn());

		await localEmailDeliver(event, context);

		expect((context as { log: { info: ReturnType<typeof vi.fn> } }).log.info).toHaveBeenCalledWith(
			"email captured by local-email",
			expect.objectContaining({ to: "person@example.com", subject: "Welcome" }),
		);
	});
});
