import type { Kysely } from "kysely";
import { ulid } from "ulidx";

import { ContentRepository } from "../../database/repositories/content.js";
import { withTransaction } from "../../database/transaction.js";
import type { Database } from "../../database/types.js";
import type { ApiResult } from "../types.js";

const DEFAULT_LOCALE = "es";
const ACTIVE_RESERVATION_STATUSES = ["held", "pending_payment", "confirmed"] as const;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export interface ShopBookingSlot {
	startsAt: string;
	endsAt: string;
	remainingCapacity: number;
}

export interface ShopBookingHoldInput {
	serviceId: string;
	startsAt: string;
	endsAt: string;
	locale?: string;
}

export interface ShopBookingHold {
	id: string;
	serviceId: string;
	startsAt: string;
	endsAt: string;
	status: "held";
	expiresAt: string;
}

export interface ShopBookingHour {
	id: string;
	serviceId: string;
	weekday: number;
	startsAt: string;
	endsAt: string;
	validFrom: string | null;
	validUntil: string | null;
	active: boolean;
}

export interface ShopBookingHoursUpdateInput {
	serviceId: string;
	hours: Array<{ weekday: number; startsAt: string; endsAt: string }>;
	validFrom?: string | null;
	validUntil?: string | null;
}

export interface ShopReservationSummary {
	id: string;
	serviceId: string;
	orderId: string | null;
	orderItemId: string | null;
	startsAt: string;
	endsAt: string;
	status: string;
	expiresAt: string | null;
	customerName: string | null;
	serviceName: string | null;
	createdAt: string | null;
}

export interface ShopBookingBlock {
	id: string;
	serviceId: string | null;
	startsAt: string;
	endsAt: string;
	reason: string | null;
}

function isService(data: Record<string, unknown>): boolean {
	const itemType = typeof data.item_type === "string" ? data.item_type.toLowerCase() : "";
	const requiresBooking = data.requires_booking;
	return (
		itemType === "service" &&
		(requiresBooking === true ||
			requiresBooking === 1 ||
			requiresBooking === "1" ||
			requiresBooking === "true")
	);
}

function positiveInteger(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseTime(value: string): number | null {
	const match = TIME_PATTERN.exec(value);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

function validRange(startsAt: string, endsAt: string): boolean {
	const start = parseTime(startsAt);
	const end = parseTime(endsAt);
	return start !== null && end !== null && end > start;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotName(value: string | null, key: string): string | null {
	if (!value) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		if (!isRecord(parsed)) return null;
		const name = parsed[key];
		return typeof name === "string" ? name : null;
	} catch {
		return null;
	}
}

function toSlot(date: string, minutes: number, duration: number): ShopBookingSlot {
	const startsAt = new Date(`${date}T00:00:00.000Z`);
	startsAt.setUTCMinutes(minutes);
	const endsAt = new Date(startsAt.getTime() + duration * 60_000);
	return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), remainingCapacity: 0 };
}

async function getService(
	db: Kysely<Database>,
	serviceId: string,
	locale = DEFAULT_LOCALE,
): Promise<{ id: string; data: Record<string, unknown>; name: string } | null> {
	const service = await new ContentRepository(db).findByIdOrSlug("services", serviceId, locale);
	if (!service || !isService(service.data)) return null;
	const name =
		typeof service.data.name === "string" ? service.data.name : (service.slug ?? service.id);
	return { id: service.id, data: service.data, name };
}

async function countReservations(
	db: Kysely<Database>,
	serviceId: string,
	startsAt: string,
	endsAt: string,
	now: string,
): Promise<number> {
	const row = await db
		.selectFrom("_emdash_shop_reservations")
		.select(({ fn }) => fn.countAll<number>().as("count"))
		.where("service_id", "=", serviceId)
		.where("starts_at", "<", endsAt)
		.where("ends_at", ">", startsAt)
		.where("status", "in", [...ACTIVE_RESERVATION_STATUSES])
		.where((eb) => eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]))
		.executeTakeFirst();
	return Number(row?.count ?? 0);
}

