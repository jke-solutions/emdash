import { Button, Dialog, Input, Loader } from "@cloudflare/kumo";
import { EmailEditor, type EmailEditorProps, type EmailEditorRef } from "@react-email/editor";
import { StarterKit, StyleAttribute } from "@react-email/editor/extensions";
import { EmailTheming } from "@react-email/editor/plugins";
import type { PluginAdminExports } from "emdash";
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";

import {
	applyEmailSafeFont,
	DEFAULT_EMAIL_EDITOR_CONFIG,
	type EmailBlockType,
} from "./editor-config.js";
import { fetchEmailMedia, type EmailMediaItem } from "./media.js";

function t(parts: TemplateStringsArray): string {
	return parts[0] ?? "";
}

type UiIconName =
	| "moon"
	| "desktop"
	| "mobile"
	| "code"
	| "chevron"
	| "content"
	| "blocks"
	| "body";
type EditorJsonNode = { type?: string; text?: string; content?: EditorJsonNode[] };

const DEFAULT_BUTTON_ATTRIBUTES = {
	href: "https://example.com",
	alignment: "center",
	style:
		"background-color: #111827; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 600; text-decoration: none;",
};

const HIDDEN_LAYOUT_COMMAND_LABEL = /^(?:\d+ columns|section)$/i;
const EDITABLE_BLOCK_SELECTOR = "p,h1,h2,h3,li,blockquote,pre,hr,img,.node-h1,.node-h2,.node-h3";
const EMAIL_EDITOR_EXTENSIONS = [
	StarterKit.configure({ TrailingNode: false }),
	StyleAttribute.configure({ types: ["image"] }),
	EmailTheming.configure({ theme: "basic" }),
];
const IMAGE_RADIUS_RE = /border-radius:\s*([^;]+)/i;
const IMAGE_TAG_RE = /<img\b[^>]*>/gi;
const STYLE_ATTRIBUTE_RE = /\bstyle="([^"]*)"/i;
const ALIGN_ATTRIBUTE_RE = /\s+align="[^"]*"/i;
const MULTIPLE_SEMICOLONS_RE = /;;+/g;
const TAG_CLOSE_RE = />$/;

async function handleEmailImageUpload(file: File): Promise<{ url: string }> {
	return { url: URL.createObjectURL(file) };
}

function isEmptyEditorNode(value: EditorJsonNode): boolean {
	return !value.text?.trim() && !value.content?.some((child) => !isEmptyEditorNode(child));
}

function formatTemplateDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function templateSlug(name: string): string {
	return (
		name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "email-template"
	);
}

function applyImageLayout(html: string, content: EditorJsonNode): string {
	const images: Array<{ alignment?: string; style?: string }> = [];
	const collectImages = (node: EditorJsonNode) => {
		if (node.type === "image")
			images.push(node as EditorJsonNode & { alignment?: string; style?: string });
		for (const child of node.content ?? []) collectImages(child);
	};
	collectImages(content);
	let imageIndex = 0;
	return html.replace(IMAGE_TAG_RE, (tag) => {
		const image = images[imageIndex++];
		if (!image) return tag;
		const alignment = image.alignment ?? "center";
		const layout =
			alignment === "left"
				? "display:block;margin-left:0;margin-right:auto;"
				: alignment === "right"
					? "display:block;margin-left:auto;margin-right:0;"
					: "display:block;margin-left:auto;margin-right:auto;";
		const styleMatch = tag.match(STYLE_ATTRIBUTE_RE);
		const style =
			`${styleMatch?.[1] ?? ""}${image.style ? `;${image.style}` : ""};${layout}`.replace(
				MULTIPLE_SEMICOLONS_RE,
				";",
			);
		const withStyle = styleMatch
			? tag.replace(styleMatch[0], `style="${style}"`)
			: tag.replace(TAG_CLOSE_RE, ` style="${style}">`);
		return withStyle.replace(ALIGN_ATTRIBUTE_RE, "");
	});
}

function UiIcon({ name, size = 20 }: { name: UiIconName; size?: number }) {
	const paths: Record<UiIconName, ReactNode> = {
		moon: <path d="M18 12.5A7.5 7.5 0 0 1 9.5 4 7.5 7.5 0 1 0 18 12.5Z" />,
		desktop: (
			<>
				<rect x="3" y="4" width="18" height="12" rx="1.5" />
				<path d="M8 20h8M12 16v4" />
			</>
		),
		mobile: (
			<>
				<rect x="7" y="2.5" width="10" height="19" rx="1.5" />
				<path d="M10 18.5h4" />
			</>
		),
		code: (
			<>
				<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />
			</>
		),
		chevron: <path d="m6 9 6 6 6-6" />,
		content: (
			<>
				<circle cx="12" cy="6" r="2.5" />
				<circle cx="7" cy="17" r="2.5" />
				<circle cx="17" cy="17" r="2.5" />
				<path d="M12 8.5v3M9 15l3-3 3 3" />
			</>
		),
		blocks: (
			<>
				<rect x="4" y="4" width="6" height="6" rx="1" />
				<rect x="14" y="4" width="6" height="6" rx="1" />
				<rect x="4" y="14" width="6" height="6" rx="1" />
				<rect x="14" y="14" width="6" height="6" rx="1" />
			</>
		),
		body: (
			<>
				<rect x="4" y="5" width="16" height="14" rx="2" />
				<path d="M8 9h8M8 13h5" />
			</>
		),
	};
	return (
		<svg
			aria-hidden="true"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{paths[name]}
		</svg>
	);
}

const INITIAL_EDITOR_CONTENT: NonNullable<EmailEditorProps["content"]> = {
	type: "doc",
	content: [
		{
			type: "section",
			content: [
				{
					type: "heading",
					attrs: { level: 1, align: "center", alignment: "center", style: "text-align: center;" },
					content: [{ type: "text", text: "EmDash" }],
				},
				{
					type: "paragraph",
					attrs: { align: "center", alignment: "center", style: "text-align: center;" },
					content: [{ type: "text", text: "Transactional email template" }],
				},
				{ type: "horizontalRule" },
				{
					type: "paragraph",
					content: [{ type: "text", text: "Hi there," }],
				},
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "This is a demo transactional email created with the EmDash visual editor. You can replace this content with your own message.",
						},
					],
				},
				{
					type: "button",
					attrs: { ...DEFAULT_BUTTON_ATTRIBUTES, align: "center" },
					content: [{ type: "text", text: "Confirm email" }],
				},
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "If you did not request this email, you can safely ignore it." },
					],
				},
				{ type: "horizontalRule" },
				{
					type: "paragraph",
					attrs: { align: "center", alignment: "center", style: "text-align: center;" },
					content: [{ type: "text", text: "Thanks,\nThe EmDash team\n\n© EmDash CMS" }],
				},
			],
		},
	],
};

interface TemplateSummary {
	id: string;
	name: string;
	type: "transactional" | "campaign";
	status?: "draft" | "active";
	updatedAt: string;
}

interface TemplateListResult {
	items: TemplateSummary[];
}

interface TemplateDetail extends TemplateSummary {
	editableJson: NonNullable<EmailEditorProps["content"]>;
	html: string;
}

