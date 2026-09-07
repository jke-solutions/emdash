import type { APIRoute } from "astro";

import { requirePerm } from "#api/authorize.js";
import { handleError, requireDb, unwrapResult } from "#api/error.js";
import { handleShopReservationUpdate } from "#api/handlers/booking.js";
import { isParseError, parseBody } from "#api/parse.js";
import { shopReservationUpdateBody } from "#api/schemas.js";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals, params }) => {
	const denied = requirePerm(locals.user, "shop:manage");
	if (denied) return denied;
	const dbError = requireDb(locals.emdash?.db);
	if (dbError) return dbError;
	try {
		const body = await parseBody(request, shopReservationUpdateBody);
		if (isParseError(body)) return body;
		return unwrapResult(
			await handleShopReservationUpdate(
				locals.emdash.db,
				params.id ?? "",
				body.status,
				body.startsAt,
				body.endsAt,
			),
		);
	} catch (error) {
		return handleError(error, "Failed to update reservation", "SHOP_RESERVATION_UPDATE_ERROR");
	}
};
