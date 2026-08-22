import { sql, type Kysely } from "kysely";
import { ulid } from "ulidx";

import { decryptShopSecret, encryptShopSecret } from "../../config/secrets.js";
import { ContentRepository } from "../../database/repositories/content.js";
import { withTransaction } from "../../database/transaction.js";
import type { Database } from "../../database/types.js";
import { invalidateCollectionCache } from "../../object-cache/index.js";
import type { ApiResult } from "../types.js";

const DEFAULT_SETTINGS_ID = "default";
const DEFAULT_CURRENCY = "PEN";
const DEFAULT_CURRENCY_SYMBOL = "S/";
const DEFAULT_PAYMENT_METHODS = ["whatsapp"];
const SHOP_COLLECTION = "products";

function currencySymbolForCurrency(currency: string): string {
	return (
		(
			{
				PEN: "S/",
				USD: "$",
				EUR: "€",
				GBP: "£",
				MXN: "$",
				COP: "$",
				CLP: "$",
				ARS: "$",
				BRL: "R$",
			} as Record<string, string>
		)[currency.toUpperCase()] ?? currency
	);
}

export interface ShopSettings {
	id: string;
	storeName: string;
	currency: string;
	currencySymbol: string;
	whatsappNumber: string | null;
	whatsappMessage: string | null;
	paymentMethods: string[];
	deliveryInstructions: string | null;
	businessHours: string | null;
	paymentGatewayEnabled: boolean;
	paymentGatewayProvider: string | null;
	paymentGatewayEnvironment: "sandbox" | "production";
	paymentGatewayPublicKey: string | null;
	paymentGatewaySecretKeyConfigured: boolean;
	paymentGatewayWebhookSecretConfigured: boolean;
	paymentGatewayReturnUrl: string | null;
	paymentGatewayWebhookUrl: string | null;
}

export interface ShopPublicSettings {
	id: string;
	storeName: string;
	currency: string;
	currencySymbol: string;
	whatsappNumber: string | null;
	whatsappMessage: string | null;
	paymentMethods: string[];
	deliveryInstructions: string | null;
	businessHours: string | null;
}

export interface ShopSettingsUpdateInput extends Partial<Omit<ShopSettings, "id">> {
	paymentGatewaySecretKey?: string | null;
	paymentGatewayWebhookSecret?: string | null;
}

export interface ShopPaymentGatewayCredentials {
	provider: string;
	environment: "sandbox" | "production";
	publicKey: string | null;
	secretKey: string | null;
	webhookSecret: string | null;
	returnUrl: string | null;
	webhookUrl: string | null;
}

export interface ShopDeliveryZone {
	id: string;
	name: string;
	districts: string[];
	deliveryCost: number;
	estimatedTime: string | null;
	active: boolean;
}

export interface ShopOrderInput {
	items: Array<{ productId: string; variantId?: string; quantity: number }>;
	customer: {
		name: string;
		phone: string;
		email?: string;
		address: string;
		district: string;
		reference?: string;
	};
	deliveryZoneId: string;
	paymentMethod: string;
	notes?: string;
}

export interface ShopOrderSummary {
	id: string;
	orderNumber: string;
	status: string;
	paymentStatus: string;
	deliveryStatus: string;
	currency: string;
	currencySymbol: string;
	subtotal: number;
	discount: number;
	deliveryCost: number;
	total: number;
	whatsappUrl: string | null;
}

type ShopWhatsAppOrder = ShopOrderSummary & {
	items?: Array<{ productName: string; quantity: number; subtotal: number }>;
};

export interface ShopOrderDetail extends ShopOrderSummary {
	items: Array<{
		id: string;
		productId: string;
		variantId: string | null;
		productName: string;
		variantName: string | null;
		unitPrice: number;
		quantity: number;
		discount: number;
		subtotal: number;
		imageUrl?: string | null;
	}>;
	customer: Record<string, unknown>;
	delivery: Record<string, unknown>;
	notes: string | null;
}

