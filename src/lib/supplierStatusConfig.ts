/**
 * Single source of truth for supplier status labels and badge variants.
 * Import this everywhere instead of duplicating status maps.
 */

export const SUPPLIER_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pre_registered:   { label: "Pre-registrato",     variant: "outline" },
  pending_review:   { label: "In revisione",        variant: "secondary" },
  enabled:          { label: "Abilitato",            variant: "secondary" },
  in_accreditation: { label: "In accreditamento",   variant: "secondary" },
  in_approval:      { label: "In approvazione",     variant: "secondary" },
  accredited:       { label: "Accreditato",          variant: "default" },
  suspended:        { label: "Sospeso",              variant: "destructive" },
  rejected:         { label: "Rifiutato",            variant: "destructive" },
  revoked:          { label: "Revocato",             variant: "destructive" },
  blacklisted:      { label: "Blacklist",            variant: "destructive" },
};

/** Plural labels used in dashboard KPI cards and metric aggregates */
export const SUPPLIER_STATUS_LABELS_PLURAL: Record<string, string> = {
  pre_registered:   "Pre-registrati",
  pending_review:   "In revisione",
  enabled:          "Abilitati",
  in_accreditation: "In accreditamento",
  in_approval:      "In approvazione",
  accredited:       "Accreditati",
  suspended:        "Sospesi",
  rejected:         "Rifiutati",
  revoked:          "Revocati",
  blacklisted:      "Blacklist",
};

/** Get label for a status (singular), with fallback */
export function getSupplierStatusLabel(status: string): string {
  return SUPPLIER_STATUS_CONFIG[status]?.label ?? status;
}

/** Get badge variant for a status */
export function getSupplierStatusVariant(status: string) {
  return SUPPLIER_STATUS_CONFIG[status]?.variant ?? "outline" as const;
}
