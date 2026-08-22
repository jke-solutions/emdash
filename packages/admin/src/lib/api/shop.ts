import { API_BASE, apiFetch, parseApiResponse } from "./client.js";

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

export interface ShopSettingsUpdateInput extends Partial<Omit<ShopSettings, "id">> {
	paymentGatewaySecretKey?: string | null;
	paymentGatewayWebhookSecret?: string | null;
}

export interface ShopDeliveryZone {
	id: string;
	name: string;
	districts: string[];
	deliveryCost: number;
	estimatedTime: string | null;
	active: boolean;
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
	}>;
	customer: Record<string, unknown>;
	delivery: Record<string, unknown>;
	notes: string | null;
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

async function get<T>(path: string): Promise<T> {
	return parseApiResponse<T>(await apiFetch(`${API_BASE}${path}`));
}

async function mutate<T>(path: string, method: string, body: unknown): Promise<T> {
	return parseApiResponse<T>(
		await apiFetch(`${API_BASE}${path}`, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

export function fetchShopSettings(): Promise<ShopSettings> {
	return get("/admin/shop/settings");
}

export function updateShopSettings(input: ShopSettingsUpdateInput): Promise<ShopSettings> {
	return mutate("/admin/shop/settings", "PUT", input);
}

export function fetchShopDeliveryZones(): Promise<ShopDeliveryZone[]> {
	return get("/admin/shop/delivery-zones");
}

export function createShopDeliveryZone(input: {
	name: string;
	districts: string[];
	deliveryCost: number;
	estimatedTime?: string | null;
	active?: boolean;
}): Promise<ShopDeliveryZone> {
	return mutate("/admin/shop/delivery-zones", "POST", input);
}

export function updateShopDeliveryZone(id: string, input: Partial<Parameters<typeof createShopDeliveryZone>[0]>): Promise<ShopDeliveryZone> {
	return mutate(`/admin/shop/delivery-zones/${encodeURIComponent(id)}`, "PATCH", input);
}

export function deleteShopDeliveryZone(id: string): Promise<null> {
	return mutate(`/admin/shop/delivery-zones/${encodeURIComponent(id)}`, "DELETE", undefined);
}

export function fetchShopOrders(): Promise<ShopOrderSummary[]> {
	return get("/admin/shop/orders");
}

export function fetchShopCustomers(): Promise<ShopCustomerSummary[]> {
	return get("/admin/shop/customers");
}

export function fetchShopOrder(id: string): Promise<ShopOrderDetail> {
	return get(`/admin/shop/orders/${encodeURIComponent(id)}`);
}

export function confirmShopPayment(id: string, input: { reference?: string; notes?: string } = {}): Promise<null> {
	return mutate(`/admin/shop/orders/${encodeURIComponent(id)}/payment`, "POST", input);
}

export function updateShopDelivery(id: string, input: { status: string; courierName?: string }): Promise<null> {
	return mutate(`/admin/shop/orders/${encodeURIComponent(id)}/delivery`, "PATCH", input);
}