function parseJson(value: string | null | undefined): unknown {
	if (!value) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(value: unknown, field: string): string | undefined {
	if (!isRecord(value)) return undefined;
	const fieldValue = value[field];
	return typeof fieldValue === "string" ? fieldValue : undefined;
}

function parseJsonStringArray(value: string | null | undefined, fallback: string[]): string[] {
	const parsed = parseJson(value);
	return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")
		? parsed
		: fallback;
}

async function preserveOrEncryptShopSecret(
	input: string | null | undefined,
	existing: string | null | undefined,
): Promise<string | null> {
	if (input === null) return null;
	if (typeof input === "string" && input.length > 0) return encryptShopSecret(input);
	if (typeof existing === "string" && existing.length > 0) {
		return existing.startsWith("emdash_shop_secret_v1_") ? existing : encryptShopSecret(existing);
	}
	return null;
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
	const parsed = parseJson(value);
	return isRecord(parsed) ? parsed : {};
}

function toSettings(row: {
	id: string;
	store_name: string;
	currency: string;
	currency_symbol: string | null;
	whatsapp_number: string | null;
	whatsapp_message: string | null;
	payment_methods: string;
	delivery_instructions: string | null;
	business_hours: string | null;
	payment_gateway_enabled: number;
	payment_gateway_provider: string | null;
	payment_gateway_environment: string;
	payment_gateway_public_key: string | null;
	payment_gateway_secret_key: string | null;
	payment_gateway_webhook_secret: string | null;
	payment_gateway_return_url: string | null;
	payment_gateway_webhook_url: string | null;
}): ShopSettings {
	return {
		id: row.id,
		storeName: row.store_name,
		currency: row.currency,
		currencySymbol: row.currency_symbol || currencySymbolForCurrency(row.currency),
		whatsappNumber: row.whatsapp_number,
		whatsappMessage: row.whatsapp_message,
		paymentMethods: parseJsonStringArray(row.payment_methods, DEFAULT_PAYMENT_METHODS),
		deliveryInstructions: row.delivery_instructions,
		businessHours: row.business_hours,
		paymentGatewayEnabled: row.payment_gateway_enabled === 1,
		paymentGatewayProvider: row.payment_gateway_provider,
		paymentGatewayEnvironment:
			row.payment_gateway_environment === "production" ? "production" : "sandbox",
		paymentGatewayPublicKey: row.payment_gateway_public_key,
		paymentGatewaySecretKeyConfigured: Boolean(row.payment_gateway_secret_key),
		paymentGatewayWebhookSecretConfigured: Boolean(row.payment_gateway_webhook_secret),
		paymentGatewayReturnUrl: row.payment_gateway_return_url,
		paymentGatewayWebhookUrl: row.payment_gateway_webhook_url,
	};
}

function toDeliveryZone(row: {
	id: string;
	name: string;
	districts: string;
	delivery_cost: number;
	estimated_time: string | null;
	active: number;
}): ShopDeliveryZone {
	return {
		id: row.id,
		name: row.name,
		districts: parseJsonStringArray(row.districts, []),
		deliveryCost: row.delivery_cost,
		estimatedTime: row.estimated_time,
		active: row.active === 1,
	};
}

function productPrice(data: Record<string, unknown>): { price: number; discount: number } | null {
	const regular = typeof data.price === "number" ? data.price : null;
	const promotionalValue = data.promotion_price ?? data.promotionPrice;
	const promotional = typeof promotionalValue === "number" ? promotionalValue : null;
	if (regular === null || regular < 0) return null;
	if (promotional !== null && promotional >= 0 && promotional < regular) {
		return { price: promotional, discount: regular - promotional };
	}
	return { price: regular, discount: 0 };
}

type ShopVariant = {
	id?: string;
	label?: string;
	stock?: number;
	price?: number;
	[key: string]: unknown;
};

function productVariants(data: Record<string, unknown>): ShopVariant[] {
	if (!Array.isArray(data.variants)) return [];
	return data.variants.filter((variant): variant is ShopVariant => isRecord(variant));
}

function hasProductVariants(data: Record<string, unknown>): boolean {
	const enabled =
		data.has_variations === true || data.has_variations === 1 || data.has_variations === "1";
	return enabled && productVariants(data).length > 0;
}

function isProductAvailable(data: Record<string, unknown>): boolean {
	const availability = data.availability_status ?? data.availability;
	const stock = data.stock;
	const variantsAvailable = productVariants(data).some(
		(variant) => typeof variant.stock !== "number" || variant.stock > 0,
	);
	return (
		availability !== "sold_out" &&
		availability !== "hidden" &&
		(hasProductVariants(data) ? variantsAvailable : typeof stock !== "number" || stock > 0)
	);
}

class ShopStockError extends Error {}

function makeOrderNumber(): string {
	return `#${Date.now().toString(36).toUpperCase()}-${ulid().slice(-4)}`;
}

function makeWhatsAppUrl(
	phone: string | null,
	order: ShopWhatsAppOrder,
	settings: ShopSettings,
	customer?: Record<string, unknown>,
	delivery?: Record<string, unknown>,
): string | null {
	if (!phone) return null;
	const cleanPhone = phone.replace(/\D/g, "");
	if (!cleanPhone) return null;
	const itemLines =
		order.items?.map(
			(item) =>
				`- ${item.productName} x${item.quantity}: ${settings.currencySymbol} ${item.subtotal.toFixed(2)}`,
		) ?? [];
	const message = [
		settings.whatsappMessage || "Hola, quiero coordinar el pago de mi pedido.",
		settings.storeName ? `Tienda: ${settings.storeName}` : null,
		`Pedido: ${order.orderNumber}`,
		typeof customer?.name === "string" ? `Cliente: ${customer.name}` : null,
		typeof delivery?.address === "string"
			? `Delivery: ${delivery.address}${typeof delivery.district === "string" ? `, ${delivery.district}` : ""}`
			: null,
		...itemLines,
		`Total: ${settings.currencySymbol} ${order.total.toFixed(2)}`,
	]
		.filter((line): line is string => line !== null)
		.join("\n");
	return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export async function handleShopSettingsGet(
	db: Kysely<Database>,
): Promise<ApiResult<ShopSettings>> {
	try {
		const row = await db
			.selectFrom("_emdash_shop_settings")
			.selectAll()
			.where("id", "=", DEFAULT_SETTINGS_ID)
			.executeTakeFirst();
		if (row) return { success: true, data: toSettings(row) };
		return {
			success: true,
			data: {
				id: DEFAULT_SETTINGS_ID,
				storeName: "",
				currency: DEFAULT_CURRENCY,
				currencySymbol: DEFAULT_CURRENCY_SYMBOL,
				whatsappNumber: null,
				whatsappMessage: null,
				paymentMethods: DEFAULT_PAYMENT_METHODS,
				deliveryInstructions: null,
				businessHours: null,
				paymentGatewayEnabled: false,
				paymentGatewayProvider: null,
				paymentGatewayEnvironment: "sandbox",
				paymentGatewayPublicKey: null,
				paymentGatewaySecretKeyConfigured: false,
				paymentGatewayWebhookSecretConfigured: false,
				paymentGatewayReturnUrl: null,
				paymentGatewayWebhookUrl: null,
			},
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_SETTINGS_READ_ERROR", message: "Failed to get shop settings" },
		};
	}
}

export async function handleShopPublicSettingsGet(
	db: Kysely<Database>,
): Promise<ApiResult<ShopPublicSettings>> {
	const result = await handleShopSettingsGet(db);
	if (!result.success) return result;
	const {
		id,
		storeName,
		currency,
		currencySymbol,
		whatsappNumber,
		whatsappMessage,
		paymentMethods,
		deliveryInstructions,
		businessHours,
	} = result.data;
	return {
		success: true,
		data: {
			id,
			storeName,
			currency,
			currencySymbol,
			whatsappNumber,
			whatsappMessage,
			paymentMethods,
			deliveryInstructions,
			businessHours,
		},
	};
}

export async function handleShopSettingsUpdate(
	db: Kysely<Database>,
	input: ShopSettingsUpdateInput,
): Promise<ApiResult<ShopSettings>> {
	try {
		const existing = await db
			.selectFrom("_emdash_shop_settings")
			.selectAll()
			.where("id", "=", DEFAULT_SETTINGS_ID)
			.executeTakeFirst();
		const [paymentGatewaySecretKey, paymentGatewayWebhookSecret] = await Promise.all([
			preserveOrEncryptShopSecret(
				input.paymentGatewaySecretKey,
				existing?.payment_gateway_secret_key,
			),
			preserveOrEncryptShopSecret(
				input.paymentGatewayWebhookSecret,
				existing?.payment_gateway_webhook_secret,
			),
		]);
		const values = {
			store_name: input.storeName ?? existing?.store_name ?? "",
			currency: input.currency ?? existing?.currency ?? DEFAULT_CURRENCY,
			currency_symbol:
				input.currencySymbol ??
				existing?.currency_symbol ??
				currencySymbolForCurrency(input.currency ?? existing?.currency ?? DEFAULT_CURRENCY),
			whatsapp_number: input.whatsappNumber ?? existing?.whatsapp_number ?? null,
			whatsapp_message: input.whatsappMessage ?? existing?.whatsapp_message ?? null,
			payment_methods: JSON.stringify(
				input.paymentMethods ??
					parseJsonStringArray(existing?.payment_methods, DEFAULT_PAYMENT_METHODS),
			),
			delivery_instructions: input.deliveryInstructions ?? existing?.delivery_instructions ?? null,
			business_hours: input.businessHours ?? existing?.business_hours ?? null,
			payment_gateway_enabled:
				input.paymentGatewayEnabled === undefined
					? (existing?.payment_gateway_enabled ?? 0)
					: input.paymentGatewayEnabled
						? 1
						: 0,
			payment_gateway_provider:
				input.paymentGatewayProvider ?? existing?.payment_gateway_provider ?? null,
			payment_gateway_environment:
				input.paymentGatewayEnvironment ?? existing?.payment_gateway_environment ?? "sandbox",
			payment_gateway_public_key:
				input.paymentGatewayPublicKey ?? existing?.payment_gateway_public_key ?? null,
			payment_gateway_secret_key: paymentGatewaySecretKey,
			payment_gateway_webhook_secret: paymentGatewayWebhookSecret,
			payment_gateway_return_url:
				input.paymentGatewayReturnUrl ?? existing?.payment_gateway_return_url ?? null,
			payment_gateway_webhook_url:
				input.paymentGatewayWebhookUrl ?? existing?.payment_gateway_webhook_url ?? null,
			updated_at: new Date().toISOString(),
		};
		await db
			.insertInto("_emdash_shop_settings")
			.values({ id: DEFAULT_SETTINGS_ID, ...values })
			.onConflict((conflict) => conflict.column("id").doUpdateSet(values))
			.execute();
		return handleShopSettingsGet(db);
	} catch {
		return {
			success: false,
			error: { code: "SHOP_SETTINGS_UPDATE_ERROR", message: "Failed to update shop settings" },
		};
	}
}

export async function resolveShopPaymentGatewayCredentials(
	db: Kysely<Database>,
): Promise<ShopPaymentGatewayCredentials | null> {
	const row = await db
		.selectFrom("_emdash_shop_settings")
		.select([
			"payment_gateway_enabled",
			"payment_gateway_provider",
			"payment_gateway_environment",
			"payment_gateway_public_key",
			"payment_gateway_secret_key",
			"payment_gateway_webhook_secret",
			"payment_gateway_return_url",
			"payment_gateway_webhook_url",
		])
		.where("id", "=", DEFAULT_SETTINGS_ID)
		.executeTakeFirst();
	if (!row?.payment_gateway_enabled || !row.payment_gateway_provider) return null;
	return {
		provider: row.payment_gateway_provider,
		environment: row.payment_gateway_environment === "production" ? "production" : "sandbox",
		publicKey: row.payment_gateway_public_key,
		secretKey: row.payment_gateway_secret_key
			? await decryptShopSecret(row.payment_gateway_secret_key)
			: null,
		webhookSecret: row.payment_gateway_webhook_secret
			? await decryptShopSecret(row.payment_gateway_webhook_secret)
			: null,
		returnUrl: row.payment_gateway_return_url,
		webhookUrl: row.payment_gateway_webhook_url,
	};
}

export async function handleShopDeliveryZoneList(
	db: Kysely<Database>,
): Promise<ApiResult<ShopDeliveryZone[]>> {
	try {
		const rows = await db
			.selectFrom("_emdash_shop_delivery_zones")
			.selectAll()
			.orderBy("active", "desc")
			.orderBy("name", "asc")
			.execute();
		return { success: true, data: rows.map(toDeliveryZone) };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_DELIVERY_ZONE_LIST_ERROR", message: "Failed to list delivery zones" },
		};
	}
}

export interface ShopDeliveryZoneInput {
	name: string;
	districts: string[];
	deliveryCost: number;
	estimatedTime?: string | null;
	active?: boolean;
}

export async function handleShopDeliveryZoneCreate(
	db: Kysely<Database>,
	input: ShopDeliveryZoneInput,
): Promise<ApiResult<ShopDeliveryZone>> {
	try {
		const id = ulid();
		await db
			.insertInto("_emdash_shop_delivery_zones")
			.values({
				id,
				name: input.name,
				districts: JSON.stringify(input.districts),
				delivery_cost: input.deliveryCost,
				estimated_time: input.estimatedTime ?? null,
				active: input.active === false ? 0 : 1,
			})
			.execute();
		const row = await db
			.selectFrom("_emdash_shop_delivery_zones")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		return { success: true, data: toDeliveryZone(row) };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_DELIVERY_ZONE_CREATE_ERROR", message: "Failed to create delivery zone" },
		};
	}
}