export async function handleShopBookingAvailability(
	db: Kysely<Database>,
	serviceId: string,
	date: string,
	locale = DEFAULT_LOCALE,
): Promise<ApiResult<ShopBookingSlot[]>> {
	try {
		const settings = await db
			.selectFrom("_emdash_shop_settings")
			.select("booking_enabled")
			.where("id", "=", "default")
			.executeTakeFirst();
		if (settings?.booking_enabled !== 1) return { success: true, data: [] };

		const service = await getService(db, serviceId, locale);
		if (!service)
			return { success: false, error: { code: "NOT_FOUND", message: "Service not found" } };
		const duration = positiveInteger(service.data.duration_minutes, 60);
		const capacity = positiveInteger(service.data.service_capacity, 1);
		const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
		const hours = await db
			.selectFrom("_emdash_shop_booking_hours")
			.select(["starts_at", "ends_at", "valid_from", "valid_until"])
			.where("service_id", "=", service.id)
			.where("weekday", "=", weekday)
			.where("active", "=", 1)
			.where((eb) => eb.or([eb("valid_from", "is", null), eb("valid_from", "<=", date)]))
			.where((eb) => eb.or([eb("valid_until", "is", null), eb("valid_until", ">=", date)]))
			.orderBy("starts_at")
			.execute();
		if (hours.length === 0) return { success: true, data: [] };

		const dayStart = `${date}T00:00:00.000Z`;
		const dayEnd = `${date}T23:59:59.999Z`;
		const blocks = await db
			.selectFrom("_emdash_shop_booking_blocks")
			.select(["starts_at", "ends_at"])
			.where((eb) => eb.or([eb("service_id", "=", service.id), eb("service_id", "is", null)]))
			.where("starts_at", "<", dayEnd)
			.where("ends_at", ">", dayStart)
			.execute();
		const now = new Date().toISOString();
		const slots: ShopBookingSlot[] = [];
		for (const range of hours) {
			const start = parseTime(range.starts_at);
			const end = parseTime(range.ends_at);
			if (start === null || end === null || end <= start) continue;
			for (let minutes = start; minutes + duration <= end; minutes += duration) {
				const slot = toSlot(date, minutes, duration);
				if (slot.startsAt <= now) continue;
				if (blocks.some((block) => block.starts_at < slot.endsAt && block.ends_at > slot.startsAt))
					continue;
				const used = await countReservations(db, service.id, slot.startsAt, slot.endsAt, now);
				if (used < capacity) slots.push({ ...slot, remainingCapacity: capacity - used });
			}
		}
		return { success: true, data: slots };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_BOOKING_AVAILABILITY_ERROR", message: "Failed to get availability" },
		};
	}
}

export async function handleShopBookingHoursGet(
	db: Kysely<Database>,
	serviceId: string,
): Promise<ApiResult<ShopBookingHour[]>> {
	try {
		const rows = await db
			.selectFrom("_emdash_shop_booking_hours")
			.selectAll()
			.where("service_id", "=", serviceId)
			.orderBy("weekday")
			.orderBy("starts_at")
			.execute();
		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				serviceId: row.service_id,
				weekday: row.weekday,
				startsAt: row.starts_at,
				endsAt: row.ends_at,
				validFrom: row.valid_from,
				validUntil: row.valid_until,
				active: row.active === 1,
			})),
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_BOOKING_HOURS_ERROR", message: "Failed to get booking hours" },
		};
	}
}

export async function handleShopBookingHoursUpdate(
	db: Kysely<Database>,
	input: ShopBookingHoursUpdateInput,
): Promise<ApiResult<ShopBookingHour[]>> {
	try {
		const service = await getService(db, input.serviceId, DEFAULT_LOCALE);
		if (!service)
			return { success: false, error: { code: "NOT_FOUND", message: "Service not found" } };
		if (input.hours.some((hour) => !validRange(hour.startsAt, hour.endsAt))) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid booking hours" },
			};
		}
		if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid booking date range" },
			};
		}
		await withTransaction(db, async (trx) => {
			await trx
				.deleteFrom("_emdash_shop_booking_hours")
				.where("service_id", "=", service.id)
				.execute();
			if (input.hours.length === 0) return;
			await trx
				.insertInto("_emdash_shop_booking_hours")
				.values(
					input.hours.map((hour) => ({
						id: ulid(),
						service_id: service.id,
						weekday: hour.weekday,
						starts_at: hour.startsAt,
						ends_at: hour.endsAt,
						valid_from: input.validFrom ?? null,
						valid_until: input.validUntil ?? null,
						active: 1,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					})),
				)
				.execute();
		});
		return handleShopBookingHoursGet(db, service.id);
	} catch {
		return {
			success: false,
			error: { code: "SHOP_BOOKING_HOURS_UPDATE_ERROR", message: "Failed to update booking hours" },
		};
	}
}