async function requestTemplateRoute<T>(route: string, body?: unknown): Promise<T> {
	const response = await fetch(`/_emdash/api/plugins/email-templates/${route}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
		body: JSON.stringify(body ?? {}),
	});
	const payload = (await response.json()) as { data?: T } & T;
	if (!response.ok) throw new Error("Template request failed");
	return payload.data ?? payload;
}

function insertBlock(
	editor: NonNullable<EmailEditorRef["editor"]>,
	blockType: EmailBlockType,
): void {
	switch (blockType) {
		case "section":
			editor.commands.insertContent({
				type: "section",
				content: [{ type: "paragraph" }],
			});
			return;
		case "columns":
			editor.commands.insertContent({
				type: "twoColumns",
				content: [
					{ type: "columnsColumn", content: [{ type: "paragraph" }] },
					{ type: "columnsColumn", content: [{ type: "paragraph" }] },
				],
			});
			return;
		case "heading":
			editor.commands.insertContent({
				type: "heading",
				attrs: { level: 1 },
				content: [{ type: "text", text: "Heading" }],
			});
			return;
		case "text":
			editor.commands.insertContent({
				type: "paragraph",
				content: [{ type: "text", text: "Write your message" }],
			});
			return;
		case "button":
			editor.commands.insertContent({
				type: "button",
				attrs: DEFAULT_BUTTON_ATTRIBUTES,
				content: [{ type: "text", text: "Call to action" }],
			});
			return;
		case "divider":
			editor.commands.insertContent({ type: "horizontalRule" });
			return;
		default:
			return;
	}
}

function insertImage(editor: NonNullable<EmailEditorRef["editor"]>, item: EmailMediaItem): void {
	editor.commands.insertContent({
		type: "image",
		attrs: {
			src: item.url,
			alt: item.alt || item.filename,
			width: item.width ? String(item.width) : undefined,
			height: item.height ? String(item.height) : undefined,
			alignment: "center",
		},
	});
}

function moveSelectedBlock(
	editor: NonNullable<EmailEditorRef["editor"]>,
	direction: -1 | 1,
): boolean {
	type EditableNode = { type?: string; content?: EditableNode[] };
	const documentJson = editor.getJSON() as EditableNode;
	const blockTypes = new Set([
		"heading",
		"paragraph",
		"button",
		"image",
		"horizontalRule",
		"columns",
	]);
	const locations: Array<{ parent: EditableNode; index: number }> = [];
	const collectLocations = (parent: EditableNode) => {
		parent.content?.forEach((child, index) => {
			if (child.type && blockTypes.has(child.type)) locations.push({ parent, index });
			collectLocations(child);
		});
	};
	collectLocations(documentJson);
	const buttonLocation = locations.find(
		(location) => location.parent.content?.[location.index]?.type === "button",
	);
	const buttonOrder = buttonLocation ? locations.indexOf(buttonLocation) : -1;
	const target = buttonOrder + direction;
	if (!buttonLocation || buttonOrder < 0 || target < 0 || target >= locations.length) return false;
	const targetLocation = locations[target];
	const button = buttonLocation.parent.content?.[buttonLocation.index];
	const targetNode = targetLocation?.parent.content?.[targetLocation.index];
	if (!button || !targetNode || !targetLocation) return false;
	buttonLocation.parent.content![buttonLocation.index] = targetNode;
	targetLocation.parent.content![targetLocation.index] = button;
	editor.commands.setContent(documentJson);
	return true;
}

function MoveBlockHandle({
	editor,
	position,
	onMoved,
}: {
	editor: NonNullable<EmailEditorRef["editor"]>;
	position: { top: number; left: number };
	onMoved: () => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<div
			className="absolute z-30"
			style={{ top: position.top, left: position.left, transform: "translateY(-50%)", zIndex: 50 }}
		>
			<button
				type="button"
				className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
				style={{
					backgroundColor: "#2563eb",
					border: "2px solid #93c5fd",
					color: "#ffffff",
					cursor: "grab",
					boxShadow: "0 2px 8px rgb(0 0 0 / 35%)",
					zIndex: 60,
				}}
				aria-label={t`Move block`}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => setOpen((value) => !value)}
			>
				↕
			</button>
			{open && (
				<div
					className="absolute flex min-w-32 flex-col gap-1 rounded-md border border-slate-600 p-1.5 shadow-xl"
					style={{
						right: "calc(100% + 0.5rem)",
						top: "50%",
						transform: "translateY(-50%)",
						minWidth: "8rem",
						backgroundColor: "#111827",
						zIndex: 40,
					}}
				>
					<button
						type="button"
						className="flex h-9 w-full items-center gap-2 rounded px-3 text-start text-sm font-semibold text-white hover:bg-slate-700"
						aria-label={t`Move block up`}
						onMouseDown={(event) => {
							event.preventDefault();
							if (moveSelectedBlock(editor, -1)) onMoved();
							setOpen(false);
						}}
					>
						↑ {t`Up`}
					</button>
					<button
						type="button"
						className="flex h-9 w-full items-center gap-2 rounded px-3 text-start text-sm font-semibold text-white hover:bg-slate-700"
						aria-label={t`Move block down`}
						onMouseDown={(event) => {
							event.preventDefault();
							if (moveSelectedBlock(editor, 1)) onMoved();
							setOpen(false);
						}}
					>
						↓ {t`Down`}
					</button>
				</div>
			)}
		</div>
	);
}

function FloatingButtonToolbar({
	editor,
	position,
	onPin,
	onUnpin,
	onClose,
	onDelete,
}: {
	editor: NonNullable<EmailEditorRef["editor"]>;
	position: { top: number; left: number };
	onPin: () => void;
	onUnpin: () => void;
	onClose: () => void;
	onDelete: () => void;
}) {
	const [linkOpen, setLinkOpen] = useState(false);
	const [href, setHref] = useState("");
	const buttonPositionRef = useRef(editor.state.selection.from);

	useEffect(() => {
		setHref((editor.getAttributes("button") as { href?: string }).href ?? "");
	}, [editor, linkOpen]);

	const saveLink = () => {
		editor.commands.setNodeSelection(buttonPositionRef.current);
		editor.commands.updateAttributes("button", { href: href || null });
		setLinkOpen(false);
		onUnpin();
	};

	return (
		<div
			className="absolute z-30 flex -translate-x-1/2 -translate-y-full flex-col gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-white shadow-xl"
			style={{
				top: position.top,
				left: position.left,
				zIndex: 30,
				backgroundColor: "#111827",
				color: "#ffffff",
			}}
			role="toolbar"
			aria-label={t`Button formatting toolbar`}
			onMouseDown={(event) => {
				if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
			}}
		>
			<div className="flex items-center gap-1">
				{[
					["Bold", "B", () => editor.chain().focus().toggleMark("bold").run()],
					["Italic", "I", () => editor.chain().focus().toggleMark("italic").run()],
					["Underline", "U", () => editor.chain().focus().toggleMark("underline").run()],
					["Strikethrough", "S", () => editor.chain().focus().toggleMark("strike").run()],
				].map(([label, icon, action]) => (
					<button
						key={label as string}
						type="button"
						className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold text-white hover:bg-slate-700"
						aria-label={label as string}
						onClick={action as () => void}
					>
						{icon as string}
					</button>
				))}
				<span className="mx-1 h-5 w-px bg-slate-700" aria-hidden="true" />
				<button
					type="button"
					className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold text-white hover:bg-slate-700"
					aria-label={t`Edit button link`}
					onClick={() => {
						buttonPositionRef.current = editor.state.selection.from;
						setLinkOpen((open) => !open);
						onPin();
					}}
				>
					✎
				</button>
				<button
					type="button"
					className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold text-white hover:bg-slate-700"
					aria-label={t`Delete button`}
					onClick={() => {
						setLinkOpen(false);
						onDelete();
					}}
				>
					<svg
						aria-hidden="true"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
					</svg>
				</button>
				<button
					type="button"
					className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold text-white hover:bg-slate-700"
					aria-label={t`Close button editor`}
					onClick={() => {
						setLinkOpen(false);
						onClose();
					}}
				>
					×
				</button>
			</div>
			{linkOpen && (
				<div className="flex min-w-64 flex-col gap-2 border-t border-slate-700 pt-2">
					<label className="text-xs font-medium text-slate-300">{t`Link URL`}</label>
					<input
						value={href}
						onChange={(event) => setHref(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") saveLink();
						}}
						placeholder="https://example.com"
						aria-label={t`Link URL`}
						className="h-9 rounded-md border border-slate-600 bg-slate-800 px-2 text-sm text-white outline-none focus:border-blue-400"
					/>
					<div className="flex items-center justify-between gap-2">
						<div className="flex gap-1" aria-label={t`Button alignment`}>
							{(
								[
									["left", "L"],
									["center", "C"],
									["right", "R"],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									className="h-7 min-w-7 rounded px-2 text-xs text-white hover:bg-slate-700"
									onClick={() => editor.commands.updateAttributes("button", { alignment: value })}
								>
									{label}
								</button>
							))}
						</div>
						<button
							type="button"
							className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
							onClick={saveLink}
						>{t`Apply`}</button>
					</div>
				</div>
			)}
		</div>
	);
}

function FloatingImageToolbar({
	editor,
	position,
	imagePosition,
	onApplied,
}: {
	editor: NonNullable<EmailEditorRef["editor"]>;
	position: { top: number; left: number };
	imagePosition: number | null;
	onApplied: () => void;
}) {
	const attrs = editor.getAttributes("image") as {
		width?: string;
		height?: string;
		alignment?: string;
		style?: string;
	};
	const [width, setWidth] = useState(attrs.width === "auto" ? "" : (attrs.width ?? ""));
	const [height, setHeight] = useState(attrs.height === "auto" ? "" : (attrs.height ?? ""));
	const [alignment, setAlignment] = useState(attrs.alignment ?? "center");
	const [radius, setRadius] = useState(attrs.style?.match(IMAGE_RADIUS_RE)?.[1] ?? "0px");
	const applyImageSettings = () => {
		if (imagePosition !== null) editor.commands.setNodeSelection(imagePosition);
		const alignmentStyle =
			alignment === "left"
				? "display:block;margin-left:0;margin-right:auto;"
				: alignment === "right"
					? "display:block;margin-left:auto;margin-right:0;"
					: "display:block;margin-left:auto;margin-right:auto;";
		editor.commands.updateAttributes("image", {
			width: width.trim() || "auto",
			height: height.trim() || "auto",
			alignment,
			style: `${alignmentStyle}border-radius:${radius};`,
		});
		onApplied();
	};

	return (
		<div
			className="absolute grid grid-cols-2 gap-2 rounded-lg border border-slate-600 p-3 text-xs text-white shadow-xl"
			style={{
				top: position.top,
				left: position.left,
				zIndex: 80,
				pointerEvents: "auto",
				backgroundColor: "#111827",
				transform: "translateY(8px)",
			}}
			onMouseDown={(event) => event.stopPropagation()}
		>
			<label className="grid gap-1">
				<span>{t`Width (px)`}</span>
				<input
					className="w-24 rounded border border-slate-500 px-2 py-1 text-white"
					style={{ backgroundColor: "#1e293b", colorScheme: "dark" }}
					type="number"
					min="1"
					value={width}
					placeholder={t`Auto`}
					onChange={(event) => setWidth(event.target.value)}
				/>
			</label>
			<label className="grid gap-1">
				<span>{t`Height (px)`}</span>
				<input
					className="w-24 rounded border border-slate-500 px-2 py-1 text-white"
					style={{ backgroundColor: "#1e293b", colorScheme: "dark" }}
					type="number"
					min="1"
					value={height}
					placeholder={t`Auto`}
					onChange={(event) => setHeight(event.target.value)}
				/>
			</label>
			<label className="grid gap-1">
				<span>{t`Align`}</span>
				<select
					className="w-24 rounded border border-slate-500 px-1 py-1 text-white"
					style={{ backgroundColor: "#1e293b", color: "#fff", colorScheme: "dark" }}
					value={alignment}
					onChange={(event) => setAlignment(event.target.value)}
				>
					<option
						value="left"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Left`}</option>
					<option
						value="center"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Center`}</option>
					<option
						value="right"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Right`}</option>
				</select>
			</label>
			<label className="grid gap-1">
				<span>{t`Corners`}</span>
				<select
					className="w-24 rounded border border-slate-500 px-1 py-1 text-white"
					style={{ backgroundColor: "#1e293b", color: "#fff", colorScheme: "dark" }}
					value={radius}
					onChange={(event) => setRadius(event.target.value)}
				>
					<option
						value="0px"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Square (0%)`}</option>
					<option
						value="6px"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Soft (5%)`}</option>
					<option
						value="12px"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Rounded (10%)`}</option>
					<option
						value="24px"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Large (20%)`}</option>
					<option
						value="50%"
						style={{ backgroundColor: "#1e293b", color: "#fff" }}
					>{t`Circle (50%)`}</option>
				</select>
			</label>
			<button
				type="button"
				className="col-span-2 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
				style={{ backgroundColor: "#2563eb" }}
				onClick={applyImageSettings}
			>{t`Apply`}</button>
		</div>
	);
}

