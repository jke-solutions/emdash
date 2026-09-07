import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopBookingHoursGet, handleShopBookingHoursUpdate } from "#api/handlers/booking.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopBookingHoursUpdateBody } from "#api/schemas.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	const serviceId = url.searchParams.get("serviceId");
	if (!serviceId)
		return new Response(
			JSON.stringify({
				success: false,
				error: { code: "VALIDATION_ERROR", message: "serviceId is required" },
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	try {
		return unwrapResult(await handleShopBookingHoursGet(locals.emdash.db, serviceId));
	} catch (error) {
		return handleError(error, "Failed to get booking hours", "SHOP_BOOKING_HOURS_ERROR");
	}
};

export const PUT: APIRoute = async ({ request, locals }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopBookingHoursUpdateBody);
		if (isParseError(body)) return body;
		return unwrapResult(await handleShopBookingHoursUpdate(locals.emdash.db, body));
	} catch (error) {
		return handleError(error, "Failed to update booking hours", "SHOP_BOOKING_HOURS_UPDATE_ERROR");
	}
};
