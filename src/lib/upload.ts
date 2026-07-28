import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
// 10 years in seconds — long-lived signed URL so images work publicly.
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

export async function uploadProductImages(files: FileList | File[]): Promise<string[]> {
  const arr = Array.from(files);
  const urls: string[] = [];
  for (const f of arr) urls.push(await uploadProductImage(f));
  return urls;
}