export async function handleShopDeliveryZoneUpdate(
	db: Kysely<Database>,
	id: string,
	input: Partial<ShopDeliveryZoneInput>,
): Promise<ApiResult<ShopDeliveryZone>> {
	try {
		const values = {
			...(input.name === undefined ? {} : { name: input.name }),
			...(input.districts === undefined ? {} : { districts: JSON.stringify(input.districts) }),
			...(input.deliveryCost === undefined ? {} : { delivery_cost: input.deliveryCost }),
			...(input.estimatedTime === undefined ? {} : { estimated_time: input.estimatedTime }),
			...(input.active === undefined ? {} : { active: input.active ? 1 : 0 }),
			updated_at: new Date().toISOString(),
		};
		await db.updateTable("_emdash_shop_delivery_zones").set(values).where("id", "=", id).execute();
		const row = await db
			.selectFrom("_emdash_shop_delivery_zones")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		if (!row)
			return {
				success: false,
				error: { code: "SHOP_DELIVERY_ZONE_NOT_FOUND", message: "Delivery zone not found" },
			};
		return { success: true, data: toDeliveryZone(row) };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_DELIVERY_ZONE_UPDATE_ERROR", message: "Failed to update delivery zone" },
		};
	}
}

export async function handleShopDeliveryZoneDelete(
	db: Kysely<Database>,
	id: string,
): Promise<ApiResult<null>> {
	try {
		await db.deleteFrom("_emdash_shop_delivery_zones").where("id", "=", id).execute();
		return { success: true, data: null };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_DELIVERY_ZONE_DELETE_ERROR", message: "Failed to delete delivery zone" },
		};
	}
}

