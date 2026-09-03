import { z } from "zod";

const moneyCode = z.string().regex(/^[A-Z]{3}$/, "Currency must be an ISO 4217 code");

export const shopSettingsUpdateBody = z
	.object({
		storeName: z.string().max(200).optional(),
		currency: moneyCode.optional(),
		currencySymbol: z.string().min(1).max(8).optional(),
		whatsappNumber: z.string().max(30).nullable().optional(),
		whatsappMessage: z.string().max(1000).nullable().optional(),
		paymentMethods: z.array(z.string().min(1).max(50)).max(20).optional(),
		deliveryInstructions: z.string().max(2000).nullable().optional(),
		businessHours: z.string().max(1000).nullable().optional(),
		paymentGatewayEnabled: z.boolean().optional(),
		paymentGatewayProvider: z.string().max(100).nullable().optional(),
		paymentGatewayEnvironment: z.enum(["sandbox", "production"]).optional(),
		paymentGatewayPublicKey: z.string().max(1000).nullable().optional(),
		paymentGatewaySecretKey: z.string().max(2000).nullable().optional(),
		paymentGatewayWebhookSecret: z.string().max(2000).nullable().optional(),
		paymentGatewayReturnUrl: z.string().max(2000).nullable().optional(),
		paymentGatewayWebhookUrl: z.string().max(2000).nullable().optional(),
	})
	.meta({ id: "ShopSettingsUpdateBody" });

export const shopOrderCreateBody = z
	.object({
		items: z
			.array(
				z.object({
					productId: z.string().min(1),
					variantId: z.string().min(1).optional(),
					quantity: z.number().int().min(1).max(100),
				}),
			)
			.min(1)
			.max(100),
		customer: z.object({
			name: z.string().min(1).max(200),
			phone: z.string().min(5).max(30),
			email: z.string().email().optional(),
			address: z.string().min(1).max(500),
			district: z.string().min(1).max(200),
			reference: z.string().max(500).optional(),
		}),
		deliveryZoneId: z.string().min(1),
		paymentMethod: z.string().min(1).max(50),
		couponCode: z.string().trim().max(50).optional(),
		notes: z.string().max(2000).optional(),
	})
	.meta({ id: "ShopOrderCreateBody" });

export const shopPaymentConfirmBody = z
	.object({
		reference: z.string().max(200).optional(),
		notes: z.string().max(1000).optional(),
	})
	.meta({ id: "ShopPaymentConfirmBody" });

export const shopDeliveryUpdateBody = z
	.object({
		status: z.enum(["pending", "assigned", "in_transit", "delivered", "not_delivered"]),
		courierName: z.string().max(200).optional(),
		trackingCode: z.string().max(200).nullable().optional(),
		trackingUrl: z.string().url().max(2000).nullable().optional(),
	})
	.meta({ id: "ShopDeliveryUpdateBody" });

export const shopDeliveryZoneCreateBody = z
	.object({
		name: z.string().min(1).max(200),
		districts: z.array(z.string().min(1).max(200)).max(100),
		deliveryCost: z.number().min(0),
		estimatedTime: z.string().max(200).nullable().optional(),
		active: z.boolean().optional(),
	})
	.meta({ id: "ShopDeliveryZoneCreateBody" });

export const shopDeliveryZoneUpdateBody = shopDeliveryZoneCreateBody.partial().meta({
	id: "ShopDeliveryZoneUpdateBody",
});

const shopCouponFields = {
	code: z.string().trim().min(1).max(50),
	discountType: z.enum(["percentage", "fixed"]),
	discountValue: z.number().positive(),
	minimumSubtotal: z.number().min(0).optional(),
	startsAt: z.string().datetime().nullable().optional(),
	expiresAt: z.string().datetime().nullable().optional(),
	usageLimit: z.number().int().positive().nullable().optional(),
	active: z.boolean().optional(),
};

function refineCouponSchema<T extends z.ZodTypeAny>(schema: T) {
	return schema
		.refine(
			(value) => {
				if (typeof value !== "object" || value === null) return true;
				if (!("discountType" in value) || !("discountValue" in value)) return true;
				return (
					value.discountType !== "percentage" ||
					(typeof value.discountValue !== "number" ? true : value.discountValue <= 100)
				);
			},
			{
				message: "Percentage discount cannot exceed 100",
				path: ["discountValue"],
			},
		)
		.refine(
			(value) => {
				if (typeof value !== "object" || value === null) return true;
				if (!("startsAt" in value) || !("expiresAt" in value)) return true;
				return (
					typeof value.startsAt !== "string" ||
					typeof value.expiresAt !== "string" ||
					value.startsAt < value.expiresAt
				);
			},
			{
				message: "Start date must be before expiry date",
				path: ["expiresAt"],
			},
		);
}

export const shopCouponCreateBody = refineCouponSchema(z.object(shopCouponFields)).meta({
	id: "ShopCouponCreateBody",
});

export const shopCouponUpdateBody = refineCouponSchema(z.object(shopCouponFields).partial()).meta({
	id: "ShopCouponUpdateBody",
});

export const shopCouponValidateBody = z
	.object({ code: z.string().trim().min(1).max(50), subtotal: z.number().min(0) })
	.meta({ id: "ShopCouponValidateBody" });
