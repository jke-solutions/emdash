import {
	EDITABLE_IMAGE_TYPES,
	isEditableImage,
	replaceFileExtension,
} from "../../src/lib/image-processing.js";

describe("image processing input rules", () => {
	it("accepts the image formats supported by the editor", () => {
		for (const type of EDITABLE_IMAGE_TYPES) {
			expect(isEditableImage(new File(["image"], `source.${type.split("/")[1]}`, { type }))).toBe(true);
		}
	});

	it("rejects formats that are not safe for the editor", () => {
		expect(isEditableImage(new File(["image"], "animation.gif", { type: "image/gif" }))).toBe(false);
		expect(isEditableImage(new File(["markup"], "icon.svg", { type: "image/svg+xml" }))).toBe(false);
		expect(isEditableImage(new File(["document"], "document.pdf", { type: "application/pdf" }))).toBe(false);
	});
});

describe("replaceFileExtension", () => {
	it("replaces the final extension while preserving the filename", () => {
		expect(replaceFileExtension("product.photo.jpeg", "webp")).toBe("product.photo.webp");
	});

	it("creates a usable name when the original filename has no extension", () => {
		expect(replaceFileExtension("image", "webp")).toBe("image.webp");
		expect(replaceFileExtension(".jpeg", "webp")).toBe("image.webp");
	});
});
