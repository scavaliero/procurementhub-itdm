import type { UploadedDocument } from "@/types";

/**
 * Derives the effective document status by checking expiry_date.
 * A document with status "approved" but past its expiry_date is effectively "expired".
 * The document expires the day AFTER the expiry_date (i.e., the expiry date itself is the last valid day).
 */
export function getEffectiveDocStatus(doc: UploadedDocument | undefined): string {
  if (!doc) return "not_uploaded";
  if (
    doc.status === "approved" &&
    doc.expiry_date
  ) {
    // Compare dates only (no time component)
    // Document is valid through the entire expiry_date day
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (todayStr > doc.expiry_date) {
      return "expired";
    }
  }
  return doc.status;
}

/**
 * Check if a document is expiring within the next 30 days.
 */
export function isDocExpiringSoon(doc: UploadedDocument | undefined): boolean {
  if (!doc || doc.status !== "approved" || !doc.expiry_date) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // Not expired yet
  if (todayStr > doc.expiry_date) return false;
  // Check if within 30 days
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const thirtyStr = `${thirtyDaysLater.getFullYear()}-${String(thirtyDaysLater.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysLater.getDate()).padStart(2, "0")}`;
  return doc.expiry_date <= thirtyStr;
}
