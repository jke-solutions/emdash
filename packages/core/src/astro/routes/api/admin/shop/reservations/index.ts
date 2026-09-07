import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopReservationList } from "#api/handlers/booking.js";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
	const denied = requirePerm(locals.user, "shop:read");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		return unwrapResult(
			await handleShopReservationList(
				locals.emdash.db,
				url.searchParams.get("status") ?? undefined,
			),
		);
	} catch (error) {
		return handleError(error, "Failed to list reservations", "SHOP_RESERVATIONS_ERROR");
	}
};
