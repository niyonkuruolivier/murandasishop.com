import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const WA_BUCKET = "whatsapp-proofs";
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

/** Uploads a WhatsApp payment screenshot to the private bucket under the user's folder. */
export async function uploadWhatsappProof(file: File): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error("You must be signed in to upload proof.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(WA_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  // Return storage path; signed URLs are minted on demand for viewing.
  return path;
}

export async function signWhatsappProof(path: string, ttlSeconds = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from(WA_BUCKET)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}
