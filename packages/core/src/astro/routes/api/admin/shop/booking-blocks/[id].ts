import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopBookingBlockDelete } from "#api/handlers/booking.js";

export const prerender = false;

export const DELETE: APIRoute = async ({ locals, params }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		return unwrapResult(await handleShopBookingBlockDelete(locals.emdash.db, params.id ?? ""));
	} catch (error) {
		return handleError(error, "Failed to delete booking block", "SHOP_BOOKING_BLOCK_DELETE_ERROR");
	}
};
