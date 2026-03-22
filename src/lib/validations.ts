import { z } from "zod";

/**
 * Algoritmo di controllo Partita IVA italiana (Luhn variante MEF).
 * Ritorna true se il formato è valido.
 */
function isValidItalianVAT(vat: string): boolean {
  if (!/^\d{11}$/.test(vat)) return false;
  const digits = vat.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Validazione Codice Fiscale italiano (16 caratteri alfanumerici, pattern strutturale).
 */
function isValidItalianFC(fc: string): boolean {
  // Accetta sia il formato persona fisica (16 alfanumerici) sia P.IVA (11 cifre) per le aziende
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(fc) || /^\d{11}$/.test(fc);
}

const phoneRegex = /^(\+39\s?)?(\d{2,4}[\s.-]?\d{4,8})$/;

const passwordSchema = z
  .string()
  .min(12, "La password deve avere almeno 12 caratteri")
  .regex(/[A-Z]/, "Deve contenere almeno una lettera maiuscola")
  .regex(/[a-z]/, "Deve contenere almeno una lettera minuscola")
  .regex(/\d/, "Deve contenere almeno un numero")
  .regex(/[^A-Za-z0-9]/, "Deve contenere almeno un carattere speciale");

export const registrationSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "Ragione sociale obbligatoria (min. 2 caratteri)")
    .max(200, "Massimo 200 caratteri"),
  vat_number: z
    .string()
    .trim()
    .length(11, "La Partita IVA deve essere di 11 cifre")
    .regex(/^\d{11}$/, "La Partita IVA deve contenere solo cifre"),
  fiscal_code: z
    .string()
    .trim()
    .max(16)
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || val === "" || isValidItalianFC(val),
      "Codice Fiscale non valido (formato: 16 caratteri alfanumerici o 11 cifre)"
    ),
  contact_name: z
    .string()
    .trim()
    .min(2, "Nome referente obbligatorio (min. 2 caratteri)")
    .max(100, "Massimo 100 caratteri")
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Il nome può contenere solo lettere, spazi, apostrofi e trattini"),
  email: z
    .string()
    .trim()
    .email("Formato email non valido")
    .max(255, "Massimo 255 caratteri"),
  phone: z
    .string()
    .trim()
    .max(20, "Massimo 20 caratteri")
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || val === "" || phoneRegex.test(val),
      "Formato telefono non valido (es. +39 02 12345678)"
    ),
  password: passwordSchema,
  category_id: z.string().uuid().optional().or(z.literal("")),
  privacy: z.literal(true, {
    errorMap: () => ({ message: "Devi accettare l'informativa privacy" }),
  }),
});

export type RegistrationForm = z.infer<typeof registrationSchema>;