function MediaPicker({
	open,
	onOpenChange,
	onSelect,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (item: EmailMediaItem) => void;
}) {
	const [items, setItems] = useState<EmailMediaItem[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setSearch("");
		setLoading(true);
		setError(null);
		void fetchEmailMedia()
			.then((result) => setItems(result.items))
			.catch(() => setError("The media gallery could not be loaded."))
			.finally(() => setLoading(false));
	}, [open]);

	const searchGallery = () => {
		setLoading(true);
		setError(null);
		void fetchEmailMedia({ search })
			.then((result) => setItems(result.items))
			.catch(() => setError("The media gallery could not be loaded."))
			.finally(() => setLoading(false));
	};

	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog className="flex max-h-[80vh] max-w-3xl flex-col p-6" size="lg">
				<Dialog.Title className="text-lg font-semibold">{t`Select an image`}</Dialog.Title>
				<div className="mt-4 flex gap-2">
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={t`Search the media gallery`}
						onKeyDown={(event) => {
							if (event.key === "Enter") searchGallery();
						}}
					/>
					<Button variant="outline" onClick={searchGallery}>{t`Search`}</Button>
				</div>
				<div className="mt-4 min-h-48 flex-1 overflow-y-auto">
					{loading ? (
						<div className="flex items-center justify-center py-16">
							<Loader size="sm" />
						</div>
					) : error ? (
						<p className="py-16 text-center text-kumo-subtle">{error}</p>
					) : items.length === 0 ? (
						<p className="py-16 text-center text-kumo-subtle">{t`No images found in the media gallery.`}</p>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{items.map((item) => (
								<button
									key={item.id}
									type="button"
									className="overflow-hidden rounded-md border text-start hover:border-kumo-brand focus:outline-none focus:ring-2 focus:ring-kumo-ring"
									onClick={() => {
										onSelect(item);
										onOpenChange(false);
									}}
								>
									<img
										src={item.url}
										alt={item.alt || item.filename}
										className="aspect-square w-full object-cover"
									/>
									<span className="block truncate p-2 text-xs">{item.filename}</span>
								</button>
							))}
						</div>
					)}
				</div>
				<div className="mt-4 flex justify-end border-t pt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>{t`Cancel`}</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
}

