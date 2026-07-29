import { supabase } from "@/integrations/supabase/client";

const BUCKET = "payment-proofs";
const SIGNED_URL_TTL = 60 * 60; // 1h

export type PaymentVerification = {
  id: string;
  user_id: string | null;
  order_id: string | null;
  customer_name: string;
  phone: string;
  amount: number;
  order_number: string | null;
  note: string | null;
  screenshot_url: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentAudit = {
  id: string;
  verification_id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  note: string | null;
  created_at: string;
};

/** Build the MTN MoMo USSD string for a given FRW amount. */
export function mtnUssdCode(amount: number): string {
  const amt = Math.max(0, Math.floor(amount || 0));
  return `*182*8*1*1153211*${amt}#`;
}

/** tel: URI (# must be URL-encoded so mobile dialers accept it). */
export function mtnUssdTelHref(amount: number): string {
  return `tel:${encodeURIComponent(mtnUssdCode(amount))}`;
}

const ACCEPTED = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];

export async function uploadPaymentProof(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error("Unsupported file type. Upload a JPG, PNG, or PDF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large. Max 10MB.");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id ?? "guest";
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function signPaymentProof(path: string, ttlSeconds = SIGNED_URL_TTL): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

export type SubmitVerificationInput = {
  customer_name: string;
  phone: string;
  amount: number;
  order_number?: string;
  note?: string;
  order_id?: string | null;
  screenshot_url: string; // storage path
};

export async function submitPaymentVerification(
  input: SubmitVerificationInput,
): Promise<{ id: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id ?? null;
  const insertRow = {
    user_id: userId,
    order_id: input.order_id ?? null,
    customer_name: input.customer_name,
    phone: input.phone,
    amount: input.amount,
    order_number: input.order_number ?? null,
    note: input.note ?? null,
    screenshot_url: input.screenshot_url,
  };
  if (userId) {
    const { data, error } = await supabase
      .from("payment_verifications")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }
  const { error } = await supabase.from("payment_verifications").insert(insertRow);
  if (error) throw error;
  return { id: "" };
}