export async function handleShopReservationList(
	db: Kysely<Database>,
	status?: string,
): Promise<ApiResult<ShopReservationSummary[]>> {
	try {
		let query = db.selectFrom("_emdash_shop_reservations").selectAll().orderBy("starts_at", "desc");
		if (status && status !== "all") query = query.where("status", "=", status);
		const rows = await query.execute();
		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				serviceId: row.service_id,
				orderId: row.order_id,
				orderItemId: row.order_item_id,
				startsAt: row.starts_at,
				endsAt: row.ends_at,
				status: row.status,
				expiresAt: row.expires_at,
				customerName: snapshotName(row.customer_snapshot, "name"),
				serviceName: snapshotName(row.service_snapshot, "name"),
				createdAt: row.created_at ?? null,
			})),
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_RESERVATIONS_ERROR", message: "Failed to list reservations" },
		};
	}
}

export async function handleShopReservationUpdate(
	db: Kysely<Database>,
	id: string,
	status: string,
	startsAt?: string,
	endsAt?: string,
): Promise<ApiResult<ShopReservationSummary>> {
	try {
		const allowed = [
			"held",
			"pending_payment",
			"confirmed",
			"cancelled",
			"expired",
			"completed",
			"no_show",
		];
		if (!allowed.includes(status)) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid reservation status" },
			};
		}
		if (
			(startsAt && !endsAt) ||
			(!startsAt && endsAt) ||
			(startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
		) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid reservation range" },
			};
		}
		const result = await db
			.updateTable("_emdash_shop_reservations")
			.set({
				...(startsAt && endsAt ? { starts_at: startsAt, ends_at: endsAt } : {}),
				status,
				updated_at: new Date().toISOString(),
			})
			.where("id", "=", id)
			.executeTakeFirst();
		if (Number(result.numUpdatedRows ?? 0) === 0) {
			return { success: false, error: { code: "NOT_FOUND", message: "Reservation not found" } };
		}
		const list = await handleShopReservationList(db);
		if (!list.success) return list;
		const reservation = list.data.find((item) => item.id === id);
		return reservation
			? { success: true, data: reservation }
			: { success: false, error: { code: "NOT_FOUND", message: "Reservation not found" } };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_RESERVATION_UPDATE_ERROR", message: "Failed to update reservation" },
		};
	}
}

export async function handleShopBookingBlocksList(
	db: Kysely<Database>,
): Promise<ApiResult<ShopBookingBlock[]>> {
	try {
		const rows = await db
			.selectFrom("_emdash_shop_booking_blocks")
			.selectAll()
			.orderBy("starts_at")
			.execute();
		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				serviceId: row.service_id,
				startsAt: row.starts_at,
				endsAt: row.ends_at,
				reason: row.reason,
			})),
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_BOOKING_BLOCKS_ERROR", message: "Failed to list booking blocks" },
		};
	}
}

export async function handleShopBookingBlockCreate(
	db: Kysely<Database>,
	input: { serviceId?: string | null; startsAt: string; endsAt: string; reason?: string | null },
): Promise<ApiResult<ShopBookingBlock>> {
	try {
		if (new Date(input.startsAt) >= new Date(input.endsAt))
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid block range" },
			};
		const block = {
			id: ulid(),
			service_id: input.serviceId ?? null,
			starts_at: input.startsAt,
			ends_at: input.endsAt,
			reason: input.reason ?? null,
		};
		await db.insertInto("_emdash_shop_booking_blocks").values(block).execute();
		return {
			success: true,
			data: {
				id: block.id,
				serviceId: block.service_id,
				startsAt: block.starts_at,
				endsAt: block.ends_at,
				reason: block.reason,
			},
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_BOOKING_BLOCK_CREATE_ERROR", message: "Failed to create booking block" },
		};
	}
}

