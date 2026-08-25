import type { RouteContext, StorageCollection } from "emdash";
import { PluginRouteError, ulid } from "emdash";
import { z } from "zod";

export const templateCreateSchema = z.object({
	name: z.string().min(1).max(120),
	slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
	type: z.enum(["transactional", "campaign"]),
	subject: z.string().min(1).max(200),
	editableJson: z.unknown(),
	html: z.string().min(1),
});

const templateId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i);
export const templateUpdateSchema = templateCreateSchema.partial().extend({ id: templateId });
export const templateIdSchema = z.object({ id: templateId });
export const templateSendSchema = z.object({
	id: templateId,
	to: z.string().email(),
});

export interface EmailTemplateRecord {
	name: string;
	slug: string;
	type: "transactional" | "campaign";
	status: "draft" | "active";
	subject: string;
	editableJson: unknown;
	html: string;
	createdAt: string;
	updatedAt: string;
}

function objectKey(id: string, format: "json" | "html"): string {
	return `email-templates/templates/${id}.${format}`;
}

function requireFiles(ctx: RouteContext) {
	if (!ctx.files) throw PluginRouteError.badRequest("Email template storage is not configured");
	return ctx.files;
}

async function saveTemplateObjects(
	ctx: RouteContext,
	id: string,
	editableJson: unknown,
	html: string,
) {
	const files = requireFiles(ctx);
	await files.upload({
		key: objectKey(id, "json"),
		body: new TextEncoder().encode(JSON.stringify(editableJson)),
		contentType: "application/json",
	});
	await files.upload({
		key: objectKey(id, "html"),
		body: new TextEncoder().encode(html),
		contentType: "text/html; charset=utf-8",
	});
}

async function readTemplateObjects(ctx: RouteContext, id: string) {
	const files = requireFiles(ctx);
	const json = await files.download(objectKey(id, "json"));
	const html = await files.download(objectKey(id, "html"));
	return {
		editableJson: JSON.parse(await new Response(json.body).text()) as unknown,
		html: await new Response(html.body).text(),
	};
}

function textFromHtml(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function templates(ctx: RouteContext): StorageCollection<EmailTemplateRecord> {
	return ctx.storage.templates as StorageCollection<EmailTemplateRecord>;
}

async function assertTemplateTypeEnabled(
	ctx: RouteContext,
	type: EmailTemplateRecord["type"],
): Promise<void> {
	if (type === "campaign" && (await ctx.kv.get<boolean>("settings:campaignsEnabled")) !== true) {
		throw PluginRouteError.forbidden("Email campaigns are disabled");
	}
}

export async function listTemplatesHandler(ctx: RouteContext) {
	const result = await templates(ctx).query({ orderBy: { updatedAt: "desc" }, limit: 100 });
	return {
		items: result.items.map((item) => ({ id: item.id, ...item.data })),
		hasMore: result.hasMore,
	};
}

export async function getTemplateHandler(ctx: RouteContext<{ id: string }>) {
	const item = await templates(ctx).get(ctx.input.id);
	if (!item) throw PluginRouteError.notFound("Email template not found");
	return { id: ctx.input.id, ...item, ...(await readTemplateObjects(ctx, ctx.input.id)) };
}

export async function createTemplateHandler(
	ctx: RouteContext<z.infer<typeof templateCreateSchema>>,
) {
	await assertTemplateTypeEnabled(ctx, ctx.input.type);
	const existing = await templates(ctx).query({ where: { slug: ctx.input.slug }, limit: 1 });
	if (existing.items.length > 0) throw PluginRouteError.conflict("Template slug already exists");
	const now = new Date().toISOString();
	const record: EmailTemplateRecord = {
		...ctx.input,
		status: "draft",
		createdAt: now,
		updatedAt: now,
	};
	const id = ulid();
	await saveTemplateObjects(ctx, id, record.editableJson, record.html);
	await templates(ctx).put(id, record);
	return { id, ...record };
}

export async function updateTemplateHandler(
	ctx: RouteContext<z.infer<typeof templateUpdateSchema>>,
) {
	const item = await templates(ctx).get(ctx.input.id);
	if (!item) throw PluginRouteError.notFound("Email template not found");
	await assertTemplateTypeEnabled(ctx, ctx.input.type ?? item.type);
	if (ctx.input.slug && ctx.input.slug !== item.slug) {
		const existing = await templates(ctx).query({ where: { slug: ctx.input.slug }, limit: 1 });
		if (existing.items.some((candidate) => candidate.id !== ctx.input.id)) {
			throw PluginRouteError.conflict("Template slug already exists");
		}
	}
	const { id, ...input } = ctx.input;
	const record = { ...item, ...input, updatedAt: new Date().toISOString() };
	await saveTemplateObjects(ctx, id, record.editableJson, record.html);
	await templates(ctx).put(id, record);
	return { id, ...record };
}

export async function deleteTemplateHandler(ctx: RouteContext<{ id: string }>) {
	const item = await templates(ctx).get(ctx.input.id);
	if (!item) throw PluginRouteError.notFound("Email template not found");
	const files = requireFiles(ctx);
	await files.delete(objectKey(ctx.input.id, "json"));
	await files.delete(objectKey(ctx.input.id, "html"));
	await templates(ctx).delete(ctx.input.id);
	return { id: ctx.input.id };
}

export async function sendTemplateHandler(ctx: RouteContext<z.infer<typeof templateSendSchema>>) {
	const item = await templates(ctx).get(ctx.input.id);
	if (!item) throw PluginRouteError.notFound("Email template not found");
	await assertTemplateTypeEnabled(ctx, item.type);
	if (!ctx.email) throw PluginRouteError.badRequest("Email provider is not configured");

	const payload = await readTemplateObjects(ctx, ctx.input.id);
	await ctx.email.send({
		to: ctx.input.to,
		subject: item.subject,
		text: textFromHtml(payload.html),
		html: payload.html,
	});
	return { sent: true, id: ctx.input.id, to: ctx.input.to };
}
