// Migration des DONNEES de l'ancien projet Supabase (tables sans prefixe) vers le nouveau (tables crm_*).
// Aucune dependance : Node 20+, API REST de Supabase.
//
//   node scripts/migrer-donnees.mjs exporter            # ANCIEN_URL + ANCIEN_SERVICE_KEY
//   node scripts/migrer-donnees.mjs sql [dossier]       # hors ligne, genere import-donnees.sql
//   node scripts/migrer-donnees.mjs importer [dossier]  # NOUVEAU_URL + NOUVEAU_SERVICE_KEY (comptes et fichiers)
//
// Ordre complet : voir docs/INSTALLATION_SUPABASE.md, section « Reprise des donnees ».
// Les exports contiennent des donnees personnelles : ils vont dans sauvegardes/ (ignore par git).
// Les cles service_role se passent par variables d'environnement, jamais dans un fichier du depot.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const RACINE = 'sauvegardes';
const PREFIXE = 'crm_';

// Tables chargees par le seed (questionnaire, glossaire, probabilites) : exportees pour memoire, jamais reimportees.
export const TABLES_SEED = ['questionnaires', 'sections', 'questions', 'glossaire', 'probabilites_statut'];
// Tables de donnees utilisateur (noms de l'ancien projet). L'ordre n'a pas d'importance : les controles de cles
// etrangeres sont suspendus pendant le chargement.
export const TABLES_DONNEES = [
  'profils', 'clients', 'contacts', 'demandes', 'demande_acces', 'demande_enjeux', 'entretien_creneaux',
  'evenements', 'commentaires', 'reponses', 'reponses_historique', 'fichiers', 'notes_cadrage',
  'propositions', 'proposition_lignes', 'financements', 'factures', 'activites', 'taches', 'tache_membres',
  'tache_pieces_jointes', 'consentements', 'reclamations', 'satisfactions', 'notifications', 'doublons_ignores',
  'vues_enregistrees', 'audit_log',
];
// Colonnes a ne pas inserer : calculees par la base.
const COLONNES_CALCULEES = { proposition_lignes: ['total'] };
// Tables a colonne « id » auto-incrementee (GENERATED ALWAYS AS IDENTITY).
const TABLES_IDENTITE = ['audit_log', 'evenements', 'reponses_historique'];
const BUCKETS = ['demandes', 'taches'];