export async function handleShopProductList(db: Kysely<Database>): Promise<ApiResult<unknown[]>> {
	try {
		const result = await new ContentRepository(db).findMany(SHOP_COLLECTION, {
			limit: 100,
			where: { status: "published" },
		});
		return { success: true, data: result.items.filter((item) => isProductAvailable(item.data)) };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_PRODUCT_LIST_ERROR", message: "Failed to list shop products" },
		};
	}
}

export async function handleShopProductGet(
	db: Kysely<Database>,
	id: string,
): Promise<ApiResult<unknown>> {
	try {
		const product = await new ContentRepository(db).findByIdOrSlug(SHOP_COLLECTION, id);
		if (!product || product.status !== "published" || !isProductAvailable(product.data)) {
			return {
				success: false,
				error: { code: "SHOP_PRODUCT_NOT_FOUND", message: "Product not found" },
			};
		}
		return { success: true, data: product };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_PRODUCT_GET_ERROR", message: "Failed to get shop product" },
		};
	}
}

export async function handleShopOrderCreate(
	db: Kysely<Database>,
	input: ShopOrderInput,
): Promise<ApiResult<ShopOrderSummary>> {
	try {
		const settingsResult = await handleShopSettingsGet(db);
		if (!settingsResult.success) return settingsResult;
		const settings = settingsResult.data;
		const zone = await db
			.selectFrom("_emdash_shop_delivery_zones")
			.selectAll()
			.where("id", "=", input.deliveryZoneId)
			.where("active", "=", 1)
			.executeTakeFirst();
		if (!zone)
			return {
				success: false,
				error: { code: "SHOP_DELIVERY_ZONE_NOT_FOUND", message: "Delivery zone not found" },
			};
		if (input.items.length === 0)
			return {
				success: false,
				error: { code: "SHOP_ORDER_EMPTY", message: "Order must contain at least one product" },
			};

		const products = new ContentRepository(db);
		const requestedQuantities = new Map<
			string,
			{ productId: string; variantId?: string; quantity: number }
		>();
		for (const inputItem of input.items) {
			const key = `${inputItem.productId}:${inputItem.variantId ?? ""}`;
			const current = requestedQuantities.get(key);
			requestedQuantities.set(key, {
				productId: inputItem.productId,
				variantId: inputItem.variantId,
				quantity: (current?.quantity ?? 0) + inputItem.quantity,
			});
		}
		const items = [] as Array<{
			productId: string;
			productName: string;
			unitPrice: number;
			quantity: number;
			discount: number;
			subtotal: number;
			variantId: string | null;
			variantName: string | null;
		}>;
		for (const requested of requestedQuantities.values()) {
			const product = await products.findByIdOrSlug(SHOP_COLLECTION, requested.productId);
			if (!product || product.status !== "published" || !isProductAvailable(product.data)) {
				return {
					success: false,
					error: { code: "SHOP_PRODUCT_UNAVAILABLE", message: "Product is not available" },
				};
			}
			const variants = productVariants(product.data);
			const variant = requested.variantId
				? variants.find((item) => (item.id ?? item.label) === requested.variantId)
				: undefined;
			if (requested.variantId && !variant) {
				return {
					success: false,
					error: { code: "SHOP_VARIANT_NOT_FOUND", message: "Product variation not found" },
				};
			}
			const price =
				variant && typeof variant.price === "number" && variant.price >= 0
					? { price: variant.price, discount: 0 }
					: productPrice(product.data);
			const stock = variant?.stock ?? product.data.stock;
			if (!price || !Number.isInteger(requested.quantity) || requested.quantity < 1) {
				return {
					success: false,
					error: { code: "SHOP_PRODUCT_INVALID", message: "Product price or quantity is invalid" },
				};
			}
			if (typeof stock === "number" && requested.quantity > stock) {
				return {
					success: false,
					error: {
						code: "SHOP_STOCK_UNAVAILABLE",
						message: "Requested quantity exceeds available stock",
					},
				};
			}
			const productName =
				typeof product.data.name === "string" ? product.data.name : product.slug || product.id;
			items.push({
				productId: product.id,
				productName: variant?.label ? `${productName} (${variant.label})` : productName,
				unitPrice: price.price,
				quantity: requested.quantity,
				discount: price.discount * requested.quantity,
				subtotal: price.price * requested.quantity,
				variantId: requested.variantId ?? null,
				variantName: null,
			});
		}

		const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
		const discount = items.reduce((sum, item) => sum + item.discount, 0);
		const deliveryCost = zone.delivery_cost;
		const orderNumber = makeOrderNumber();
		const orderId = ulid();
		const customerId = ulid();
		const customerSnapshot = { ...input.customer };
		const deliverySnapshot = {
			zoneId: zone.id,
			zone: zone.name,
			address: input.customer.address,
			district: input.customer.district,
			reference: input.customer.reference ?? null,
			phone: input.customer.phone,
		};

		await withTransaction(db, async (trx) => {
			for (const item of items) {
				if (item.variantId) {
					const currentProduct = await new ContentRepository(trx).findById(
						SHOP_COLLECTION,
						item.productId,
					);
					const currentVariants = currentProduct ? productVariants(currentProduct.data) : [];
					const currentVariant = currentVariants.find(
						(variant) => (variant.id ?? variant.label) === item.variantId,
					);
					const currentStock = currentVariant?.stock;
					if (!currentProduct || !currentVariant) {
						throw new ShopStockError();
					}
					if (typeof currentStock === "number") {
						if (currentStock < item.quantity) throw new ShopStockError();
						const updatedVariants = currentVariants.map((variant) =>
							(variant.id ?? variant.label) === item.variantId
								? { ...variant, stock: currentStock - item.quantity }
								: variant,
						);
						await new ContentRepository(trx).update(SHOP_COLLECTION, item.productId, {
							data: { ...currentProduct.data, variants: updatedVariants },
						});
						continue;
					}
				}
				const updated = await sql`
					UPDATE ${sql.ref("ec_products")}
					SET ${sql.ref("stock")} = ${sql.ref("stock")} - ${item.quantity},
						${sql.ref("updated_at")} = ${new Date().toISOString()},
						${sql.ref("version")} = ${sql.ref("version")} + 1
					WHERE ${sql.ref("id")} = ${item.productId}
						AND ${sql.ref("stock")} >= ${item.quantity}
				`.execute(trx);
				if (Number(updated.numAffectedRows) !== 1) throw new ShopStockError();
			}
			await trx
				.insertInto("_emdash_shop_customers")
				.values({
					id: customerId,
					name: input.customer.name,
					phone: input.customer.phone,
					email: input.customer.email ?? null,
					address: input.customer.address,
					district: input.customer.district,
					reference: input.customer.reference ?? null,
				})
				.execute();
			await trx
				.insertInto("_emdash_shop_orders")
				.values({
					id: orderId,
					order_number: orderNumber,
					customer_id: customerId,
					currency: settings.currency,
					subtotal,
					discount,
					delivery_cost: deliveryCost,
					total: subtotal + deliveryCost,
					customer_snapshot: JSON.stringify(customerSnapshot),
					delivery_snapshot: JSON.stringify(deliverySnapshot),
					notes: input.notes ?? null,
				})
				.execute();
			await trx
				.insertInto("_emdash_shop_order_items")
				.values(
					items.map((item) => ({
						id: ulid(),
						order_id: orderId,
						product_id: item.productId,
						variant_id: item.variantId,
						product_name: item.productName,
						variant_name: item.variantName,
						unit_price: item.unitPrice,
						quantity: item.quantity,
						discount: item.discount,
						subtotal: item.subtotal,
					})),
				)
				.execute();
			await trx
				.insertInto("_emdash_shop_payments")
				.values({
					id: ulid(),
					order_id: orderId,
					method: input.paymentMethod,
					amount: subtotal + deliveryCost,
				})
				.execute();
			await trx
				.insertInto("_emdash_shop_deliveries")
				.values({
					id: ulid(),
					order_id: orderId,
					zone: zone.name,
					address: input.customer.address,
					district: input.customer.district,
					reference: input.customer.reference ?? null,
					phone: input.customer.phone,
					delivery_cost: deliveryCost,
				})
				.execute();
		});
		invalidateCollectionCache(SHOP_COLLECTION);

		return {
			success: true,
			data: {
				id: orderId,
				orderNumber,
				status: "new",
				paymentStatus: "pending",
				deliveryStatus: "pending",
				currency: settings.currency,
				currencySymbol: settings.currencySymbol,
				subtotal,
				discount,
				deliveryCost,
				total: subtotal + deliveryCost,
				whatsappUrl: makeWhatsAppUrl(
					settings.whatsappNumber,
					{
						id: orderId,
						orderNumber,
						status: "new",
						paymentStatus: "pending",
						deliveryStatus: "pending",
						currency: settings.currency,
						currencySymbol: settings.currencySymbol,
						subtotal,
						discount,
						deliveryCost,
						total: subtotal + deliveryCost,
						whatsappUrl: null,
						items: items.map((item) => ({
							id: "",
							productId: item.productId,
							variantId: item.variantId,
							productName: item.productName,
							variantName: item.variantName,
							unitPrice: item.unitPrice,
							quantity: item.quantity,
							discount: item.discount,
							subtotal: item.subtotal,
						})),
					},
					settings,
					customerSnapshot,
					deliverySnapshot,
				),
			},
		};
	} catch (error) {
		if (error instanceof ShopStockError) {
			return {
				success: false,
				error: {
					code: "SHOP_STOCK_UNAVAILABLE",
					message: "Requested quantity is no longer available",
				},
			};
		}
		return {
			success: false,
			error: { code: "SHOP_ORDER_CREATE_ERROR", message: "Failed to create order" },
		};
	}
}

