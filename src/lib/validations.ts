import { z } from "zod";

export const registrationSchema = z.object({
  company_name: z.string().trim().min(2, "Ragione sociale obbligatoria").max(200),
  vat_number: z.string().trim().length(11, "La Partita IVA deve essere di 11 caratteri").regex(/^\d{11}$/, "Solo cifre"),
  fiscal_code: z.string().trim().max(16).optional().or(z.literal("")),
  contact_name: z.string().trim().min(2, "Nome referente obbligatorio").max(100),
  email: z.string().trim().email("Email non valida").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(12, "La password deve avere almeno 12 caratteri"),
  category_id: z.string().uuid().optional().or(z.literal("")),
  privacy: z.literal(true, { errorMap: () => ({ message: "Devi accettare l'informativa privacy" }) }),
});

export type RegistrationForm = z.infer<typeof registrationSchema>;
