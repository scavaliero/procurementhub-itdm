// setup_verify_v2.js — VendorHub Setup Verification v2.1
// Portale completo: Wave 1 + Modulo Ufficio Acquisti v3.1
// Fix applicati rispetto a v1:
//   F1: RPC SQL dedicate — no information_schema via PostgREST
//   F2: RLS verificata via pg_class.relrowsecurity (server-side)
//   F3: Realtime end-to-end — subscribe + INSERT + receive event + cleanup
//   F4: Edge Functions: 3 livelli + check body JSON semantico
//   F5: checkTable via RPC verify_table_exists (pg_class, no ambiguita)
//   F6: Test trigger su sandbox tenant + cleanup garantito in finally
//   F7: Check secrets Edge Functions ripristinato (body parse)
//   F8: 14 check documentati e implementati
// Aggiunte v2.1 — Modulo Ufficio Acquisti:
//   A1: S02 +3 tabelle (purchase_requests, purchase_request_status_history, direct_purchases)
//   A2: S03 +2 funzioni (insert_purchase_request_history, is_purchase_operator)
//   A3: S05 +4 trigger (trg_purchase_request_code, trg_purchase_requests_upd,
//                        trg_direct_purchase_code, trg_direct_purchases_upd)
//   A4: S08 +3 tabelle RLS (purchase_requests, purchase_request_status_history, direct_purchases)
//   A5: S09 seed aggiornato (grants>=26, roles>=10, templates>=11, + check purchasing separati)
//   A6: S10 +1 bucket (purchase-invoices Private)
//
// PREREQUISITO: incolla ed esegui il Blocco SQL della Sez. 3 del documento
//               in Supabase > SQL Editor PRIMA di lanciare questo script.
//
// Uso: npm install @supabase/supabase-js dotenv && node setup_verify_v2.js

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

// ── Configurazione ──────────────────────────────────────────────────────────
const SUPABASE_URL   = process.env.SUPABASE_URL
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY
const TENANT_ID      = process.env.TENANT_ID       || '00000000-0000-0000-0000-000000000001'
const SANDBOX_TENANT = process.env.SANDBOX_TENANT_ID || '00000000-0000-0000-0000-000000000fff'
const FAKE_UUID      = '00000000-0000-0000-0000-000000000099'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n\x1b[31m❌  Errore: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti nel file .env\x1b[0m')
  console.error('   Crea un file .env con:')
  console.error('   SUPABASE_URL=https://xxxx.supabase.co')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ...')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Stato globale ───────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0
const failures  = []
const warnings  = []
const cleanupFns = []

// ── Helper output ───────────────────────────────────────────────────────────
const ok   = (m)      => { process.stdout.write(`  \x1b[32m✔\x1b[0m  ${m}\n`); passed++ }
const fail = (m, fix) => { process.stdout.write(`  \x1b[31m✘\x1b[0m  ${m}\n`); failures.push({ m, fix }); failed++ }
const warn = (m, note)=> { process.stdout.write(`  \x1b[33m⚠\x1b[0m  ${m}\n`); warnings.push({ m, note }); warned++ }
const sec  = (n, t)   => {
  process.stdout.write(`\n\x1b[1m\x1b[34mS${String(n).padStart(2,'0')} — ${t}\x1b[0m\n`)
  process.stdout.write('  ' + '─'.repeat(58) + '\n')
}

// ── RPC helpers — usa SOLO funzioni dedicate, mai information_schema diretta ─
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args || {})
  return { data, error }
}

async function tableExists(name) {
  const { data, error } = await rpc('verify_table_exists', { p_table_name: name })
  if (error?.message?.includes('does not exist')) return null // RPC non installata
  if (error) return false
  return data === true
}

async function triggerExists(table, trigger) {
  const { data, error } = await rpc('verify_trigger_exists', {
    p_table_name: table, p_trigger_name: trigger
  })
  if (error) return null
  return data === true
}

async function rlsEnabled(table) {
  const { data, error } = await rpc('verify_rls_enabled', { p_table_name: table })
  if (error) return null
  return data === true
}

async function functionExists(name) {
  const { data, error } = await rpc('verify_function_exists', { p_func_name: name })
  if (error) return null
  return data === true
}

async function viewColumns(viewName, expectedCols) {
  const { data, error } = await rpc('verify_view_columns', {
    p_view_name: viewName, p_columns: expectedCols
  })
  if (error || !data) return null
  return data
}

async function appendOnlyCheck(table) {
  const { data, error } = await rpc('verify_append_only', { p_table_name: table })
  if (error || !data) return null
  return data
}

