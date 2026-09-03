import { z } from "zod";

import { httpUrl } from "./common.js";

export const promotionalCampaignBody = z
	.object({
		title: z.string().trim().min(1).max(200),
		content: z.array(z.record(z.string(), z.unknown())).max(100),
		mediaId: z.string().trim().min(1).nullable().optional(),
		buttonLabel: z.string().trim().max(100).optional(),
		buttonUrl: z.union([httpUrl, z.literal("")]).optional(),
		pageScope: z.enum(["all", "home"]),
		isActive: z.boolean(),
		startsAt: z.string().datetime({ offset: true }).nullable().optional(),
		endsAt: z.string().datetime({ offset: true }).nullable().optional(),
		modalSize: z.enum(["square", "rectangle", "custom"]).default("rectangle"),
		modalWidth: z.number().int().min(280).max(1200).nullable().optional(),
		modalHeight: z.number().int().min(280).max(1200).nullable().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endsAt"],
				message: "endsAt must be after startsAt",
			});
		}
		if (value.modalSize === "custom" && (!value.modalWidth || !value.modalHeight)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["modalWidth"],
				message: "Custom modal size requires width and height",
			});
		}
	})
	.meta({ id: "PromotionalCampaignBody" });
