/** File picker accept list — all common product image formats including HEIC/AVIF. */
export const PRODUCT_IMAGE_ACCEPT =
  "image/*,.jpg,.jpeg,.jpe,.jfif,.png,.gif,.webp,.avif,.svg,.bmp,.tif,.tiff,.ico,.heic,.heif,.apng";

export const PRODUCT_IMAGE_HINT =
  "JPG, PNG, GIF, WebP, AVIF, SVG, BMP, TIFF, HEIC, and other image formats";

export function isAllowedProductImage(file: File): boolean {
  if (String(file.type || "").startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|jpe|jfif|pjpeg|pjp|png|gif|webp|avif|svgz?|bmp|tiff?|ico|heic|heif|apng)$/i.test(name);
}
