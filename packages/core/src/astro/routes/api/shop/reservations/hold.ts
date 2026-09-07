import type { APIRoute } from "astro";

import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopBookingHold } from "#api/handlers/booking.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopBookingHoldBody } from "#api/schemas.js";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopBookingHoldBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopBookingHold(locals.emdash.db, body));
	} catch (error) {
		return handleError(error, "Failed to hold booking", "SHOP_BOOKING_HOLD_ERROR");
	}
};