const ident = (s) => '"' + s.replace(/"/g, '""') + '"';

// ---------------------------------------------------------------- SQL (pur, teste)

function litteralJson(valeur) {
  const json = JSON.stringify(valeur);
  let tag = 'rd';
  while (json.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${json}$${tag}$::jsonb`;
}

// donnees : { nomAncienneTable: [lignes] }. Retourne le script SQL a executer dans le nouveau projet.
export function genererSql(donnees) {
  const sortie = [
    '-- Reprise des donnees RD Recueil (genere par scripts/migrer-donnees.mjs).',
    '-- A executer APRES crm_install.sql, seed_v1.sql et « importer » (comptes Auth), une seule fois.',
    'begin;',
    '-- Suspend les declencheurs et les cles etrangeres : le journal, l\'historique et les notifications',
    '-- sont repris tels quels, sans doublon.',
    'set local session_replication_role = replica;',
    '',
  ];
  const controles = [];
  for (const table of TABLES_DONNEES) {
    let lignes = donnees[table] ?? [];
    if (table === 'profils') lignes = lignes.map((l) => ({ ...l, doit_changer_mot_de_passe: true }));
    controles.push([PREFIXE + table, lignes.length]);
    if (!lignes.length) continue;
    const exclues = new Set(COLONNES_CALCULEES[table] ?? []);
    const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l)))].filter((c) => !exclues.has(c));
    const cibles = colonnes.map(ident).join(', ');
    const donneesPropres = lignes.map((l) => Object.fromEntries(colonnes.map((c) => [c, l[c] ?? null])));
    const surcharge = TABLES_IDENTITE.includes(table) ? ' overriding system value' : '';
    sortie.push(
      `insert into public.${ident(PREFIXE + table)} (${cibles})${surcharge}`,
      `select ${cibles} from jsonb_populate_recordset(null::public.${ident(PREFIXE + table)}, ${litteralJson(donneesPropres)}) on conflict do nothing;`,
      '',
    );
  }
  sortie.push('commit;', '', '-- Compteurs : les references et les numeros automatiques reprennent apres les valeurs importees.');
  for (const t of TABLES_IDENTITE) {
    const n = PREFIXE + t;
    sortie.push(`select setval(pg_get_serial_sequence('public.${n}', 'id'), (select coalesce(max(id), 0) + 1 from public.${n}), false);`);
  }
  sortie.push(
    `select setval('crm_demande_seq', (select coalesce(max(substring(reference from '(\\d+)$')::int), 0) + 1 from public.crm_demandes), false);`,
    '',
    '-- Controle : « present » doit egaler « attendu » sur chaque ligne.',
    controles
      .map(([n, k]) => `select '${n}' as table_, ${k} as attendu, (select count(*) from public.${n}) as present`)
      .join('\nunion all\n') + ';',
    '',
  );
  return sortie.join('\n');
}

// ---------------------------------------------------------------- Appels REST

function env(nom) {
  const v = process.env[nom];
  if (!v) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return v;
}
const base = (url) => url.replace(/\/+$/, '');
const entetes = (cle, extra = {}) => ({ apikey: cle, Authorization: `Bearer ${cle}`, ...extra });

async function requete(url, options, attendu = [200]) {
  const rep = await fetch(url, options);
  if (!attendu.includes(rep.status)) {
    const texte = await rep.text().catch(() => '');
    throw new Error(`${options.method ?? 'GET'} ${url.replace(/^https?:\/\/[^/]+/, '')} : ${rep.status} ${texte.slice(0, 200)}`);
  }
  return rep;
}

async function lireTable(url, cle, table) {
  const lignes = [];
  let total = Infinity;
  for (let debut = 0; debut < total; debut += 1000) {
    const rep = await requete(`${base(url)}/rest/v1/${table}?select=*`, {
      headers: entetes(cle, { 'Range-Unit': 'items', Range: `${debut}-${debut + 999}`, Prefer: 'count=exact' }),
    }, [200, 206]);
    const page = await rep.json();
    lignes.push(...page);
    total = Number((rep.headers.get('content-range') ?? '').split('/')[1]);
    if (!Number.isFinite(total)) total = lignes.length;
    if (!page.length) break;
  }
  if (lignes.length !== total) throw new Error(`${table} : ${lignes.length} lignes lues sur ${total} (relancer, ou la table change pendant l'export)`);
  return lignes;
}

async function lireUtilisateurs(url, cle) {
  const tous = [];
  for (let page = 1; ; page++) {
    const rep = await requete(`${base(url)}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: entetes(cle) });
    const { users } = await rep.json();
    tous.push(...users);
    if (users.length < 200) break;
  }
  return tous.map((u) => ({ id: u.id, email: u.email, email_confirm: !!u.email_confirmed_at, user_metadata: u.user_metadata ?? {}, app_metadata: u.app_metadata ?? {}, created_at: u.created_at }));
}

async function listerFichiers(url, cle, bucket, prefixe = '') {
  const trouves = [];
  for (let offset = 0; ; offset += 1000) {
    const rep = await requete(`${base(url)}/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers: entetes(cle, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: prefixe, limit: 1000, offset }),
    });
    const items = await rep.json();
    for (const it of items) {
      const chemin = prefixe ? `${prefixe}/${it.name}` : it.name;
      if (it.id === null) trouves.push(...(await listerFichiers(url, cle, bucket, chemin)));
      else trouves.push({ bucket, chemin, mime: it.metadata?.mimetype ?? 'application/octet-stream', taille: it.metadata?.size ?? null });
    }
    if (items.length < 1000) break;
  }
  return trouves;
}

const cheminUrl = (chemin) => chemin.split('/').map(encodeURIComponent).join('/');
const ecrireJson = (dossier, nom, valeur) => fs.writeFileSync(path.join(dossier, nom), JSON.stringify(valeur, null, 2));
const lireJson = (dossier, nom) => JSON.parse(fs.readFileSync(path.join(dossier, nom), 'utf8'));

function dernierDossier() {
  const liste = fs.existsSync(RACINE) ? fs.readdirSync(RACINE).filter((n) => n.startsWith('export-donnees-')).sort() : [];
  if (!liste.length) throw new Error('Aucun export trouve dans sauvegardes/. Lancer « exporter » d\'abord.');
  return path.join(RACINE, liste.at(-1));
}

// ---------------------------------------------------------------- Commandes

async function exporter() {
  const url = env('ANCIEN_URL');
  const cle = env('ANCIEN_SERVICE_KEY');
  const horodatage = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const dossier = path.join(RACINE, `export-donnees-${horodatage}`);
  fs.mkdirSync(path.join(dossier, 'fichiers'), { recursive: true });
  const manifeste = { source: base(url), date: new Date().toISOString(), tables: {}, utilisateurs: 0, fichiers: 0 };

  for (const table of [...TABLES_DONNEES, ...TABLES_SEED]) {
    const lignes = await lireTable(url, cle, table);
    ecrireJson(dossier, `table-${table}.json`, lignes);
    manifeste.tables[table] = lignes.length;
    console.log(`  ${table.padEnd(22)} ${lignes.length}`);
  }
  const utilisateurs = await lireUtilisateurs(url, cle);
  ecrireJson(dossier, 'utilisateurs.json', utilisateurs);
  manifeste.utilisateurs = utilisateurs.length;
  console.log(`  comptes Auth           ${utilisateurs.length}`);

  const index = [];
  for (const bucket of BUCKETS) index.push(...(await listerFichiers(url, cle, bucket)));
  for (const [i, f] of index.entries()) {
    const rep = await requete(`${base(url)}/storage/v1/object/${f.bucket}/${cheminUrl(f.chemin)}`, { headers: entetes(cle) });
    f.fichier = `${String(i + 1).padStart(6, '0')}.bin`;
    fs.writeFileSync(path.join(dossier, 'fichiers', f.fichier), Buffer.from(await rep.arrayBuffer()));
  }
  ecrireJson(dossier, 'fichiers.json', index);
  manifeste.fichiers = index.length;
  console.log(`  fichiers de stockage   ${index.length}`);
  ecrireJson(dossier, 'manifeste.json', manifeste);
  console.log(`\nExport termine : ${dossier}`);
}

function sql(dossier) {
  const donnees = {};
  for (const t of TABLES_DONNEES) donnees[t] = lireJson(dossier, `table-${t}.json`);
  const seed = fs.readFileSync('supabase/seed/seed_v1.sql', 'utf8');
  const manquants = [...new Set(donnees.demandes.map((d) => d.questionnaire_id))].filter((id) => !seed.includes(`'${id}'`));
  if (manquants.length) console.warn(`ATTENTION : des demandes utilisent une version du questionnaire absente du seed : ${manquants.join(', ')}`);
  const sortie = path.join(dossier, 'import-donnees.sql');
  fs.writeFileSync(sortie, genererSql(donnees));
  console.log(`Script genere : ${sortie} (${Math.round(fs.statSync(sortie).size / 1024)} Ko)`);
}

async function importer(dossier) {
  const url = env('NOUVEAU_URL');
  const cle = env('NOUVEAU_SERVICE_KEY');
  const utilisateurs = lireJson(dossier, 'utilisateurs.json');
  const lignesMdp = ['email;mot_de_passe_temporaire'];
  for (const u of utilisateurs) {
    const mdp = crypto.randomBytes(12).toString('base64url') + 'aA1!';
    const rep = await requete(`${base(url)}/auth/v1/admin/users`, {
      method: 'POST', headers: entetes(cle, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: u.id, email: u.email, password: mdp, email_confirm: true, user_metadata: u.user_metadata, app_metadata: u.app_metadata }),
    }, [200, 201, 422]);
    if (rep.status === 422) { console.log(`  compte deja present, ignore : ${u.email}`); continue; }
    const cree = await rep.json();
    if (cree.id !== u.id) throw new Error(`Le compte ${u.email} a recu un autre identifiant (${cree.id}). Arreter : les liens avec les tables seraient faux.`);
    lignesMdp.push(`${u.email};${mdp}`);
    console.log(`  compte cree : ${u.email}`);
  }
  if (lignesMdp.length > 1) {
    fs.writeFileSync(path.join(dossier, 'mots-de-passe-temporaires.csv'), lignesMdp.join('\n'));
    console.log(`Mots de passe temporaires (a changer a la premiere connexion) : ${path.join(dossier, 'mots-de-passe-temporaires.csv')}`);
  }
  const index = lireJson(dossier, 'fichiers.json');
  for (const f of index) {
    await requete(`${base(url)}/storage/v1/object/${f.bucket}/${cheminUrl(f.chemin)}`, {
      method: 'POST', headers: entetes(cle, { 'Content-Type': f.mime, 'x-upsert': 'true' }),
      body: fs.readFileSync(path.join(dossier, 'fichiers', f.fichier)),
    }, [200, 201]);
  }
  console.log(`  fichiers deposes : ${index.length}`);
  console.log('\nEtape suivante : executer import-donnees.sql dans l\'editeur SQL du nouveau projet.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [commande, dossierArg] = process.argv.slice(2);
  try {
    if (commande === 'exporter') await exporter();
    else if (commande === 'sql') sql(dossierArg ?? dernierDossier());
    else if (commande === 'importer') await importer(dossierArg ?? dernierDossier());
    else console.log('Usage : node scripts/migrer-donnees.mjs exporter | sql [dossier] | importer [dossier]');
  } catch (e) {
    console.error('Erreur :', e.message);
    process.exit(1);
  }
}
