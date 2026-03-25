

# Aggiornamento Permessi Piattaforma

## Analisi

Confrontando i grant attualmente nel database con le funzionalità effettivamente presenti sulla piattaforma, ho identificato che tutti i grant esistenti sono utilizzati correttamente. Tuttavia, alcune funzionalità recenti non hanno un grant dedicato o sono coperte da grant generici non specifici.

**Grant attuali (20):**
- `admin`: export_data, manage_document_types, manage_roles, manage_users, view_audit_logs
- `contracts`: approve_billing_approval, create_billing_approval, manage_orders, view_orders
- `procurement`: approve_award, approve_opportunity, create_opportunity, evaluate_bids, invite_suppliers, view_bids, view_budget
- `vendor_register`: approve_accreditation, review_documents, suspend_supplier, view_supplier_documents

## Grant da aggiungere

| Grant | Modulo | Descrizione | Motivazione |
|-------|--------|-------------|-------------|
| `manage_categories` | admin | Gestisci categorie merceologiche | Attualmente usa `manage_document_types` che e improprio |
| `review_change_requests` | vendor_register | Approva/rifiuta richieste modifica anagrafica | Attualmente usa `manage_users`, troppo generico |
| `manage_opportunity_attachments` | procurement | Gestisci allegati opportunita | Upload specifiche tecniche, condizioni, requisiti |
| `view_opportunities` | procurement | Visualizza lista opportunita | Permesso base per accedere alla sezione |
| `view_vendors` | vendor_register | Visualizza albo fornitori | Permesso base per accedere alla sezione |

## Modifiche

### 1. Migrazione database
Inserire i 5 nuovi grant nella tabella `grants` e assegnarli automaticamente ai ruoli di sistema che gia hanno grant correlati (es. chi ha `manage_document_types` riceve anche `manage_categories`).

### 2. Aggiornamento codice

**File da modificare:**

- **`src/pages/internal/ConfigCategories.tsx`**: sostituire `manage_document_types` con `manage_categories`
- **`src/layouts/InternalLayout.tsx`**: aggiungere `manage_categories` alla logica `showConfig`, usare `view_opportunities` e `view_vendors` per visibilita menu
- **`src/pages/internal/VendorDetail.tsx`**: sostituire `hasGrant("manage_users")` con `hasGrant("review_change_requests")` per le azioni sulle richieste di modifica
- **`src/pages/internal/Vendors.tsx`**: aggiungere guard con `view_vendors`
- **`src/pages/internal/Opportunities.tsx`**: aggiungere guard con `view_opportunities`
- **`src/pages/internal/OpportunityDetail.tsx`**: usare `manage_opportunity_attachments` per il tab allegati

### 3. Aggiornamento RLS (se necessario)
Valutare se aggiungere policy RLS basate sui nuovi grant per le tabelle `categories` e `supplier_change_requests`.

## Note tecniche
- I grant vengono letti dalla view `user_effective_grants` che unisce role_grants e user_grants, quindi basta inserire i record e assegnarli ai ruoli
- La pagina AdminRoles mostrera automaticamente i nuovi grant raggruppati per modulo grazie al rendering dinamico gia esistente
- Non servono modifiche a `grantService.ts` o `AdminRoles.tsx`