export async function handleShopOrderList(
	db: Kysely<Database>,
): Promise<ApiResult<ShopOrderSummary[]>> {
	try {
		const [rows, settings] = await Promise.all([
			db
				.selectFrom("_emdash_shop_orders")
				.selectAll()
				.orderBy("created_at", "desc")
				.limit(100)
				.execute(),
			handleShopSettingsGet(db),
		]);
		if (!settings.success) return settings;
		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				orderNumber: row.order_number,
				status: row.status,
				paymentStatus: row.payment_status,
				deliveryStatus: row.delivery_status,
				currency: row.currency,
				currencySymbol: settings.data.currencySymbol,
				subtotal: row.subtotal,
				discount: row.discount,
				deliveryCost: row.delivery_cost,
				total: row.total,
				whatsappUrl: null,
			})),
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_ORDER_LIST_ERROR", message: "Failed to list orders" },
		};
	}
}

export interface ShopCustomerSummary {
	id: string;
	name: string;
	phone: string;
	email: string | null;
	address: string | null;
	district: string | null;
	reference: string | null;
	notes: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	orderCount: number;
	totalSpent: number;
	lastOrderNumber: string | null;
	lastOrderStatus: string | null;
	lastOrderCreatedAt: string | null;
	orders: Array<{ orderNumber: string; status: string; total: number; createdAt: string | null }>;
}

