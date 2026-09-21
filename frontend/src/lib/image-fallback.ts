// Shared image-fallback helper.
//
// Product/marketing images come from Cloudinary and admin-entered URLs, so a
// dead link or a host that fails to load would otherwise render the browser's
// broken-image icon. Attach `onImgError` to any raw <img> to swap in a local
// placeholder on failure. It guards against infinite loops (if the placeholder
// itself fails) by clearing the handler after the first swap.

export const PRODUCT_IMAGE_FALLBACK = "/placeholder-product.svg";

export function onImgError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallback: string = PRODUCT_IMAGE_FALLBACK
) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "true") return;
  img.dataset.fallbackApplied = "true";
  img.src = fallback;
}