function EmailPreview({ html, onClose }: { html: string; onClose: () => void }) {
	const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
	const [showCode, setShowCode] = useState(false);
	const [darkMode, setDarkMode] = useState(false);
	const [showViewportSettings, setShowViewportSettings] = useState(false);
	const [width, setWidth] = useState("1024");
	const [height, setHeight] = useState("600");
	const previewWidth = device === "mobile" ? "375" : width;

	return (
		<div className="overflow-hidden rounded-lg border border-kumo-line bg-kumo-base">
			<div className="relative flex items-center justify-between gap-4 bg-kumo-inverse px-4 py-3 text-kumo-inverse-foreground">
				<div className="flex items-center gap-3">
					<Button variant="ghost" onClick={onClose} className="text-kumo-inverse-foreground">
						{t`Back to editor`}
					</Button>
					<span className="font-semibold">{t`Email preview`}</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						shape="square"
						aria-label={t`Toggle dark mode`}
						onClick={() => setDarkMode((value) => !value)}
						className="text-xl text-kumo-inverse-foreground"
					>
						<UiIcon name="moon" size={21} />
					</Button>
					<div className="flex overflow-hidden rounded-md border border-kumo-inverse-foreground/30">
						<Button
							variant={!showCode && device === "desktop" ? "primary" : "ghost"}
							shape="square"
							aria-label={t`Desktop preview`}
							onClick={() => {
								setShowCode(false);
								setDevice("desktop");
							}}
							className="text-lg text-kumo-inverse-foreground"
						>
							<UiIcon name="desktop" />
						</Button>
						<Button
							variant={!showCode && device === "mobile" ? "primary" : "ghost"}
							shape="square"
							aria-label={t`Mobile preview`}
							onClick={() => {
								setShowCode(false);
								setDevice("mobile");
							}}
							className="text-lg text-kumo-inverse-foreground"
						>
							<UiIcon name="mobile" />
						</Button>
						<Button
							variant={showCode ? "primary" : "ghost"}
							shape="square"
							aria-label={t`View HTML`}
							onClick={() => setShowCode((value) => !value)}
							className="text-lg text-kumo-inverse-foreground"
						>
							<UiIcon name="code" />
						</Button>
					</div>
					<div className="relative">
						<Button
							variant="ghost"
							shape="square"
							aria-label={t`Viewport settings`}
							onClick={() => setShowViewportSettings((value) => !value)}
							className="text-lg text-kumo-inverse-foreground"
						>
							<UiIcon name="chevron" />
						</Button>
						{showViewportSettings && (
							<div
								className="absolute end-0 top-12 z-10 grid gap-3 rounded-lg border border-kumo-line p-4 shadow-xl"
								style={{ width: "18rem", backgroundColor: "#050505", color: "#ffffff" }}
							>
								<label className="flex items-center justify-between gap-3 text-sm">
									<span className="font-medium text-white">{t`Width`}</span>
									<Input
										className="w-32"
										type="number"
										min="240"
										max="1600"
										value={width}
										onChange={(event) => setWidth(event.target.value)}
									/>
								</label>
								<label className="flex items-center justify-between gap-3 text-sm">
									<span className="font-medium text-white">{t`Height`}</span>
									<Input
										className="w-32"
										type="number"
										min="320"
										max="1400"
										value={height}
										onChange={(event) => setHeight(event.target.value)}
									/>
								</label>
							</div>
						)}
					</div>
				</div>
			</div>
			{showCode ? (
				<pre className="max-h-[42rem] overflow-auto bg-kumo-inverse p-6 text-xs text-kumo-inverse-foreground">
					{html}
				</pre>
			) : (
				<div
					className="flex min-h-[44rem] justify-center overflow-auto p-8"
					style={{ backgroundColor: darkMode ? "#16181d" : "#aeb3bd" }}
				>
					<div
						className="relative flex w-full max-w-[90rem] flex-col overflow-hidden rounded-xl border border-kumo-line"
						style={{ backgroundColor: darkMode ? "#20242b" : "#c8cbd1", minHeight: "44rem" }}
					>
						<div className="flex h-8 shrink-0 items-center justify-center" aria-hidden="true">
							<span className="h-1.5 w-12 rounded-full bg-kumo-subtle" />
						</div>
						<div className="flex flex-1 justify-center overflow-auto px-6 py-4 sm:px-16">
							<iframe
								title={t`Rendered email preview`}
								srcDoc={html}
								className="shrink-0 border-0 bg-white shadow-sm"
								style={{ width: `${previewWidth}px`, height: `${height}px`, minHeight: "32rem" }}
							/>
						</div>
						<div className="flex h-8 shrink-0 items-center justify-center" aria-hidden="true">
							<span className="h-1.5 w-12 rounded-full bg-kumo-subtle" />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function EmailTemplatesPage() {
	const editorRef = useRef<EmailEditorRef>(null);
	const editorShellRef = useRef<HTMLDivElement>(null);
	const [html, setHtml] = useState("");
	const [templateId, setTemplateId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [draggedBlock, setDraggedBlock] = useState<EmailBlockType | null>(null);
	const [imagePickerOpen, setImagePickerOpen] = useState(false);
	const [templates, setTemplates] = useState<TemplateSummary[]>([]);
	const [templateSearch, setTemplateSearch] = useState("");
	const [templatePage, setTemplatePage] = useState(1);
	const [templateName, setTemplateName] = useState("Transactional email template");
	const [testTemplateId, setTestTemplateId] = useState<string | null>(null);
	const [testEmail, setTestEmail] = useState("");
	const [testSending, setTestSending] = useState(false);
	const [testMessage, setTestMessage] = useState<string | null>(null);
	const [showEditor, setShowEditor] = useState(false);
	const [editorContent, setEditorContent] =
		useState<NonNullable<EmailEditorProps["content"]>>(INITIAL_EDITOR_CONTENT);
	const [editorVersion, setEditorVersion] = useState(0);
	const [loadingTemplate, setLoadingTemplate] = useState(false);
	const [activePanel, setActivePanel] = useState<"content" | "blocks" | "body">("content");
	const [previewMode, setPreviewMode] = useState(false);
	const [activeEditor, setActiveEditor] = useState<NonNullable<EmailEditorRef["editor"]> | null>(
		null,
	);
	const [buttonSelected, setButtonSelected] = useState(false);
	const [imageSelected, setImageSelected] = useState(false);
	const [selectedImagePosition, setSelectedImagePosition] = useState<number | null>(null);
	const [toolbarPinned, setToolbarPinned] = useState(false);
	const toolbarDismissedRef = useRef(false);
	const selectedButtonRef = useRef<HTMLElement | null>(null);
	const selectedButtonKeyRef = useRef<{ href: string; text: string } | null>(null);
	const activeParagraphRef = useRef<HTMLElement | null>(null);
	const suppressSelectionTrackingRef = useRef(false);
	const insertionPositionRef = useRef<number | null>(null);
	const [selectedBlockBounds, setSelectedBlockBounds] = useState<{
		top: number;
		left: number;
		width: number;
		height: number;
	} | null>(null);
	const [activeParagraphBounds, setActiveParagraphBounds] = useState<{
		top: number;
		left: number;
		width: number;
		height: number;
	} | null>(null);
	const [buttonToolbarPosition, setButtonToolbarPosition] = useState({ top: 0, left: 0 });
	const [buttonHandlePosition, setButtonHandlePosition] = useState({ top: 0, left: 0 });
	const [imageToolbarPosition, setImageToolbarPosition] = useState({ top: 0, left: 0 });
	const filteredTemplates = templates.filter((template) =>
		template.name.toLowerCase().includes(templateSearch.trim().toLowerCase()),
	);
	const templatePageCount = Math.max(1, Math.ceil(filteredTemplates.length / 10));
	const pagedTemplates = filteredTemplates.slice((templatePage - 1) * 10, templatePage * 10);

	useEffect(() => {
		if (templatePage > templatePageCount) setTemplatePage(templatePageCount);
	}, [templatePage, templatePageCount]);
	const positionActiveBlock = (block: HTMLElement) => {
		activeParagraphRef.current = block;
		const shellRect = editorShellRef.current?.getBoundingClientRect();
		if (!shellRect) return;
		const paragraphRect = block.getBoundingClientRect();
		setActiveParagraphBounds({
			top: paragraphRect.top - shellRect.top - 5,
			left: paragraphRect.left - shellRect.left - 5,
			width: paragraphRect.width + 10,
			height: Math.max(paragraphRect.height, 34) + 10,
		});
	};
	const positionSelectedButton = (button: HTMLElement) => {
		const shellRect = editorShellRef.current?.getBoundingClientRect();
		if (!shellRect) return;
		const buttonRect = button.getBoundingClientRect();
		const blockRect = button.parentElement?.getBoundingClientRect() ?? buttonRect;
		setSelectedBlockBounds({
			top: blockRect.top - shellRect.top - 6,
			left: blockRect.left - shellRect.left - 6,
			width: blockRect.width + 12,
			height: blockRect.height + 12,
		});
		setButtonToolbarPosition({
			top: Math.max(4, buttonRect.top - shellRect.top - 8),
			left: buttonRect.left - shellRect.left + buttonRect.width / 2,
		});
		setButtonHandlePosition({
			top: blockRect.top - shellRect.top + blockRect.height / 2,
			left: blockRect.right - shellRect.left + 16,
		});
	};
	const refreshSelectedButtonPosition = () => {
		const key = selectedButtonKeyRef.current;
		if (!key || !activeEditor) return;
		const button = [...activeEditor.view.dom.querySelectorAll<HTMLElement>(".node-button")].find(
			(candidate) =>
				candidate.dataset.href === key.href && candidate.textContent?.trim() === key.text,
		);
		if (button) positionSelectedButton(button);
	};

	useEffect(() => {
		if (!activeEditor) return;
		let editorView: typeof activeEditor.view;
		try {
			editorView = activeEditor.view;
		} catch {
			return;
		}
		const editorDom = editorView.dom;
		const updateActiveBlock = () => {
			if (suppressSelectionTrackingRef.current) return;
			const selection = window.getSelection();
			const anchor = selection?.anchorNode;
			const element =
				anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor?.parentElement;
			const block = element?.closest<HTMLElement>(EDITABLE_BLOCK_SELECTOR);
			if (!block || !editorDom.contains(block)) return;
			positionActiveBlock(block);
			setButtonSelected(false);
		};
		const selectButton = (event: MouseEvent) => {
			const insertionPosition = editorView.posAtCoords({
				left: event.clientX,
				top: event.clientY,
			})?.pos;
			if (insertionPosition !== undefined) insertionPositionRef.current = insertionPosition;
			const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(".node-button");
			const image = (event.target as HTMLElement | null)?.closest<HTMLElement>("img");
			if (image) {
				const shellRect = editorShellRef.current?.getBoundingClientRect();
				const imageRect = image.getBoundingClientRect();
				if (shellRect)
					setImageToolbarPosition({
						top: Math.max(8, imageRect.top - shellRect.top - 140),
						left: imageRect.left - shellRect.left,
					});
				const imagePosition = editorView.posAtDOM(image, 0);
				if (editorView.state.doc.nodeAt(imagePosition)?.type.name === "image") {
					activeEditor?.commands.setNodeSelection(imagePosition);
					setSelectedImagePosition(imagePosition);
				}
				positionActiveBlock(image);
				setImageSelected(true);
				setButtonSelected(false);
				return;
			}
			if (!button) {
				const block = (event.target as HTMLElement | null)?.closest<HTMLElement>(
					EDITABLE_BLOCK_SELECTOR,
				);
				if (!block) return;
				positionActiveBlock(block);
				setImageSelected(false);
				setButtonSelected(false);
				return;
			}
			toolbarDismissedRef.current = false;
			setActiveParagraphBounds(null);
			setImageSelected(false);
			selectedButtonRef.current = button;
			selectedButtonKeyRef.current = {
				href: button.dataset.href ?? "",
				text: button.textContent?.trim() ?? "",
			};
			positionSelectedButton(button);
			setButtonSelected(true);
		};
		const clearSelectionOutsideEditor = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (target && editorShellRef.current?.contains(target)) return;
			activeParagraphRef.current = null;
			setActiveParagraphBounds(null);
			setImageSelected(false);
		};
		editorDom.addEventListener("mousedown", selectButton, true);
		document.addEventListener("selectionchange", updateActiveBlock);
		document.addEventListener("mousedown", clearSelectionOutsideEditor, true);
		return () => {
			editorDom.removeEventListener("mousedown", selectButton, true);
			document.removeEventListener("selectionchange", updateActiveBlock);
			document.removeEventListener("mousedown", clearSelectionOutsideEditor, true);
		};
	}, [activeEditor]);

	useEffect(() => {
		if (!buttonSelected) return;
		refreshSelectedButtonPosition();
		window.addEventListener("resize", refreshSelectedButtonPosition);
		return () => window.removeEventListener("resize", refreshSelectedButtonPosition);
	}, [buttonSelected, editorContent, editorVersion]);

	useEffect(() => {
		let mounted = true;
		void requestTemplateRoute<TemplateListResult>("templates/list")
			.then((result) => {
				if (mounted) {
					setTemplates(result.items);
					setShowEditor((current) => current || result.items.length === 0);
				}
				return result;
			})
			.catch(() => {
				if (mounted) setMessage(t`Saved templates could not be loaded.`);
			});
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		const hideUnsupportedLayoutCommands = () => {
			document.querySelectorAll<HTMLElement>("[data-re-slash-command-item]").forEach((item) => {
				if (HIDDEN_LAYOUT_COMMAND_LABEL.test(item.textContent?.trim() ?? ""))
					item.style.display = "none";
			});
		};
		const observer = new MutationObserver(hideUnsupportedLayoutCommands);
		observer.observe(document.body, { childList: true, subtree: true });
		hideUnsupportedLayoutCommands();
		return () => observer.disconnect();
	}, []);

	const loadTemplate = (id: string) => {
		if (!id) return;
		setLoadingTemplate(true);
		setShowEditor(true);
		setMessage(null);
		void requestTemplateRoute<TemplateDetail>("templates/get", { id })
			.then((template) => {
				setTemplateId(template.id);
				setTemplateName(template.name);
				setEditorContent(template.editableJson);
				setHtml(template.html);
				setEditorVersion((version) => version + 1);
				window.requestAnimationFrame(() =>
					editorShellRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
				);
				return template;
			})
			.catch(() => setMessage(t`The template could not be loaded.`))
			.finally(() => setLoadingTemplate(false));
	};

	const startNewTemplate = () => {
		setShowEditor(true);
		setTemplateId(null);
		setTemplateName("Transactional email template");
		setEditorContent(INITIAL_EDITOR_CONTENT);
		setHtml("");
		setMessage(null);
		setEditorVersion((version) => version + 1);
	};

	const addBlock = (blockType: EmailBlockType) => {
		if (blockType === "image") {
			setImagePickerOpen(true);
			return;
		}
		const editor = editorRef.current?.editor;
		if (!editor) return;
		if (insertionPositionRef.current !== null)
			editor.commands.setTextSelection(insertionPositionRef.current);
		insertBlock(editor, blockType);
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		const blockType = event.dataTransfer.getData(
			"application/x-emdash-email-block",
		) as EmailBlockType;
		const editor = editorRef.current?.editor;
		const insertionPosition = editor?.view.posAtCoords({
			left: event.clientX,
			top: event.clientY,
		})?.pos;
		if (insertionPosition !== undefined) insertionPositionRef.current = insertionPosition;
		if (blockType) addBlock(blockType);
		setDraggedBlock(null);
	};

	const exportHtml = async () => {
		if (!editorRef.current) return;
		const editableJson = editorRef.current.getJSON() as EditorJsonNode;
		setHtml(
			applyEmailSafeFont(applyImageLayout(await editorRef.current.getEmailHTML(), editableJson)),
		);
		setActiveEditor(null);
		setActiveParagraphBounds(null);
		setSelectedBlockBounds(null);
		setButtonSelected(false);
		setToolbarPinned(false);
		setPreviewMode(true);
	};

	const returnToEditor = () => {
		setActiveEditor(null);
		setActiveParagraphBounds(null);
		setSelectedBlockBounds(null);
		setButtonSelected(false);
		setToolbarPinned(false);
		setPreviewMode(false);
	};

	const returnToList = () => {
		setPreviewMode(false);
		setActiveEditor(null);
		setActiveParagraphBounds(null);
		setSelectedBlockBounds(null);
		setButtonSelected(false);
		setToolbarPinned(false);
		setShowEditor(false);
	};

	const saveTemplate = async () => {
		if (!editorRef.current) return;
		const name = templateName.trim();
		if (!name) {
			setMessage(t`Enter a name for the template.`);
			return;
		}
		setSaving(true);
		setMessage(null);
		try {
			const editableJson = editorRef.current.getJSON() as EditorJsonNode;
			const nextHtml = applyEmailSafeFont(
				applyImageLayout(await editorRef.current.getEmailHTML(), editableJson),
			);
			const route = templateId ? "templates/update" : "templates/create";
			const body = templateId
				? { id: templateId, name, editableJson, html: nextHtml }
				: {
						name,
						slug: templateSlug(name),
						type: "transactional",
						subject: t`Transactional email preview`,
						editableJson,
						html: nextHtml,
					};
			const response = await fetch(`/_emdash/api/plugins/email-templates/${route}`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-EmDash-Request": "1" },
				body: JSON.stringify(body),
			});
			if (!response.ok) throw new Error("save failed");
			const payload = (await response.json()) as { data?: { id?: string }; id?: string };
			const result = payload.data ?? payload;
			if (!templateId && result.id) setTemplateId(result.id);
			setHtml(nextHtml);
			setMessage(t`Template saved successfully.`);
			void requestTemplateRoute<TemplateListResult>("templates/list").then((list) =>
				setTemplates(list.items),
			);
		} catch {
			setMessage(t`The template could not be saved.`);
		} finally {
			setSaving(false);
		}
	};

	const sendTestEmail = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!testTemplateId || !testEmail.trim()) return;
		setTestSending(true);
		setTestMessage(null);
		try {
			await requestTemplateRoute("templates/send", { id: testTemplateId, to: testEmail.trim() });
			setTestTemplateId(null);
			setTestEmail("");
			setMessage(t`Test email sent successfully.`);
		} catch {
			setTestMessage(t`The test email could not be sent. Check the email provider settings.`);
		} finally {
			setTestSending(false);
		}
	};

	const deleteSelectedButton = () => {
		const key = selectedButtonKeyRef.current;
		if (!activeEditor || !key) return;
		const button = [...activeEditor.view.dom.querySelectorAll<HTMLElement>(".node-button")].find(
			(candidate) =>
				candidate.dataset.href === key.href && candidate.textContent?.trim() === key.text,
		);
		if (!button) return;
		const position = activeEditor.view.posAtDOM(button, 0) - 1;
		activeEditor.commands.setNodeSelection(position);
		activeEditor.commands.deleteSelection();
		selectedButtonKeyRef.current = null;
		selectedButtonRef.current = null;
		setSelectedBlockBounds(null);
		setButtonSelected(false);
		setToolbarPinned(false);
	};

	const deleteActiveParagraph = () => {
		const paragraph = activeParagraphRef.current;
		if (!activeEditor || !paragraph || !activeEditor.view.dom.contains(paragraph)) return;
		if (paragraph.tagName === "IMG") {
			suppressSelectionTrackingRef.current = true;
			const imagePos = activeEditor.view.posAtDOM(paragraph, 0);
			const imageNode = activeEditor.state.doc.nodeAt(imagePos);
			if (imageNode?.type.name === "image")
				activeEditor.commands.deleteRange({ from: imagePos, to: imagePos + imageNode.nodeSize });
			activeParagraphRef.current = null;
			setActiveParagraphBounds(null);
			setImageSelected(false);
			window.requestAnimationFrame(() => {
				suppressSelectionTrackingRef.current = false;
			});
			return;
		}
		suppressSelectionTrackingRef.current = true;
		const from = activeEditor.view.posAtDOM(paragraph, 0) - 1;
		const node = activeEditor.state.doc.nodeAt(from);
		if (!node) return;
		activeEditor.commands.deleteRange({ from, to: from + node.nodeSize });
		activeParagraphRef.current = null;
		setActiveParagraphBounds(null);
		setImageSelected(false);
		window.requestAnimationFrame(() => {
			suppressSelectionTrackingRef.current = false;
		});
		window.requestAnimationFrame(() => {
			const documentJson = activeEditor.getJSON() as EditorJsonNode;
			let changed = false;
			const removeEmptyListItems = (parent: EditorJsonNode): boolean => {
				if (!parent.content) return true;
				parent.content = parent.content.filter((child) => {
					if (!removeEmptyListItems(child)) {
						changed = true;
						return false;
					}
					return true;
				});
				if (parent.type !== "bulletList" && parent.type !== "orderedList") return true;
				const items = parent.content.filter((item) => !isEmptyEditorNode(item));
				if (items.length !== parent.content.length) changed = true;
				parent.content = items;
				return items.length > 0;
			};
			removeEmptyListItems(documentJson);
			if (changed) activeEditor.commands.setContent(documentJson);
		});
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold">{t`Email Templates`}</h1>
					<p className="mt-1 text-kumo-subtle">{t`Create and edit transactional email templates.`}</p>
				</div>
				<div className="flex gap-2">
					{showEditor ? (
						<>
							<Button variant="outline" onClick={returnToList}>{t`Back to templates`}</Button>
							<Button onClick={() => (previewMode ? returnToEditor() : void exportHtml())}>
								{previewMode ? t`Back to editor` : t`Preview HTML`}
							</Button>
							<Button onClick={() => void saveTemplate()} disabled={saving}>
								{saving ? t`Saving…` : t`Save template`}
							</Button>
						</>
					) : (
						<>
							<Button
								variant="outline"
								onClick={() => {
									window.location.href = "/_emdash/admin/plugins-manager/email-templates/settings";
								}}
							>
								{t`Email settings`}
							</Button>
							<Button
								onClick={startNewTemplate}
								disabled={loadingTemplate}
							>{t`New template`}</Button>
						</>
					)}
				</div>
			</div>
			{message && (
				<p className="text-sm text-kumo-subtle" role="status">
					{message}
				</p>
			)}
			{showEditor && !previewMode && (
				<div className="max-w-xl rounded-lg border border-kumo-line bg-kumo-base p-4">
					<Input
						label={t`Template name`}
						value={templateName}
						onChange={(event) => setTemplateName(event.target.value)}
						placeholder={t`Example: Welcome email`}
						maxLength={120}
						required
					/>
					<p className="mt-2 text-xs text-kumo-subtle">{t`Choose a descriptive name to find this template later.`}</p>
				</div>
			)}
			{previewMode && html ? (
				<EmailPreview html={html} onClose={returnToEditor} />
			) : showEditor ? (
				<div
					className="overflow-hidden rounded-lg border border-kumo-line bg-kumo-base"
					style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(20rem, 25rem)" }}
				>
					<aside
						className="min-h-[42rem] border-s border-kumo-line bg-kumo-base"
						style={{
							gridColumn: 2,
							gridRow: 1,
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) 4.75rem",
						}}
						data-email-sidebar="true"
						aria-label={t`Email blocks`}
					>
						<div
							className="grid border-s border-kumo-line bg-kumo-base"
							style={{ gridColumn: 2, gridRow: 1, gridTemplateRows: "repeat(3, 1fr)" }}
							role="tablist"
							aria-label={t`Editor panels`}
						>
							{(["content", "blocks", "body"] as const).map((panel) => (
								<button
									key={panel}
									type="button"
									role="tab"
									aria-selected={activePanel === panel}
									onClick={() => setActivePanel(panel)}
									className={`flex min-w-24 flex-col items-center justify-center gap-2 border-s-2 px-3 py-4 text-xs font-semibold capitalize ${activePanel === panel ? "border-kumo-brand text-kumo-brand" : "border-transparent text-kumo-subtle"}`}
								>
									<span className="text-xl">
										<UiIcon name={panel} size={24} />
									</span>
									{panel}
								</button>
							))}
						</div>
						<div className="p-4" style={{ gridColumn: 1, gridRow: 1 }}>
							{activePanel !== "body" ? (
								<>
									<p className="mb-3 text-sm font-semibold">{t`Content blocks`}</p>
									<div
										className="grid grid-cols-3"
										style={{
											display: "grid",
											gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
											gap: "0.75rem",
										}}
									>
										{DEFAULT_EMAIL_EDITOR_CONFIG.blocks.map((block) => (
											<Button
												key={block.type}
												draggable
												variant="outline"
												className="flex min-h-24 flex-col items-center justify-center gap-2 text-xs"
												style={{
													minHeight: "5.5rem",
													display: "flex",
													flexDirection: "column",
													alignItems: "center",
													justifyContent: "center",
													gap: "0.5rem",
													padding: "0.75rem",
													lineHeight: 1.2,
													width: "100%",
												}}
												disabled={
													block.type === "spacer" ||
													block.type === "social" ||
													block.type === "html"
												}
												onClick={() => addBlock(block.type)}
												onDragStart={(event) => {
													event.dataTransfer.setData(
														"application/x-emdash-email-block",
														block.type,
													);
													event.dataTransfer.effectAllowed = "copy";
													setDraggedBlock(block.type);
												}}
												onDragEnd={() => setDraggedBlock(null)}
											>
												<span className="text-xl" aria-hidden="true">
													{block.type === "image"
														? "▧"
														: block.type === "button"
															? "▭"
															: block.type === "heading"
																? "H"
																: block.type === "divider"
																	? "—"
																	: block.type === "columns"
																		? "▥"
																		: "¶"}
												</span>
												<span>{block.label}</span>
											</Button>
										))}
									</div>
								</>
							) : (
								<div className="space-y-3 text-sm text-kumo-subtle">
									<p>{t`Email body`}</p>
									<p>{t`Use safe system fonts and responsive email-compatible spacing.`}</p>
								</div>
							)}
							{draggedBlock && (
								<p className="text-xs text-kumo-subtle">{t`Drop the block into the email canvas.`}</p>
							)}
						</div>
					</aside>
					<div
						className="flex min-h-[42rem] items-start justify-center p-8"
						style={{
							gridColumn: 1,
							gridRow: 1,
							minWidth: 0,
							overflow: "hidden",
							backgroundColor: "#d5d8de",
						}}
						onDragOver={(event) => event.preventDefault()}
						onDrop={handleDrop}
					>
						<div
							ref={editorShellRef}
							className={`email-template-editor relative ${buttonSelected || toolbarPinned ? "button-node-selected" : ""}`}
							style={{ width: "100%", maxWidth: "54rem", minWidth: 0, minHeight: "30rem" }}
						>
							<style>{`.email-template-editor .node-container,.email-template-editor .tiptap{width:100% !important;max-width:100% !important;min-width:0 !important;box-sizing:border-box;}.email-template-editor .node-h1,.email-template-editor .node-h2,.email-template-editor .node-h3,.email-template-editor .node-h1 + p,.email-template-editor .align-center{text-align:center;}.email-template-editor .email-block-selected{position:relative;min-height:4.5rem;display:flex;align-items:center;justify-content:center;outline:2px solid #3b82f6;outline-offset:6px;}.email-template-editor .email-node-selected{outline:none;box-shadow:none;}.email-template-editor [data-re-bubble-menu]{display:none !important;}[data-re-slash-command]{display:flex;flex-direction:column;max-height:330px;width:256px;overflow:hidden;background:#111827 !important;border:1px solid #475569 !important;color:#f8fafc !important;box-shadow:0 12px 28px rgb(0 0 0 / 35%);z-index:70 !important;}[data-re-slash-command-scroll]{flex:1 1 auto;min-height:0;overflow-y:auto;padding:.25rem;}[data-re-slash-command-item]{display:flex;align-items:center;gap:.5rem;width:100%;padding:.375rem .5rem;border:0;border-radius:.375rem;background:transparent;color:#f8fafc !important;font-size:.875rem;line-height:1.25rem;text-align:start;}[data-re-slash-command-item] svg{flex-shrink:0;}[data-re-slash-command-item]:hover,[data-re-slash-command-item][data-selected]{background:#334155 !important;}[data-re-slash-command-category]{padding:.5rem .5rem .25rem;font-size:.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#cbd5e1 !important;}[data-re-slash-command-empty]{padding:.75rem .5rem;font-size:.875rem;text-align:center;color:#cbd5e1 !important;}`}</style>
							<style>{`.email-template-editor .node-hr{height:2px !important;margin-block:22px !important;padding:0 !important;border:0 !important;border-top:2px solid #e5e7eb !important;}`}</style>
							<style>{`.email-template-editor .node-container{width:100% !important;max-width:600px !important;margin-inline:auto !important;}`}</style>
							{selectedBlockBounds && buttonSelected && (
								<div
									aria-hidden="true"
									className="pointer-events-none absolute z-10"
									style={{ ...selectedBlockBounds, border: "3px solid #3b82f6" }}
								>
									<div
										className="absolute"
										style={{
											top: -7,
											insetInlineStart: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<div
										className="absolute"
										style={{
											top: -7,
											insetInlineEnd: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<div
										className="absolute"
										style={{
											bottom: -7,
											insetInlineStart: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<div
										className="absolute"
										style={{
											bottom: -7,
											insetInlineEnd: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
								</div>
							)}
							{activeParagraphBounds && !buttonSelected && (
								<div
									className="pointer-events-none absolute"
									style={{ ...activeParagraphBounds, zIndex: 60, border: "3px solid #3b82f6" }}
								>
									<div
										aria-hidden="true"
										className="absolute"
										style={{
											top: -7,
											insetInlineStart: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<div
										aria-hidden="true"
										className="absolute"
										style={{
											top: -7,
											insetInlineEnd: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<div
										aria-hidden="true"
										className="absolute"
										style={{
											bottom: -7,
											insetInlineStart: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<div
										aria-hidden="true"
										className="absolute"
										style={{
											bottom: -7,
											insetInlineEnd: -7,
											width: 12,
											height: 12,
											backgroundColor: "#3b82f6",
										}}
									/>
									<button
										type="button"
										className="pointer-events-auto absolute flex items-center justify-center rounded-full"
										style={{
											top: -20,
											insetInlineEnd: -20,
											width: 40,
											height: 40,
											zIndex: 90,
											backgroundColor: "#dc2626",
											color: "#ffffff",
											boxShadow: "0 4px 12px rgb(0 0 0 / 30%)",
										}}
										aria-label={t`Delete selected block`}
										onPointerDown={(event) => {
											event.preventDefault();
											event.stopPropagation();
										}}
										onClick={(event) => {
											event.stopPropagation();
											deleteActiveParagraph();
										}}
									>
										<svg
											aria-hidden="true"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2.25"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6" />
										</svg>
									</button>
								</div>
							)}
							{imageSelected && activeEditor && (
								<FloatingImageToolbar
									editor={activeEditor}
									position={imageToolbarPosition}
									imagePosition={selectedImagePosition}
									onApplied={() => {
										setImageSelected(false);
										activeParagraphRef.current = null;
										setActiveParagraphBounds(null);
									}}
								/>
							)}
							{(buttonSelected || toolbarPinned) && activeEditor && (
								<FloatingButtonToolbar
									editor={activeEditor}
									position={buttonToolbarPosition}
									onPin={() => setToolbarPinned(true)}
									onUnpin={() => setToolbarPinned(false)}
									onClose={() => {
										toolbarDismissedRef.current = true;
										selectedButtonRef.current = null;
										setSelectedBlockBounds(null);
										setButtonSelected(false);
										setToolbarPinned(false);
									}}
									onDelete={deleteSelectedButton}
								/>
							)}
							{(buttonSelected || toolbarPinned) && activeEditor && (
								<MoveBlockHandle
									editor={activeEditor}
									position={buttonHandlePosition}
									onMoved={() => window.requestAnimationFrame(refreshSelectedButtonPosition)}
								/>
							)}
							<EmailEditor
								key={editorVersion}
								ref={editorRef}
								onReady={(ref) => {
									const editor = ref.editor ?? null;
									if (!editor) return;
									window.requestAnimationFrame(() => {
										try {
											if (!editor.isDestroyed && editor.view.dom.isConnected)
												setActiveEditor(editor);
										} catch {
											setActiveEditor(null);
										}
									});
								}}
								content={editorContent}
								extensions={EMAIL_EDITOR_EXTENSIONS}
								onUploadImage={handleEmailImageUpload}
								className="min-h-[30rem] w-full rounded-md bg-white"
								bubbleMenu={{ hideWhenActiveNodes: [], hideWhenActiveMarks: [] }}
							/>
						</div>
					</div>
				</div>
			) : (
				<section
					className="overflow-hidden rounded-lg border border-kumo-line bg-kumo-base"
					aria-labelledby="saved-email-templates-title"
				>
					<div className="flex items-center justify-between gap-4 border-b border-kumo-line p-4">
						<div>
							<h2
								id="saved-email-templates-title"
								className="text-xl font-semibold"
							>{t`Saved templates`}</h2>
							<p className="mt-1 text-sm text-kumo-subtle">{t`Manage your email templates and open one to edit its details.`}</p>
						</div>
						<span className="text-sm text-kumo-subtle">
							{filteredTemplates.length} {t`templates`}
						</span>
					</div>
					<div className="border-b border-kumo-line p-3">
						<input
							className="h-10 w-full max-w-sm rounded-md border border-kumo-line bg-kumo-elevated px-3 text-sm outline-none focus:border-kumo-brand"
							placeholder={t`Search templates...`}
							aria-label={t`Search templates`}
							value={templateSearch}
							onChange={(event) => {
								setTemplateSearch(event.target.value);
								setTemplatePage(1);
							}}
						/>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full table-fixed text-sm" style={{ tableLayout: "fixed" }}>
							<colgroup>
								<col style={{ width: "35%" }} />
								<col style={{ width: "18%" }} />
								<col style={{ width: "14%" }} />
								<col style={{ width: "18%" }} />
								<col style={{ width: "15%" }} />
							</colgroup>
							<thead className="bg-kumo-elevated text-start text-kumo-subtle">
								<tr>
									<th
										className="text-start font-medium"
										style={{ padding: "12px 16px" }}
									>{t`Name`}</th>
									<th
										className="text-start font-medium"
										style={{ padding: "12px 16px" }}
									>{t`Type`}</th>
									<th
										className="text-start font-medium"
										style={{ padding: "12px 16px" }}
									>{t`Status`}</th>
									<th
										className="text-start font-medium"
										style={{ padding: "12px 16px" }}
									>{t`Updated`}</th>
									<th
										className="text-end font-medium"
										style={{ padding: "12px 16px" }}
									>{t`Actions`}</th>
								</tr>
							</thead>
							<tbody>
								{pagedTemplates.map((template) => (
									<tr
										key={template.id}
										className="border-t border-kumo-line hover:bg-kumo-elevated/60"
									>
										<td className="font-medium" style={{ padding: "12px 16px" }}>
											{template.name}
										</td>
										<td className="text-kumo-subtle" style={{ padding: "12px 16px" }}>
											{template.type === "campaign" ? t`Campaign` : t`Transactional`}
										</td>
										<td style={{ padding: "12px 16px" }}>
											<span
												className={
													template.status === "active"
														? "rounded-full bg-kumo-success/15 px-2 py-1 text-xs text-kumo-success"
														: "rounded-full bg-kumo-elevated px-2 py-1 text-xs text-kumo-subtle"
												}
											>
												{template.status === "active" ? t`Active` : t`Draft`}
											</span>
										</td>
										<td className="text-kumo-subtle" style={{ padding: "12px 16px" }}>
											{formatTemplateDate(template.updatedAt)}
										</td>
										<td className="text-end whitespace-nowrap" style={{ padding: "12px 16px" }}>
											<div className="flex justify-end gap-2">
												<Button
													variant="outline"
													onClick={() => loadTemplate(template.id)}
													disabled={loadingTemplate}
												>{t`Open`}</Button>
												<Button
													variant="outline"
													onClick={() => {
														setTestTemplateId(template.id);
														setTestMessage(null);
													}}
												>
													{t`Send test`}
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="flex items-center justify-between gap-4 border-t border-kumo-line p-3 text-sm text-kumo-subtle">
						<span>
							{t`Page`} {templatePage} {t`of`} {templatePageCount}
						</span>
						<div className="flex gap-2">
							<Button
								variant="outline"
								disabled={templatePage === 1}
								onClick={() => setTemplatePage((page) => page - 1)}
							>{t`Previous`}</Button>
							<Button
								variant="outline"
								disabled={templatePage === templatePageCount}
								onClick={() => setTemplatePage((page) => page + 1)}
							>{t`Next`}</Button>
						</div>
					</div>
				</section>
			)}
			<MediaPicker
				open={imagePickerOpen}
				onOpenChange={setImagePickerOpen}
				onSelect={(item) => {
					const editor = editorRef.current?.editor;
					if (!editor) return;
					if (insertionPositionRef.current !== null)
						editor.commands.setTextSelection(insertionPositionRef.current);
					insertImage(editor, item);
				}}
			/>
			<Dialog.Root
				open={testTemplateId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setTestTemplateId(null);
						setTestMessage(null);
					}
				}}
			>
				<Dialog className="w-[min(28rem,calc(100vw-2rem))] p-6" size="sm">
					<div className="mb-5 flex items-start justify-between gap-4">
						<div>
							<Dialog.Title className="text-lg font-semibold">{t`Send a test email`}</Dialog.Title>
							<p className="mt-1 text-sm text-kumo-subtle">
								{templates.find((template) => template.id === testTemplateId)?.name ??
									t`Selected template`}
							</p>
						</div>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} variant="ghost" shape="square" aria-label={t`Close`}>
									×
								</Button>
							)}
						/>
					</div>
					<form className="space-y-4" onSubmit={sendTestEmail}>
						<Input
							label={t`Recipient email`}
							type="email"
							value={testEmail}
							onChange={(event) => setTestEmail(event.target.value)}
							placeholder={t`you@example.com`}
							required
							autoFocus
						/>
						{testMessage && (
							<p className="text-sm text-kumo-danger" role="alert">
								{testMessage}
							</p>
						)}
						<div className="flex justify-end gap-2">
							<Dialog.Close
								render={(props) => <Button {...props} variant="secondary">{t`Cancel`}</Button>}
							/>
							<Button type="submit" disabled={testSending}>
								{testSending ? t`Sending…` : t`Send test`}
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{showEditor && html && (
				<pre className="max-h-64 overflow-auto rounded-lg border border-kumo-line bg-kumo-tint p-4 text-xs">
					{html}
				</pre>
			)}
		</div>
	);
}

export const pages: PluginAdminExports["pages"] = {
	"/": EmailTemplatesPage,
};