export async function handleShopCustomerList(
	db: Kysely<Database>,
): Promise<ApiResult<ShopCustomerSummary[]>> {
	try {
		const [rows, orders] = await Promise.all([
			db
				.selectFrom("_emdash_shop_customers")
				.selectAll()
				.orderBy("created_at", "desc")
				.limit(100)
				.execute(),
			db
				.selectFrom("_emdash_shop_orders")
				.select(["customer_id", "order_number", "status", "total", "created_at"])
				.orderBy("created_at", "desc")
				.limit(500)
				.execute(),
		]);
		const ordersByCustomer = new Map<string, typeof orders>();
		for (const order of orders) {
			const customerOrders = ordersByCustomer.get(order.customer_id) ?? [];
			customerOrders.push(order);
			ordersByCustomer.set(order.customer_id, customerOrders);
		}
		return {
			success: true,
			data: rows.map((row) => ({
				id: row.id,
				name: row.name,
				phone: row.phone,
				email: row.email,
				address: row.address,
				district: row.district,
				reference: row.reference,
				notes: row.notes,
				createdAt: row.created_at ?? null,
				updatedAt: row.updated_at ?? null,
				orderCount: ordersByCustomer.get(row.id)?.length ?? 0,
				totalSpent: (ordersByCustomer.get(row.id) ?? []).reduce(
					(sum, order) => sum + order.total,
					0,
				),
				lastOrderNumber: ordersByCustomer.get(row.id)?.[0]?.order_number ?? null,
				lastOrderStatus: ordersByCustomer.get(row.id)?.[0]?.status ?? null,
				lastOrderCreatedAt: ordersByCustomer.get(row.id)?.[0]?.created_at ?? null,
				orders: (ordersByCustomer.get(row.id) ?? []).map((order) => ({
					orderNumber: order.order_number,
					status: order.status,
					total: order.total,
					createdAt: order.created_at ?? null,
				})),
			})),
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_CUSTOMER_LIST_ERROR", message: "Failed to list customers" },
		};
	}
}

