import type { UploadedDocument } from "@/types";

/**
 * Derives the effective document status by checking expiry_date.
 * A document with status "approved" but past its expiry_date is effectively "expired".
 */
export function getEffectiveDocStatus(doc: UploadedDocument | undefined): string {
  if (!doc) return "not_uploaded";
  if (
    doc.status === "approved" &&
    doc.expiry_date &&
    new Date(doc.expiry_date) < new Date()
  ) {
    return "expired";
  }
  return doc.status;
}

/**
 * Check if a document is expiring within the next 30 days.
 */
export function isDocExpiringSoon(doc: UploadedDocument | undefined): boolean {
  if (!doc || doc.status !== "approved" || !doc.expiry_date) return false;
  const expiry = new Date(doc.expiry_date);
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return expiry > now && expiry <= thirtyDays;
}