export async function handleShopBookingBlockDelete(
	db: Kysely<Database>,
	id: string,
): Promise<ApiResult<null>> {
	try {
		const result = await db
			.deleteFrom("_emdash_shop_booking_blocks")
			.where("id", "=", id)
			.executeTakeFirst();
		return Number(result.numDeletedRows ?? 0) === 1
			? { success: true, data: null }
			: { success: false, error: { code: "NOT_FOUND", message: "Booking block not found" } };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_BOOKING_BLOCK_DELETE_ERROR", message: "Failed to delete booking block" },
		};
	}
}

export async function expireShopReservations(db: Kysely<Database>): Promise<number> {
	const result = await db
		.updateTable("_emdash_shop_reservations")
		.set({ status: "expired", updated_at: new Date().toISOString() })
		.where("status", "in", ["held", "pending_payment"])
		.where("expires_at", "is not", null)
		.where("expires_at", "<", new Date().toISOString())
		.executeTakeFirst();
	return Number(result.numUpdatedRows ?? 0);
}

export async function handleShopBookingHold(
	db: Kysely<Database>,
	input: ShopBookingHoldInput,
): Promise<ApiResult<ShopBookingHold>> {
	try {
		const service = await getService(db, input.serviceId, input.locale ?? DEFAULT_LOCALE);
		if (!service)
			return { success: false, error: { code: "NOT_FOUND", message: "Service not found" } };
		const startsAt = new Date(input.startsAt);
		const endsAt = new Date(input.endsAt);
		if (!(startsAt < endsAt)) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid booking range" },
			};
		}
		const duration = positiveInteger(service.data.duration_minutes, 60);
		if (endsAt.getTime() - startsAt.getTime() !== duration * 60_000) {
			return {
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Invalid service duration" },
			};
		}
		const availability = await handleShopBookingAvailability(
			db,
			service.id,
			startsAt.toISOString().slice(0, 10),
			input.locale ?? DEFAULT_LOCALE,
		);
		if (
			!availability.success ||
			!availability.data.some(
				(slot) => slot.startsAt === startsAt.toISOString() && slot.endsAt === endsAt.toISOString(),
			)
		) {
			return {
				success: false,
				error: { code: "BOOKING_UNAVAILABLE", message: "The selected time is no longer available" },
			};
		}
		const capacity = positiveInteger(service.data.service_capacity, 1);
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
		const id = ulid();
		await withTransaction(db, async (trx) => {
			const used = await countReservations(
				trx,
				service.id,
				startsAt.toISOString(),
				endsAt.toISOString(),
				now,
			);
			if (used >= capacity) throw new Error("BOOKING_UNAVAILABLE");
			await trx
				.insertInto("_emdash_shop_reservations")
				.values({
					id,
					service_id: service.id,
					order_id: null,
					order_item_id: null,
					customer_id: null,
					starts_at: startsAt.toISOString(),
					ends_at: endsAt.toISOString(),
					status: "held",
					expires_at: expiresAt,
					customer_snapshot: null,
					service_snapshot: JSON.stringify({ name: service.name, durationMinutes: duration }),
					notes: null,
					created_at: now,
					updated_at: now,
				})
				.execute();
		});
		return {
			success: true,
			data: {
				id,
				serviceId: service.id,
				startsAt: startsAt.toISOString(),
				endsAt: endsAt.toISOString(),
				status: "held",
				expiresAt,
			},
		};
	} catch (error) {
		if (error instanceof Error && error.message === "BOOKING_UNAVAILABLE") {
			return {
				success: false,
				error: { code: "BOOKING_UNAVAILABLE", message: "The selected time is no longer available" },
			};
		}
		return {
			success: false,
			error: { code: "SHOP_BOOKING_HOLD_ERROR", message: "Failed to hold booking" },
		};
	}
}