export async function handleShopOrderGet(
	db: Kysely<Database>,
	id: string,
): Promise<ApiResult<ShopOrderDetail>> {
	try {
		const order = await db
			.selectFrom("_emdash_shop_orders")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		if (!order)
			return {
				success: false,
				error: { code: "SHOP_ORDER_NOT_FOUND", message: "Order not found" },
			};
		const [items, settings] = await Promise.all([
			db
				.selectFrom("_emdash_shop_order_items")
				.selectAll()
				.where("order_id", "=", id)
				.orderBy("created_at", "asc")
				.execute(),
			handleShopSettingsGet(db),
		]);
		if (!settings.success) return settings;
		const customer = parseJsonRecord(order.customer_snapshot);
		const delivery = parseJsonRecord(order.delivery_snapshot);
		const summary = {
			id: order.id,
			orderNumber: order.order_number,
			status: order.status,
			paymentStatus: order.payment_status,
			deliveryStatus: order.delivery_status,
			currency: order.currency,
			currencySymbol: settings.data.currencySymbol,
			subtotal: order.subtotal,
			discount: order.discount,
			deliveryCost: order.delivery_cost,
			total: order.total,
			whatsappUrl: null,
		};
		const detail: ShopOrderDetail = {
			...summary,
			items: items.map((item) => ({
				id: item.id,
				productId: item.product_id,
				variantId: item.variant_id,
				productName: item.product_name,
				variantName: item.variant_name,
				unitPrice: item.unit_price,
				quantity: item.quantity,
				discount: item.discount,
				subtotal: item.subtotal,
			})),
			customer,
			delivery,
			notes: order.notes,
		};
		const phone = typeof customer.phone === "string" ? customer.phone : null;
		detail.whatsappUrl = makeWhatsAppUrl(phone, detail, settings.data, customer, delivery);
		return { success: true, data: detail };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_ORDER_GET_ERROR", message: "Failed to get order" },
		};
	}
}

