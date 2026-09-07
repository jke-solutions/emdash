import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopBookingAvailability } from "#api/handlers/booking.js";
import { shopBookingAvailabilityQuery } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, params, url }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	const parsed = shopBookingAvailabilityQuery.safeParse({
		date: url.searchParams.get("date"),
		locale: url.searchParams.get("locale") ?? undefined,
	});
	if (!parsed.success)
		return new Response(
			JSON.stringify({
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid availability query" },
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	try {
		return unwrapResult(
			await handleShopBookingAvailability(
				locals.emdash.db,
				params.id ?? "",
				parsed.data.date,
				parsed.data.locale,
			),
		);
	} catch (error) {
		return handleError(
			error,
			"Failed to get booking availability",
			"SHOP_BOOKING_AVAILABILITY_ERROR",
		);
	}
};