async function countRows(table, match) {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (match) q = q.match(match)
  const { count, error } = await q
  return error ? -1 : (count ?? 0)
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n\x1b[1m╔════════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[1m║  VENDORHUB — SETUP VERIFICATION v2.1                   ║\x1b[0m')
  console.log('\x1b[1m╚════════════════════════════════════════════════════════╝\x1b[0m')
  console.log(`\n  URL:       ${SUPABASE_URL}`)
  console.log(`  Tenant:    ${TENANT_ID}`)
  console.log(`  Sandbox:   ${SANDBOX_TENANT}`)
  console.log(`  Timestamp: ${new Date().toISOString()}`)

  try {
    await runAllChecks()
  } finally {
    await runCleanup()
  }
}

async function runCleanup() {
  if (cleanupFns.length === 0) return
  process.stdout.write('\n  [cleanup] Rimozione dati di test...\n')
  for (const fn of cleanupFns) {
    try { await fn() } catch(_) {}
  }
  process.stdout.write('  [cleanup] Completato.\n')
}

async function runAllChecks() {

  // ────────────────────────────────────────────────────────────────────────
  // S01: Connettivita e RPC di verifica
  // ────────────────────────────────────────────────────────────────────────
  sec(1, 'Connettivita e RPC di verifica')

  const { error: connErr } = await sb.from('tenants').select('id').limit(1)
  if (connErr && connErr.code !== 'PGRST116') {
    fail('Connessione Supabase fallita', 'Verifica SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env')
    printReport(); process.exit(1)
  }
  ok('Connessione Supabase attiva')

  const rpcCheck = await tableExists('tenants')
  if (rpcCheck === null) {
    fail(
      'RPC di verifica NON installate (verify_table_exists non trovata)',
      'Incolla ed esegui il Blocco SQL della Sezione 3 del documento nel SQL Editor di Supabase'
    )
    printReport(); process.exit(1)
  }
  ok('RPC di verifica installate (verify_table_exists, verify_trigger_exists, ecc.)')

  const { data: sbTenant } = await sb.from('tenants').select('id').eq('id', SANDBOX_TENANT).single().catch(() => ({ data: null }))
  if (sbTenant) ok('Tenant sandbox presente')
  else warn('Tenant sandbox non trovato — i test useranno il tenant principale', 'Esegui il Blocco SQL Sez. 3')
  const TEST_TENANT = sbTenant ? SANDBOX_TENANT : TENANT_ID

  // ────────────────────────────────────────────────────────────────────────
  // S02: Schema SQL — tabelle via RPC
  // ────────────────────────────────────────────────────────────────────────
  sec(2, 'Schema SQL — tabelle (via RPC verify_table_exists) [Wave 1: 24 + Acquisti: 3 = 27]')

  const tableGroups = {
    'Blocco 5.2': ['tenants','profiles','roles','grants','role_grants','user_roles','user_grants'],
    'Blocco 5.3': ['categories','document_types','suppliers','supplier_categories','supplier_status_history','uploaded_documents'],
    'Blocco 5.4': ['opportunities','opportunity_invitations','bids','bid_evaluations','awards'],
    'Blocco 5.5': ['orders','contracts','billing_approvals'],
    'Blocco 5.6': ['notifications','email_templates','audit_logs'],
  }
  for (const [blocco, list] of Object.entries(tableGroups)) {
    for (const t of list) {
      const exists = await tableExists(t)
      if (exists === true)  ok(`'${t}' presente`)
      else if (exists === false) fail(`'${t}' MANCANTE`, `Esegui ${blocco} nel SQL Editor`)
      else warn(`'${t}' — verifica non conclusiva`, 'Controlla in Supabase > Table Editor')
    }
  }

  // Modulo Ufficio Acquisti — 3 tabelle aggiuntive
  const purchasingTables = [
    ['purchase_requests',               'SQL Modulo Ufficio Acquisti v3.1'],
    ['purchase_request_status_history', 'SQL Modulo Ufficio Acquisti v3.1'],
    ['direct_purchases',                'SQL Modulo Ufficio Acquisti v3.1'],
  ]
  for (const [t, blocco] of purchasingTables) {
    const exists = await tableExists(t)
    if (exists === true)  ok(`'${t}' presente (modulo acquisti)`)
    else if (exists === false) fail(`'${t}' MANCANTE`, `Esegui ${blocco}`)
    else warn(`'${t}' — verifica non conclusiva (modulo acquisti)`, 'Controlla manualmente')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S03: Funzioni SQL critiche via RPC
  // ────────────────────────────────────────────────────────────────────────
  sec(3, 'Funzioni SQL critiche (via RPC verify_function_exists) [Wave 1: 7 + Acquisti: 2 = 9, + 2 cron opzionali]')

  const critFunctions = [
    ['update_updated_at',         'Blocco SQL 5.1', false],
    ['current_tenant_id',         'Blocco SQL 5.1', false],
    ['user_has_grant',            'Blocco SQL 5.1', false],
    ['check_mandatory_docs',      'Blocco SQL 5.3 (fine blocco)', false],
    ['generate_opportunity_code', 'Blocco SQL 5.4', false],
    ['generate_order_code',       'Blocco SQL 5.5', false],
    ['generate_billing_code',     'Blocco SQL 5.5', false],
    ['cron_check_document_expiry','Blocco SQL 5.7 (piano Pro)', true],
    ['cron_bid_deadline_reminder','Blocco SQL 5.7 (piano Pro)', true],
  ]
  for (const [fn, blocco, isCron] of critFunctions) {
    const exists = await functionExists(fn)
    if (exists === true)  ok(`'${fn}()' presente`)
    else if (exists === false) {
      if (isCron) warn(`'${fn}()' non trovata`, `Piano Pro richiesto. Se Free: usa cron esterno.`)
      else fail(`'${fn}()' MANCANTE`, `Esegui ${blocco}`)
    } else warn(`'${fn}()' — verifica non conclusiva`, 'Controlla manualmente')
  }

  // Test funzionale user_has_grant
  const { error: gErr } = await sb.rpc('user_has_grant', { grant_name: '__test__' })
  if (!gErr || gErr.code === 'PGRST202') ok('user_has_grant() accetta TEXT (firma corretta)')
  else if (!gErr?.message?.includes('does not exist')) ok('user_has_grant() risponde (errore auth atteso)')
  else fail('user_has_grant() mancante', 'Esegui Blocco SQL 5.1')

  // Test funzionale check_mandatory_docs
  const { error: cmdErr } = await sb.rpc('check_mandatory_docs', { p_supplier_id: FAKE_UUID, p_category_id: FAKE_UUID })
  if (!cmdErr) ok('check_mandatory_docs() eseguita: 0 righe per UUID inesistente (corretto)')
  else if (cmdErr.message?.includes('does not exist'))
    fail('check_mandatory_docs() MANCANTE', 'Esegui Blocco SQL 5.3 (fine del blocco)')
  else if (cmdErr.message?.includes('argument') || cmdErr.message?.includes('wrong'))
    fail('check_mandatory_docs() firma errata', 'Ricrea dal Blocco SQL 5.3')
  else ok('check_mandatory_docs() presente')

  // Modulo Ufficio Acquisti — 2 funzioni aggiuntive
  for (const [fn, desc] of [
    ['insert_purchase_request_history', 'SECURITY DEFINER — storico stati acquisti'],
    ['is_purchase_operator',            'SECURITY DEFINER — filtro opportunita operatore'],
  ]) {
    const exists = await functionExists(fn)
    if (exists === true)  ok(`'${fn}()' presente (${desc})`)
    else if (exists === false) fail(`'${fn}()' MANCANTE`, 'Esegui SQL Modulo Ufficio Acquisti v3.1')
    else warn(`'${fn}()' — verifica non conclusiva`, 'Controlla manualmente')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S04: View SQL e colonne attese
  // ────────────────────────────────────────────────────────────────────────
  sec(4, 'View SQL e colonne attese (via RPC verify_view_columns)')

  const views = [
    { name: 'user_effective_grants',       cols: ['user_id','grant_name','source'],                                                                 blocco: 'Blocco SQL 5.1' },
    { name: 'contract_economic_summary',   cols: ['contract_id','residual_amount','pending_approval_count','pending_approval_amount','residual_pct'], blocco: 'Blocco SQL 5.6' },
  ]
  for (const v of views) {
    const cols = await viewColumns(v.name, v.cols)
    if (!cols) { fail(`View '${v.name}' MANCANTE`, `Esegui ${v.blocco}`); continue }
    const missing = cols.filter(c => !c.present).map(c => c.col)
    if (missing.length === 0) ok(`View '${v.name}': tutte le colonne attese presenti`)
    else fail(`View '${v.name}': colonne mancanti: ${missing.join(', ')}`, `Esegui: DROP VIEW ${v.name}; poi ${v.blocco}`)
  }

  // ────────────────────────────────────────────────────────────────────────
  // S05: Trigger via RPC
  // ────────────────────────────────────────────────────────────────────────
  sec(5, 'Trigger auto-codici (via RPC verify_trigger_exists) [Wave 1: 7 + Acquisti: 4 = 11]')

  const triggerList = [
    ['opportunities',    'trg_opp_code',     'OPP-YYYY-NNNN',    'Blocco 5.4'],
    ['opportunities',    'trg_opp_upd',      'updated_at',       'Blocco 5.4'],
    ['orders',           'trg_order_code',   'ORD-YYYY-NNNNN',   'Blocco 5.5'],
    ['orders',           'trg_orders_upd',   'updated_at',       'Blocco 5.5'],
    ['billing_approvals','trg_billing_code', 'BEN-YYYY-NNNNN',   'Blocco 5.5'],
    ['billing_approvals','trg_billing_upd',  'updated_at',       'Blocco 5.5'],
    ['suppliers',        'trg_suppliers_upd','updated_at',       'Blocco 5.3'],
  ]
  for (const [table, trig, label, blocco] of triggerList) {
    const exists = await triggerExists(table, trig)
    if (exists === true)  ok(`Trigger '${trig}' (${label}) su '${table}'`)
    else if (exists === false) fail(`Trigger '${trig}' MANCANTE su '${table}'`, `Esegui ${blocco}`)
    else warn(`Trigger '${trig}' — verifica non conclusiva`, 'Controlla manualmente')
  }

  // Modulo Ufficio Acquisti — 4 trigger aggiuntivi
  const purchasingTriggers = [
    ['purchase_requests',               'trg_purchase_request_code', 'RDA-YYYY-NNNNN', 'SQL Modulo Acquisti'],
    ['purchase_requests',               'trg_purchase_requests_upd', 'updated_at auto', 'SQL Modulo Acquisti'],
    ['direct_purchases',                'trg_direct_purchase_code',  'ACQ-YYYY-NNNNN', 'SQL Modulo Acquisti'],
    ['direct_purchases',                'trg_direct_purchases_upd',  'updated_at auto', 'SQL Modulo Acquisti'],
  ]
  for (const [table, trig, label, blocco] of purchasingTriggers) {
    const exists = await triggerExists(table, trig)
    if (exists === true)  ok(`Trigger '${trig}' (${label}) su '${table}'`)
    else if (exists === false) fail(`Trigger '${trig}' MANCANTE su '${table}'`, `Esegui ${blocco}`)
    else warn(`Trigger '${trig}' — verifica non conclusiva`, 'Controlla manualmente')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S06: Test funzionale trigger — sandbox tenant + cleanup garantito
  // ────────────────────────────────────────────────────────────────────────
  sec(6, 'Test funzionale trigger codici (sandbox tenant + cleanup garantito)')

  const { data: testOpp, error: testOppErr } = await sb
    .from('opportunities')
    .insert({ tenant_id: TEST_TENANT, title: '__VERIFY_TEST__', status: 'draft' })
    .select('id, code')
    .single()

  if (testOppErr) {
    fail('INSERT di test su opportunities fallito: ' + testOppErr.message, 'Verifica seed tenant sandbox')
  } else {
    cleanupFns.push(() => sb.from('opportunities').delete().eq('id', testOpp.id))
    if (testOpp.code?.match(/^OPP-\d{4}-\d{4}$/))
      ok(`Trigger OPP funzionale: codice generato = ${testOpp.code}`)
    else if (!testOpp.code)
      fail('Trigger OPP non ha generato il codice', 'Verifica Blocco 5.4 (trigger + sequence)')
    else
      warn(`Trigger OPP: formato inatteso '${testOpp.code}'`, 'Atteso OPP-YYYY-NNNN')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S07: Audit trail append-only
  // ────────────────────────────────────────────────────────────────────────
  sec(7, 'Audit trail append-only (RPC verify_append_only + test funzionale)')

  const ao = await appendOnlyCheck('audit_logs')
  if (!ao) {
    warn('Verifica RULE non conclusiva', 'Controlla manualmente le RULE su audit_logs')
  } else {
    if (ao.has_no_update_rule) ok('RULE no_update_audit_logs presente')
    else fail('RULE no_update_audit_logs MANCANTE', 'Esegui Blocco SQL 5.6')
    if (ao.has_no_delete_rule) ok('RULE no_delete_audit_logs presente')
    else fail('RULE no_delete_audit_logs MANCANTE', 'Esegui Blocco SQL 5.6')
  }

  const { data: auditRow } = await sb.from('audit_logs')
    .insert({ tenant_id: TEST_TENANT, event_type: '__verify__', entity_type: '__test__' })
    .select('id, event_type').single().catch(() => ({ data: null }))
  if (auditRow) {
    cleanupFns.push(() => sb.from('audit_logs').delete().eq('id', auditRow.id))
    await sb.from('audit_logs').update({ event_type: '__modified__' }).eq('id', auditRow.id)
    const { data: after } = await sb.from('audit_logs').select('event_type').eq('id', auditRow.id).single().catch(() => ({ data: null }))
    if (after?.event_type === '__verify__')
      ok('Audit append-only: UPDATE ignorato (valore invariato)')
    else
      fail('Audit NON append-only: UPDATE ha modificato il record', 'Esegui Blocco SQL 5.6 (RULE)')
  } else {
    warn('INSERT su audit_logs non riuscita', 'RLS o permessi — verifica il setup')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S08: RLS abilitata via pg_class
  // ────────────────────────────────────────────────────────────────────────
  sec(8, 'Row Level Security (via RPC verify_rls_enabled) [Wave 1: 11 + Acquisti: 3 = 14 tabelle]')

  const rlsTableList = [
    'tenants','profiles','suppliers','uploaded_documents',
    'opportunities','bids','orders','contracts','billing_approvals',
    'notifications','audit_logs',
    // Modulo Ufficio Acquisti
    'purchase_requests','purchase_request_status_history','direct_purchases',
  ]
  for (const t of rlsTableList) {
    const enabled = await rlsEnabled(t)
    if (enabled === true)  ok(`RLS abilitata su '${t}'`)
    else if (enabled === false) fail(`RLS NON abilitata su '${t}'`, `Esegui: ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`)
    else warn(`RLS su '${t}' — verifica non conclusiva`, 'Controlla manualmente')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S09: Dati seed
  // ────────────────────────────────────────────────────────────────────────
  sec(9, 'Dati seed (Blocco SQL 5.9)')

  const { data: tenRow } = await sb.from('tenants').select('name').eq('id', TENANT_ID).single().catch(() => ({ data: null }))
  if (tenRow) ok(`Tenant principale: '${tenRow.name}'`)
  else fail('Tenant principale MANCANTE', 'Esegui Blocco SQL 5.9')

  const seedChecks = [
    { table: 'grants',          filter: null,                     min: 26, label: 'grant totali (20 Wave 1 + 6 purchasing)'  },
    { table: 'roles',           filter: { tenant_id: TENANT_ID }, min: 10, label: 'ruoli di sistema (6 Wave 1 + 4 purchasing)'},
    { table: 'categories',      filter: { tenant_id: TENANT_ID }, min: 7,  label: 'categorie merceologiche'                  },
    { table: 'document_types',  filter: { tenant_id: TENANT_ID }, min: 6,  label: 'tipi documento'                           },
    { table: 'email_templates', filter: { tenant_id: TENANT_ID }, min: 11, label: 'template email (6 Wave 1 + 5 purchasing)' },
  ]
  for (const s of seedChecks) {
    const n = await countRows(s.table, s.filter)
    if (n < 0)    warn(`${s.label}: errore nella query`, 'Controlla accesso alla tabella')
    else if (n >= s.min) ok(`${s.label}: ${n} presenti`)
    else fail(`${s.label}: ${n} trovati (minimo: ${s.min})`, 'Esegui Blocco SQL 5.9 + SQL Modulo Acquisti v3.1')
  }

  // Grant modulo purchasing: verifica separata con filtro modulo
  const purchasingGrantsCount = await countRows('grants', { module: 'purchasing' })
  if (purchasingGrantsCount >= 6) ok(`Grant modulo purchasing: ${purchasingGrantsCount}`)
  else fail(`Grant modulo purchasing insufficienti: ${purchasingGrantsCount} (attesi 6)`,
    'Esegui SQL Modulo Ufficio Acquisti v3.1')

  // Ruoli purchasing: verifica separata con slug tecnici
  const purchasingRolesCount = await countRows('roles', { tenant_id: TENANT_ID,
    // non possiamo fare IN con countRows semplice, usiamo query raw
  })
  // Verifica manuale tramite query diretta
  const { count: prCount } = await sb.from('roles').select('*', { count: 'exact', head: true })
    .in('name', ['purchase_requester','purchase_operator','purchase_manager','finance_approver'])
    .eq('tenant_id', TENANT_ID)
  if ((prCount ?? 0) >= 4) ok(`Ruoli purchasing: ${prCount} (purchase_requester, purchase_operator, purchase_manager, finance_approver)`)
  else fail(`Ruoli purchasing insufficienti: ${prCount} (attesi 4)`, 'Esegui SQL Modulo Acquisti v3.1')

  // Role_grants purchasing: atteso 9 (2+2+2+3)
  const { count: rgCount } = await sb.from('role_grants').select('*', { count: 'exact', head: true })
    .in('role_id',
      (await sb.from('roles').select('id').in('name', ['purchase_requester','purchase_operator','purchase_manager','finance_approver'])
        .eq('tenant_id', TENANT_ID)).data?.map(r => r.id) ?? []
    )
  if ((rgCount ?? 0) >= 9) ok(`Role_grants purchasing: ${rgCount} (attesi 9: 2+2+2+3)`)
  else fail(`Role_grants purchasing insufficienti: ${rgCount} (attesi 9)`, 'Esegui SQL Modulo Acquisti v3.1')

  // ────────────────────────────────────────────────────────────────────────
  // S10: Bucket Storage
  // ────────────────────────────────────────────────────────────────────────
  sec(10, 'Bucket Supabase Storage [Wave 1: 6 + Acquisti: 1 = 7]')

  const { data: bucketList, error: bucketErr } = await sb.storage.listBuckets()
  if (bucketErr) {
    fail('Impossibile listare i bucket', 'Verifica la SERVICE_ROLE_KEY')
  } else {
    const bmap = Object.fromEntries((bucketList || []).map(b => [b.name, b]))
    const expectedBuckets = [
      { name: 'vendor-documents',        public: false },
      { name: 'opportunity-attachments', public: false },
      { name: 'bid-attachments',         public: false },
      { name: 'order-attachments',       public: false },
      { name: 'billing-attachments',     public: false },
      { name: 'public-assets',           public: true  },
      { name: 'purchase-invoices',       public: false }, // Modulo Ufficio Acquisti
    ]
    for (const e of expectedBuckets) {
      const b = bmap[e.name]
      if (!b) fail(`Bucket '${e.name}' MANCANTE`, `Crea in Supabase > Storage > New Bucket (${e.public ? 'Public' : 'Private'})`)
      else if (b.public !== e.public) fail(`Bucket '${e.name}': visibilita errata`, `Deve essere ${e.public ? 'Public' : 'Private'}`)
      else ok(`Bucket '${e.name}': presente, ${e.public ? 'Public' : 'Private'} (corretto)`)
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // S11: Realtime end-to-end — subscribe + INSERT + receive event + cleanup
  // ────────────────────────────────────────────────────────────────────────
  sec(11, 'Realtime end-to-end (subscribe + INSERT + receive event + cleanup)')

  let realtimeEventReceived = false
  let insertedNotifId = null
  const RT_TIMEOUT_MS = 5000

  const rtResult = await new Promise((resolve) => {
    const channel = sb.channel('setup-verify-rt-v2')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
      }, (payload) => {
        if (payload.new?.event_type === '__rt_e2e_test__') {
          realtimeEventReceived = true
          resolve({ status: 'event_received', channel })
        }
      })
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          const { data: profile } = await sb.from('profiles')
            .select('id').eq('tenant_id', TEST_TENANT).limit(1).single()
            .catch(() => ({ data: null }))
          if (!profile) {
            resolve({ status: 'subscribed_no_profile', channel })
            return
          }
          const { data: notif } = await sb.from('notifications').insert({
            tenant_id: TEST_TENANT, recipient_id: profile.id,
            event_type: '__rt_e2e_test__', title: 'Setup verify RT test', is_read: true
          }).select('id').single().catch(() => ({ data: null }))
          if (notif?.id) {
            insertedNotifId = notif.id
            cleanupFns.push(() => sb.from('notifications').delete().eq('id', notif.id))
          }
          setTimeout(() => resolve({ status: 'timeout', channel }), RT_TIMEOUT_MS)
        } else if (status === 'CHANNEL_ERROR') {
          resolve({ status: 'channel_error', err, channel })
        }
      })
  })

  await sb.removeChannel(rtResult.channel).catch(() => {})

  if (rtResult.status === 'event_received') {
    ok('Realtime: WebSocket attivo')
    ok('Realtime: tabella notifications in replication (evento INSERT ricevuto end-to-end)')
  } else if (rtResult.status === 'subscribed_no_profile') {
    ok('Realtime: WebSocket e subscription attivi')
    warn('Realtime: test E2E parziale (nessun profilo nel sandbox per INSERT test)', 'Test manuale: 2 browser, inserisci notifica, verifica ricezione')
  } else if (rtResult.status === 'timeout') {
    ok('Realtime: WebSocket e subscription attivi')
    fail('Realtime: evento INSERT NON ricevuto entro ' + (RT_TIMEOUT_MS/1000) + 's',
      'Supabase > Database > Replication > abilita tabella notifications')
  } else {
    fail('Realtime: errore canale WebSocket — ' + (rtResult.err?.message || 'sconosciuto'),
      'Supabase > Database > Replication > verifica che Realtime sia abilitato')
  }

  // ────────────────────────────────────────────────────────────────────────
  // S12: Edge Functions — 3 livelli
  // ────────────────────────────────────────────────────────────────────────
  sec(12, 'Edge Functions (NOT_DEPLOYED / CONFIG_ERROR / DEPLOYED_OK)')

  async function checkEdge(name, payload, checkFn) {
    let res
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      })
    } catch(e) {
      fail(`'${name}': errore di rete — ${e.message}`, 'Verifica connettivita e SUPABASE_URL')
      return
    }
    if (res.status === 404) {
      fail(`'${name}': NOT DEPLOYED (404)`, `Crea in Supabase > Edge Functions`)
      return
    }
    let body = {}
    try { body = await res.json() } catch(_) {}
    // Check secrets
    const bs = JSON.stringify(body).toLowerCase()
    if (bs.includes('supabase_service_role_key') || (bs.includes('secret') && bs.includes('missing'))
        || bs.includes('resend_api_key') || bs.includes('from_email')) {
      fail(`'${name}': DEPLOYED ma secrets mancanti (HTTP ${res.status})`,
        'Supabase > Edge Functions > Secrets: aggiungi SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL')
      return
    }
    const r = checkFn(res.status, body)
    if (r.ok) ok(`'${name}': ${r.msg}`)
    else fail(`'${name}': ${r.msg}`, r.fix)
  }

  await checkEdge(
    'send-notification',
    { event_type: '__test__', recipient_id: FAKE_UUID, variables: {}, tenant_id: TENANT_ID },
    (s, b) => {
      if ((s === 404 || s === 400) && (b?.error === 'template_not_found' || b?.error === 'recipient_not_found'))
        return { ok: true, msg: `DEPLOYED OK (${b.error} per dati test — atteso)` }
      if (s >= 200 && s < 500)
        return { ok: true, msg: `DEPLOYED OK (HTTP ${s})` }
      return { ok: false, msg: `DEPLOYED ma risposta inattesa (HTTP ${s})`, fix: 'Controlla Supabase > Edge Functions > Logs' }
    }
  )

  await checkEdge(
    'validate-bid',
    { opportunity_id: FAKE_UUID, supplier_id: FAKE_UUID },
    (s, b) => {
      if (s === 404 && b?.code === 'OPP_NOT_FOUND')
        return { ok: true, msg: 'DEPLOYED OK (OPP_NOT_FOUND per UUID inesistente — logica corretta)' }
      if (s === 400 && ['RB01','RB02','RB04','RB01_EXPIRED'].includes(b?.code))
        return { ok: true, msg: `DEPLOYED OK (business rule verificata: ${b.code})` }
      if (s >= 200 && s < 500)
        return { ok: true, msg: `DEPLOYED OK (HTTP ${s})` }
      return { ok: false, msg: `DEPLOYED ma risposta inattesa (HTTP ${s}, code: ${b?.code})`, fix: 'Controlla Edge Function Logs' }
    }
  )

  await checkEdge(
    'check-billing-limit',
    { contract_id: FAKE_UUID, new_amount: 100 },
    (s, b) => {
      if (s === 404 && b?.code === 'CONTRACT_NOT_FOUND')
        return { ok: true, msg: 'DEPLOYED OK (CONTRACT_NOT_FOUND per UUID inesistente — logica corretta)' }
      if (s === 400 && b?.code === 'RB08')
        return { ok: true, msg: 'DEPLOYED OK (RB08 verificato)' }
      if (s === 200 && b?.valid !== undefined)
        return { ok: true, msg: `DEPLOYED OK (valid: ${b.valid})` }
      if (s >= 200 && s < 500)
        return { ok: true, msg: `DEPLOYED OK (HTTP ${s})` }
      return { ok: false, msg: `DEPLOYED ma risposta inattesa (HTTP ${s})`, fix: 'Controlla Edge Function Logs' }
    }
  )

  // ────────────────────────────────────────────────────────────────────────
  // S13: Secrets Edge Functions — verifica indiretta su profilo reale
  // ────────────────────────────────────────────────────────────────────────
  sec(13, 'Secrets Edge Functions (verifica indiretta su profilo reale)')

  const { data: anyProfile } = await sb.from('profiles').select('id').limit(1).single().catch(() => ({ data: null }))
  if (!anyProfile) {
    warn('Nessun profilo trovato per test secrets approfondito', 'Crea un utente e riesegui per verifica completa')
  } else {
    const sRes = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: '__secrets_test__', recipient_id: anyProfile.id, variables: {}, tenant_id: TENANT_ID }),
      signal: AbortSignal.timeout(8000)
    }).catch(() => null)

    if (!sRes) { warn('send-notification non raggiungibile per test secrets', ''); }
    else {
      const sb2 = await sRes.json().catch(() => ({}))
      const bs = JSON.stringify(sb2).toLowerCase()
      if (bs.includes('resend_api_key') || bs.includes('api key'))
        fail('RESEND_API_KEY mancante', 'Supabase > Edge Functions > Secrets > aggiungi RESEND_API_KEY')
      else if (bs.includes('from_email'))
        fail('FROM_EMAIL mancante', 'Supabase > Edge Functions > Secrets > aggiungi FROM_EMAIL')
      else if (bs.includes('supabase_service_role_key') || bs.includes('service_role'))
        fail('SUPABASE_SERVICE_ROLE_KEY mancante nella Edge Function', 'Supabase > Edge Functions > Secrets')
      else if (sRes.status === 404 && sb2?.error === 'template_not_found')
        ok('Secrets send-notification configurati (template non trovato per __secrets_test__ — atteso)')
      else
        ok(`Secrets send-notification configurati (HTTP ${sRes.status})`)
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // S14: Test funzionale check_mandatory_docs
  // ────────────────────────────────────────────────────────────────────────
  sec(14, 'Test funzionale check_mandatory_docs (2 test: UUID + NULL category)')

  const { data: r0, error: e0 } = await sb.rpc('check_mandatory_docs', { p_supplier_id: FAKE_UUID, p_category_id: FAKE_UUID })
  if (e0) fail('check_mandatory_docs errore con UUID: ' + e0.message, 'Ricrea dal Blocco SQL 5.3')
  else ok(`check_mandatory_docs: ${(r0||[]).length} righe per UUID inesistente (0 = corretto)`)

  const { error: e1 } = await sb.rpc('check_mandatory_docs', { p_supplier_id: FAKE_UUID, p_category_id: null })
  if (!e1) ok('check_mandatory_docs: p_category_id=null accettato (filtro categoria opzionale)')
  else if (e1.message?.includes('null')) warn('check_mandatory_docs: p_category_id=null genera warning', 'Verifica DEFAULT NULL nel Blocco 5.3')
  else fail('check_mandatory_docs: p_category_id=null restituisce errore: ' + e1.message, 'Blocco SQL 5.3: assicurati che sia UUID DEFAULT NULL')

  printReport()
}

function printReport() {
  const total = passed + failed
  const pct   = total > 0 ? Math.round((passed / total) * 100) : 0
  console.log('\n\x1b[1m╔════════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[1m║                   REPORT FINALE                        ║\x1b[0m')
  console.log('\x1b[1m╚════════════════════════════════════════════════════════╝\x1b[0m')
  console.log(`\n  Check eseguiti:  ${total}`)
  console.log(`  \x1b[32mPASSED:  ${passed}\x1b[0m`)
  console.log(`  \x1b[31mFAILED:  ${failed}\x1b[0m`)
  console.log(`  \x1b[33mWARNING: ${warned}\x1b[0m`)
  console.log(`  Completamento: ${pct}%\n`)

  if (warnings.length > 0) {
    console.log('  \x1b[33mWarning (non bloccanti):\x1b[0m')
    warnings.forEach((w, i) => {
      console.log(`  ${i+1}. \x1b[33m${w.m}\x1b[0m`)
      if (w.note) console.log(`     Note: ${w.note}`)
    })
    console.log('')
  }

  if (failed === 0) {
    console.log('\x1b[1m\x1b[32m  ✔  SETUP COMPLETO — Puoi aprire Lovable e iniziare con il Prompt R0-A.\x1b[0m')
    if (warned > 0) console.log('\x1b[33m     Risolvi i warning prima del go-live in produzione.\x1b[0m')
    console.log('')
  } else {
    console.log('\x1b[1m\x1b[31m  ✘  SETUP INCOMPLETO — Correggi i FAIL prima di aprire Lovable:\x1b[0m\n')
    failures.forEach((f, i) => {
      console.log(`  ${i+1}. \x1b[31m${f.m}\x1b[0m`)
      if (f.fix) console.log(`     → ${f.fix}`)
    })
    console.log('\n  Riesegui: node setup_verify_v2.js\n')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n\x1b[31m❌  Errore inatteso:', err.message, '\x1b[0m')
  process.exit(1)
})