export async function handleShopOrderGetByNumber(
	db: Kysely<Database>,
	orderNumber: string,
): Promise<ApiResult<ShopOrderDetail>> {
	try {
		const decodedOrderNumber = decodeURIComponent(orderNumber).trim();
		const normalizedOrderNumber = decodedOrderNumber.startsWith("#")
			? decodedOrderNumber
			: `#${decodedOrderNumber}`;
		const order = await db
			.selectFrom("_emdash_shop_orders")
			.select("id")
			.where("order_number", "=", normalizedOrderNumber)
			.executeTakeFirst();
		if (!order)
			return {
				success: false,
				error: { code: "SHOP_ORDER_NOT_FOUND", message: "Order not found" },
			};
		const detail = await handleShopOrderGet(db, order.id);
		if (!detail.success) return detail;
		const repository = new ContentRepository(db);
		const publicItems = await Promise.all(
			detail.data.items.map(async (item) => {
				const product = await repository.findById(SHOP_COLLECTION, item.productId);
				const variants =
					product && Array.isArray(product.data.variants) ? product.data.variants : [];
				const selectedVariant = variants.find(
					(variant) => isRecord(variant) && (variant.id ?? variant.label) === item.variantId,
				);
				const image =
					isRecord(selectedVariant) && selectedVariant.image
						? selectedVariant.image
						: product?.data.featured_image;
				const imageRecord = isRecord(image) ? image : null;
				const imageSrc = getStringField(imageRecord, "src");
				const storageKey = getStringField(imageRecord?.meta, "storageKey");
				const imageId = getStringField(imageRecord, "id");
				const imageUrl = imageSrc
					? imageSrc
					: storageKey
						? `/_emdash/api/media/file/${storageKey}`
						: imageId
							? `/_emdash/api/media/file/${imageId}`
							: null;
				return { ...item, imageUrl };
			}),
		);
		return {
			success: true,
			data: { ...detail.data, items: publicItems, customer: {}, delivery: {}, notes: null },
		};
	} catch {
		return {
			success: false,
			error: { code: "SHOP_ORDER_LOOKUP_ERROR", message: "Failed to find order" },
		};
	}
}

export async function handleShopPaymentConfirm(
	db: Kysely<Database>,
	orderId: string,
	confirmedBy: string,
): Promise<ApiResult<null>> {
	try {
		const now = new Date().toISOString();
		await db
			.updateTable("_emdash_shop_orders")
			.set({ payment_status: "confirmed", status: "confirmed", updated_at: now })
			.where("id", "=", orderId)
			.execute();
		await db
			.updateTable("_emdash_shop_payments")
			.set({ status: "confirmed", confirmed_by: confirmedBy, confirmed_at: now })
			.where("order_id", "=", orderId)
			.execute();
		return { success: true, data: null };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_PAYMENT_CONFIRM_ERROR", message: "Failed to confirm payment" },
		};
	}
}

export async function handleShopDeliveryUpdate(
	db: Kysely<Database>,
	orderId: string,
	status: string,
	courierName?: string,
): Promise<ApiResult<null>> {
	try {
		const now = new Date().toISOString();
		await db
			.updateTable("_emdash_shop_deliveries")
			.set({ status, courier_name: courierName ?? null, updated_at: now })
			.where("order_id", "=", orderId)
			.execute();
		const orderStatus =
			status === "delivered"
				? "delivered"
				: status === "in_transit"
					? "in_transit"
					: status === "not_delivered"
						? "not_delivered"
						: "ready";
		await db
			.updateTable("_emdash_shop_orders")
			.set({ delivery_status: status, status: orderStatus, updated_at: now })
			.where("id", "=", orderId)
			.execute();
		return { success: true, data: null };
	} catch {
		return {
			success: false,
			error: { code: "SHOP_DELIVERY_UPDATE_ERROR", message: "Failed to update delivery" },
		};
	}
}
