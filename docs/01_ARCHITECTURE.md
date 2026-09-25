# Architecture de l'application « RD Recueil »

> **RD Formation** · Application de recueil des besoins client et de cadrage · Version 1.0
>
> Documents liés : `02_MODELE_RECUEIL_BESOINS.md` (questions), `03_GLOSSAIRE.md` (termes \*), `04_MODELE_NOTE_DE_CADRAGE.md` (restitution).

---

## 1. Vision

**Problème.** Chaque demande client (formation, prestation ponctuelle, module, ingénierie, certification) arrive sous une forme différente. Les informations manquent, l'entretien part de zéro et la note de cadrage est rédigée à la main.

**Solution.** Une application web qui :

1. envoie au client un questionnaire intelligent, qui n'affiche que les volets utiles à sa demande ;
2. explique chaque terme technique par une infobulle (glossaire \*) ;
3. prépare l'entretien en listant automatiquement les réponses « Je ne sais pas / à définir ensemble » ;
4. génère une note de cadrage à partir des réponses, que le client valide en ligne ;
5. conserve l'ensemble comme preuve Qualiopi (indicateurs 4 et 5 notamment).

**Périmètre V1** : questionnaire, espace client, espace consultant, mode entretien, note de cadrage, export PDF.
**Hors périmètre V1** : devis et facturation, signature électronique qualifiée, CRM complet, génération par IA. La validation de la note de cadrage inclut une signature électronique simple (dessin ou nom tapé, capturé sur `<canvas>`, stocké en image, accompagné d'un code de vérification généré côté serveur ; voir `notes_cadrage.signature_image`/`signature_credential` section 7 et `rpc_valider_cadrage` section 7.1) : ce n'est pas une signature qualifiée au sens eIDAS, mais un tracé graphique associé à l'horodatage, l'IP et l'identité déjà enregistrés à la validation. Côté RD Formation, la signature est une image fixe (`app/assets/images/signature.png`), la même sur toutes les notes : il n'existe pas de flux de capture dédié pour le consultant.

---

## 2. Acteurs et rôles

| Rôle | Qui | Droits principaux |
|---|---|---|
| `admin` | Rodulfo Dominguez | Tout. Publie les versions du questionnaire et du glossaire. Gère les comptes. |
| `consultant` | Formateur ou consultant RD Formation | Crée des demandes, invite des clients, remplit les questions `F` et `C/F`, rédige et envoie la note de cadrage. |
| `client` | Contact invité du client | Accède uniquement à ses demandes. Remplit les questions `C` et `C/F`. Lit et valide la note de cadrage. Ne voit jamais la partie 3 (`ANA`) ni les commentaires internes. |

Un même client peut avoir plusieurs contacts invités sur une même demande.

---

## 3. Cycle de vie d'une demande

### 3.1 Statuts

| Code | Libellé | Qui déclenche | Client peut saisir |
|---|---|---|---|
| `brouillon` | Brouillon | Consultant (création) | Non |
| `envoyee` | Envoyée au client | Consultant (invitation) | Oui |
| `en_saisie` | En cours de saisie | Automatique (première réponse client) | Oui |
| `soumise` | Soumise | Client (bouton « Envoyer mes réponses ») | Non |
| `entretien_planifie` | Entretien planifié | Consultant | Non |
| `en_analyse` | En analyse | Consultant (après entretien) | Non |
| `cadrage_envoye` | Note de cadrage envoyée | Consultant | Non |
| `cadrage_a_revoir` | Note à revoir | Client (demande de modification) | Non |
| `cadrage_valide` | Note validée | Client | Non |
| `proposition_envoyee` | Proposition envoyée | Consultant | Non |
| `gagnee` | Gagnée | Consultant | Non |
| `perdue` | Perdue | Consultant | Non |
| `reorientee` | Réorientée (pas un besoin de formation) | Consultant | Non |
| `abandonnee` | Abandonnée | Consultant ou client | Non |

### 3.2 Transitions autorisées

```
brouillon ──► envoyee ──► en_saisie ──► soumise ──► entretien_planifie ──► en_analyse ──► cadrage_envoye
                                          ▲                                                  │     │
                                          │ (réouverture consultant)                          │     ▼
                                          └──────────────────────────────── cadrage_a_revoir ◄┘  cadrage_valide ──► proposition_envoyee ──► gagnee | perdue
                                                            │
                                                            └──► cadrage_envoye (nouvelle version de la note renvoyée par le consultant)
en_analyse ──► reorientee
tout statut non final ──► abandonnee
```

Statuts finaux : `gagnee`, `perdue`, `reorientee`, `abandonnee`.
Toute transition est journalisée dans `evenements` (qui, quand, depuis, vers, commentaire).
Le consultant peut **réouvrir** la saisie client depuis `soumise` ou `cadrage_a_revoir` : retour à `en_saisie` (si la demande de modification remet en cause les réponses au questionnaire).
Depuis `cadrage_a_revoir`, le consultant peut aussi créer une nouvelle version de la note et la renvoyer directement, sans repasser par la saisie client : retour à `cadrage_envoye`.

---

## 4. Architecture fonctionnelle

### 4.1 Espace client

| Route | Écran | Contenu |
|---|---|---|
| `#/connexion` | Connexion | E-mail + mot de passe. |
| `#/changer-mot-de-passe` | Changement de mot de passe | Imposé à la première connexion si `doit_changer_mot_de_passe`. |
| `#/mes-demandes` | Mes demandes | Liste des demandes accessibles, statut, progression. |
| `#/d/:ref` | Accueil de la demande | Présentation, barre de progression par section, bouton reprendre. |
| `#/d/:ref/s/:section` | Saisie d'une section | Questions visibles, sauvegarde automatique, infobulles glossaire. |
| `#/d/:ref/recap` | Récapitulatif | Toutes les réponses, questions obligatoires manquantes, bouton « Envoyer mes réponses ». |
| `#/d/:ref/cadrage` | Note de cadrage | Lecture, commentaire par section, boutons « Valider » et « Demander une modification ». |
| `#/glossaire` | Glossaire | Recherche, filtre par catégorie. |

### 4.2 Espace consultant

| Route | Écran | Contenu |
|---|---|---|
| `#/tableau-de-bord` | Tableau de bord | Demandes par statut, échéances TC-13.02, demandes sans réponse depuis 7 jours. |
| `#/demandes` | Liste | Filtres : statut, type de prestation, consultant, date. |
| `#/demandes/nouvelle` | Création | Raison sociale, contact principal, types pressentis (pré-coche TC-0.01), date limite. |
| `#/demandes/:ref` | Vue 360 | Réponses par section, points « à définir », fichiers, commentaires, journal. |
| `#/demandes/:ref/entretien` | Mode entretien | Voir 4.3. |
| `#/demandes/:ref/cadrage` | Éditeur de note | Voir section 10. |
| `#/admin/questionnaire` | Versions | Import des `.md`, prévisualisation, publication. |
| `#/admin/glossaire` | Glossaire | Consultation de la version publiée. |
| `#/admin/utilisateurs` | Comptes | Consultants et clients invités. |

### 4.3 Mode entretien

Écran conçu pour être utilisé en direct face au client :

1. **En tête** : la liste des questions cochées « à définir ensemble » et des obligatoires vides.
2. **Ensuite** : toutes les questions `F` et `C/F`, section par section, avec la réponse client déjà saisie en lecture et un champ d'annotation consultant.
3. **Partie 3 (`ANA`)** en fin d'écran, avec l'aide QQOQCP\* affichée à côté des champs `ANA.03` et `ANA.04`.
4. Sauvegarde automatique, horodatage de l'entretien (`ANA.01` prérempli).

---

## 5. Architecture technique

### 5.1 Pile technique

| Couche | Choix | Raison |
|---|---|---|
| Front | HTML, CSS, JavaScript natif en modules ES, sans framework ni build | Cohérence avec les autres applications RD, maintenance simple |
| Routage | SPA à routage par hash (`#/…`) | Compatible GitHub Pages sans configuration serveur |
| Back | Supabase : Postgres, Auth (e-mail + mot de passe), Storage, RLS, Edge Functions | Déjà maîtrisé, sécurité au niveau des lignes |
| Hébergement | GitHub Pages | Gratuit, déploiement par push |
| Icônes | Lucide (CDN) | Charte RD |
| Rendu Markdown | `marked` + `DOMPurify` (CDN) | Note de cadrage et glossaire |
| Export PDF | Feuille de style `print.css` + `window.print()` | Aucune dépendance lourde, rendu fidèle |
| Tests | `node:test` (Node 20+) sur les moteurs purs | Pas de dépendance |

### 5.2 Arborescence du dépôt

```
rd-recueil/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── 01_ARCHITECTURE.md
│   ├── 02_MODELE_RECUEIL_BESOINS.md
│   ├── 03_GLOSSAIRE.md
│   └── 04_MODELE_NOTE_DE_CADRAGE.md
├── scripts/
│   ├── parse-questionnaire.mjs   # .md → data/questionnaire.json
│   ├── parse-glossaire.mjs       # .md → data/glossaire.json
│   ├── check-coherence.mjs       # IDs, conditions, glossaire, gabarit
│   └── build-seed.mjs            # data/*.json → supabase/seed/seed_vX.sql
├── data/                         # généré, versionné
│   ├── questionnaire.json
│   └── glossaire.json
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql
│   │   ├── 0002_functions.sql
│   │   └── 0003_rls.sql
│   └── seed/
│       └── seed_v1.sql           # généré
├── app/                          # racine publiée sur GitHub Pages
│   ├── index.html
│   ├── css/
│   │   ├── tokens.css            # variables de la charte
│   │   ├── base.css
│   │   ├── components.css
│   │   └── print.css
│   └── js/
│       ├── main.js
│       ├── config.js             # URL et clé publique Supabase
│       ├── router.js
│       ├── supabase.js
│       ├── auth.js
│       ├── store.js              # état de la demande en cours
│       ├── engine/               # logique pure, testée, sans DOM
│       │   ├── conditions.js
│       │   ├── validation.js
│       │   ├── completion.js
│       │   ├── template.js
│       │   └── glossary.js
│       ├── services/             # accès Supabase
│       │   ├── demandes.js
│       │   ├── reponses.js
│       │   ├── fichiers.js
│       │   ├── cadrage.js
│       │   └── questionnaire.js
│       ├── components/
│       │   ├── fields/           # un fichier par type de champ
│       │   ├── glossary-tooltip.js
│       │   ├── progress.js
│       │   ├── toast.js
│       │   └── modal.js
│       └── views/
│           ├── client/
│           └── consultant/
└── tests/
    ├── conditions.test.mjs
    ├── validation.test.mjs
    ├── template.test.mjs
    └── parse.test.mjs
```

---

## 6. Modèle du questionnaire

### 6.1 Les `.md` comme source de vérité

Les questions et le glossaire sont **rédigés dans les fichiers Markdown**, puis convertis en JSON par les scripts. On ne modifie jamais une question directement en base.

**Règles de parsing de `02_MODELE_RECUEIL_BESOINS.md`**

| Élément Markdown | Interprétation |
|---|---|
| `# PARTIE n · Titre` | Partie (1 tronc commun, 2 volets, 3 espace formateur) |
| `## CODE · Titre` | Section. `CODE` = `TC-0` … `TC-13`, `V-FOR`, `V-PON`, `V-MOD`, `V-ING`, `V-CER`, `ANA` pour la partie 3 |
| `> **Condition de section** : \`…\`` | Condition d'affichage de toute la section |
| Ligne de tableau commençant par `\| ID` | En-tête, ignorée |
| Ligne de tableau dont la 1re cellule est un ID | Une question |
| Sections de la partie 3 | `visible_client = false` |

**Découpage d'une ligne question** (8 cellules) : `id`, `libelle`, `type`, `options`, `obligatoire`, `rempli_par`, `condition`, `glossaire`.

- `options` : découpage sur ` ; `. Si une option commence par `[CODE]`, la valeur stockée est `CODE`, le libellé est le reste. Sinon la valeur est le **slug** du libellé (voir 6.4). `-` = aucune option.
- Option spéciale : `Colonnes : A ; B ; C` pour `tableau` (définit les colonnes de la grille). Pour `classement`, les options sont les éléments à ordonner.
- `glossaire` : découpage sur ` ; `, `-` = aucun.
- Le `\*` dans un libellé est conservé tel quel dans le JSON ; c'est le rendu qui le transforme (section 9).

**Exemple de sortie JSON**

```json
{
  "id": "TC-8.12",
  "section": "TC-8",
  "ordre": 12,
  "libelle": "Laquelle, et quelles normes accepte-t-elle ?",
  "type": "choix_multiple",
  "options": [
    { "valeur": "scorm-1-2", "libelle": "SCORM\\* 1.2" },
    { "valeur": "scorm-2004", "libelle": "SCORM 2004" },
    { "valeur": "xapi", "libelle": "xAPI\\*" },
    { "valeur": "je-ne-sais-pas", "libelle": "Je ne sais pas" }
  ],
  "obligatoire": false,
  "rempli_par": "C/F",
  "condition": "TC-8.11 = oui",
  "glossaire": ["scorm", "xapi"],
  "nsp_autorise": false
}
```

### 6.2 Types de champs

| Type | Composant | Valeur stockée (`jsonb`) | Validation |
|---|---|---|---|
| `texte` | input texte | `"chaîne"` | 1 à 300 caractères |
| `texte_long` | zone de texte extensible | `"chaîne"` | 1 à 5 000 caractères |
| `nombre` | input numérique | `12` | entier ≥ 0 |
| `montant` | input numérique + « € HT » | `2400.00` | décimal ≥ 0, 2 décimales |
| `date` | sélecteur de date | `"2026-11-02"` | ISO 8601 |
| `periode` | deux dates | `{"debut":"2026-11-02","fin":"2027-01-15"}` | fin ≥ début |
| `choix_unique` | boutons radio (≤ 5 options) ou liste (> 5) | `"valeur"` | valeur dans les options |
| `choix_multiple` | cases à cocher | `["valeur1","valeur2"]` | au moins 1 si obligatoire |
| `oui_non` | interrupteur à deux états | `"oui"` ou `"non"` | |
| `classement` | liste réordonnable au glisser et au clavier | `["valeur3","valeur1",…]` | toutes les valeurs présentes |
| `tableau` | grille éditable, ajout et suppression de lignes | `[{"Indicateur":"…","Valeur actuelle":"…"}]` | au moins 1 ligne si obligatoire |
| `contact` | 4 champs | `{"nom":"","fonction":"","email":"","tel":""}` | nom et e-mail obligatoires, e-mail valide |
| `tableau_contacts` | liste de `contact` | `[{…},{…}]` | idem par ligne |
| `adresse` | rue, code postal, ville | `{"rue":"","cp":"","ville":""}` | code postal à 5 chiffres |
| `siret` | input masqué | `"12345678900012"` | 14 chiffres + clé de Luhn |
| `url` | input URL | `"https://…"` | URL valide |
| `fichier` | dépôt multiple | `["demandes/RDF-2026-0001/TC-4.09/fiche.pdf"]` | 20 Mo max par fichier ; PDF, DOCX, XLSX, PPTX, PNG, JPG |
| `code_rncp` | input texte + vérification officielle (RNCP/CFD) | `"RNCP12345"` | libre ; si le code correspond au format RNCP/CFD, l'intitulé officiel est vérifié via l'API France Compétences (Edge Function `rncp-lookup`) |

**Réponse « Je ne sais pas / à définir ensemble »**
Stockée dans la colonne `nsp = true` (la valeur peut rester vide). Elle compte comme **renseignée** pour la soumission et alimente la liste des points d'entretien.
Non proposée pour : `oui_non`, `siret`, `adresse`, `contact`, `url`, `fichier`.
Non proposée non plus pour les questions dont les options offrent déjà un choix « Je ne sais pas » équivalent (redondant avec la case) : `TC-0.01`, `TC-0.02`, `TC-1.01`, `TC-1.05`, `TC-1.10`, `TC-4.05`, `TC-5.13`, `TC-8.12`, `TC-10.01`, `TC-11.04`, `FOR.05`, `CER.04`, `CER.05`.

### 6.3 Grammaire des conditions

```
condition   := '-' | expression
expression  := terme ( ('ET' | 'OU') terme )*
terme       := ID operateur valeur | ID 'est renseigné'
operateur   := '=' | '!=' | 'contient' | 'ne contient pas'
ID          := identifiant de question (ex. TC-8.11, PON.01)
valeur      := code entre crochets sans crochets (FOR) ou libellé d'option
```

- Priorité : `ET` avant `OU`. Pas de parenthèses en V1.
- `=` et `!=` pour `choix_unique` et `oui_non` ; `contient` pour `choix_multiple`.
- Une question dont la question source est **masquée** est elle-même masquée (propagation).
- Une question masquée n'est jamais obligatoire et n'apparaît pas dans la note de cadrage, même si une valeur avait été saisie avant (la valeur est conservée en base, marquée ignorée à l'affichage).
- `check-coherence.mjs` refuse une condition qui cite un ID inexistant, un ID situé **après** la question, ou une valeur absente des options.

### 6.4 Normalisation des valeurs

`slug(libellé)` : suppression de `\*`, passage en minuscules, suppression des accents, tout caractère non alphanumérique remplacé par `-`, tirets multiples réduits, tirets de début et fin supprimés.
Exemple : `Accompagnement Qualiopi\*` devient `accompagnement-qualiopi`.
Les conditions comparent toujours `slug(valeur de la condition)` à la valeur stockée. Les codes `[FOR]` sont comparés tels quels.

### 6.5 Versionnement

- Chaque publication crée une ligne `questionnaires` (`v1`, `v2`…) avec l'empreinte SHA-256 des `.md` sources.
- Une demande est **liée à la version** en vigueur à sa création et n'en change jamais.
- Un ID publié n'est jamais réutilisé pour une autre question. Une question supprimée disparaît simplement de la version suivante.

### 6.6 Progression

- **Progression client** = questions visibles, `rempli_par` ∈ {`C`, `C/F`}, obligatoires, renseignées ou `nsp` ÷ total de ces questions.
- **Progression dossier** (consultant) = même calcul sur toutes les questions visibles obligatoires, `F` inclus.
- Affichage par section (pastilles) et global (barre).

---

## 7. Modèle de données (Supabase / Postgres)

```sql
-- Profils et rôles
create table profils (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin','consultant','client')),
  nom text,
  email text not null unique,
  created_at timestamptz default now()
);

-- Versions du référentiel
create table questionnaires (
  id text primary key,                 -- 'v1'
  statut text not null check (statut in ('brouillon','publie','archive')),
  source_hash text not null,
  publie_le timestamptz,
  created_at timestamptz default now()
);

create table sections (
  questionnaire_id text references questionnaires on delete cascade,
  id text,                             -- 'TC-4', 'V-MOD', 'ANA'
  partie smallint not null,
  titre text not null,
  ordre smallint not null,
  condition text default '-',
  visible_client boolean default true,
  primary key (questionnaire_id, id)
);

create table questions (
  questionnaire_id text references questionnaires on delete cascade,
  id text,                             -- 'TC-4.01'
  section_id text not null,
  ordre smallint not null,
  libelle text not null,
  type text not null,
  options jsonb default '[]',
  obligatoire boolean not null,
  rempli_par text not null check (rempli_par in ('C','F','C/F')),
  condition text default '-',
  glossaire text[] default '{}',
  nsp_autorise boolean default true,
  primary key (questionnaire_id, id)
);

create table glossaire (
  questionnaire_id text references questionnaires on delete cascade,
  id text,                             -- 'opco'
  libelle text not null,
  categorie text not null,
  definition text not null,
  exemple text not null,
  primary key (questionnaire_id, id)
);

-- Clients et demandes
create table clients (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text not null,
  siret text,
  created_at timestamptz default now()
);

create sequence demande_seq;

create table demandes (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,      -- 'RDF-2026-0001', généré par trigger
  client_id uuid references clients,
  questionnaire_id text references questionnaires not null,
  statut text not null default 'brouillon',
  types text[] default '{}',           -- copie de TC-0.01, puis ANA.06
  consultant_id uuid references profils(user_id),
  date_limite date,                    -- copie de TC-13.02
  soumise_le timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table demande_acces (
  demande_id uuid references demandes on delete cascade,
  email text not null,
  user_id uuid references auth.users,
  droit text not null default 'editeur' check (droit in ('editeur','lecteur')),
  invite_le timestamptz default now(),
  primary key (demande_id, email)
);

-- Réponses
create table reponses (
  demande_id uuid references demandes on delete cascade,
  question_id text not null,
  valeur jsonb,
  nsp boolean default false,
  annotation_consultant text,          -- jamais visible du client
  saisi_par uuid references auth.users,
  updated_at timestamptz default now(),
  primary key (demande_id, question_id)
);

create table reponses_historique (
  id bigint generated always as identity primary key,
  demande_id uuid, question_id text,
  ancienne_valeur jsonb, nouvelle_valeur jsonb,
  auteur uuid, modifie_le timestamptz default now()
);

create table fichiers (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  question_id text not null,
  chemin text not null,                -- bucket 'demandes'
  nom text not null,
  taille integer not null,
  mime text not null,
  depose_par uuid references auth.users,
  created_at timestamptz default now()
);

create table commentaires (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  cible text not null,                 -- ID de question ou 'cadrage:section-3'
  auteur uuid references auth.users,
  texte text not null,
  interne boolean default false,       -- true = invisible pour le client
  created_at timestamptz default now()
);

-- Note de cadrage
create table notes_cadrage (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid references demandes on delete cascade,
  version smallint not null,
  contenu_md text not null,            -- gabarit rendu puis retouché
  statut text not null check (statut in ('brouillon','envoyee','a_revoir','validee')),
  envoyee_le timestamptz,
  validee_le timestamptz,
  validee_par uuid references auth.users,
  validation_ip inet,
  signature_image text,                -- tracé ou nom tapé du client au format data URL (image/png)
  signature_credential text,           -- code de vérification numérique généré à la validation (ex. 123456-789012)
  unique (demande_id, version)
);

-- Journal
create table evenements (
  id bigint generated always as identity primary key,
  demande_id uuid references demandes on delete cascade,
  type text not null,                  -- 'statut', 'invitation', 'soumission', 'cadrage'…
  de text, vers text,
  auteur uuid references auth.users,
  commentaire text,
  created_at timestamptz default now()
);
```

**Fonctions et triggers** (`0002_functions.sql`)

| Objet | Rôle |
|---|---|
| `fn_reference()` trigger `before insert on demandes` | Génère `RDF-AAAA-NNNN` à partir de `demande_seq`. |
| `fn_touch()` trigger | Met à jour `updated_at`. |
| `fn_historiser_reponse()` trigger `after update on reponses` | Écrit dans `reponses_historique`. |
| `fn_premiere_saisie()` trigger `after insert on reponses` | Passe la demande de `envoyee` à `en_saisie` si l'auteur est client. |
| `rpc_changer_statut(demande_id, vers, commentaire)` `security definer` | Vérifie la transition (3.2) et le rôle, écrit dans `evenements`. Seul moyen de changer un statut. |
| `rpc_soumettre(demande_id, ids_obligatoires)` `security definer` | `ids_obligatoires` : questions obligatoires actuellement visibles calculées côté client (seule implémentation de la visibilité conditionnelle, section 6.4). Vérifie que chacune a une réponse enregistrée, puis passe à `soumise`. |
| `rpc_valider_cadrage(note_id, signature_image)` | Client uniquement ; enregistre le tracé de signature et un code de vérification généré côté serveur (`signature_credential`), horodate, enregistre l'IP, passe la demande à `cadrage_valide`. |
| `est_staff()`, `a_acces(demande_id)` | Fonctions utilitaires pour les politiques RLS. |

---

## 8. Sécurité

### 8.1 Authentification

- E-mail + mot de passe (Supabase Auth). Aucun mot de passe choisi librement par le titulaire à la création : un mot de passe temporaire est généré par une Edge Function (`creer-compte`, exécutée côté serveur avec la clé `service_role`, jamais exposée au navigateur) et communiqué par le consultant ou l'admin au titulaire du compte. Le compte est marqué `doit_changer_mot_de_passe = true` ; la première connexion redirige obligatoirement vers un écran de changement de mot de passe avant d'accéder au reste de l'application.
- L'invitation d'un client crée une ligne `demande_acces` ; la création du compte (Edge Function) rattache `user_id` et crée le profil `client`.
- Les comptes `consultant` et `admin` sont créés par l'admin uniquement, via la même Edge Function ; l'inscription libre est désactivée.
- Protection Supabase Auth contre les mots de passe compromis (vérification HaveIBeenPwned) activée au niveau du projet.

> Choix initial (V1.0) : lien magique par e-mail. Abandonné en cours de développement au profit d'un mot de passe temporaire généré par le consultant, la fiabilité de livraison des e-mails transactionnels s'étant révélée un point de friction récurrent en usage réel.

### 8.2 Politiques RLS (`0003_rls.sql`)

| Table | Staff (`admin`, `consultant`) | Client |
|---|---|---|
| `questionnaires`, `questions`, `glossaire` | Lecture | Lecture (questions : uniquement sections `visible_client`) |
| `demandes` | Lecture et écriture | Lecture si `a_acces()` |
| `reponses` | Tout | Lecture si `a_acces()` et question non `F` ; écriture si droit `editeur`, question `C` ou `C/F`, statut `envoyee` ou `en_saisie`. Colonne `annotation_consultant` masquée par une vue `v_reponses_client`. |
| `fichiers` + bucket Storage `demandes` | Tout | Lecture et dépôt dans `demandes/{reference}/…` si `a_acces()` |
| `commentaires` | Tout | Lecture et écriture si `interne = false` |
| `notes_cadrage` | Tout | Lecture si statut ≠ `brouillon` |
| `evenements` | Lecture | Aucun accès |

La clé publique (`anon`) est la seule présente côté front. Aucune clé `service_role` dans le dépôt.

### 8.3 RGPD\*

- Aucune donnée médicale : l'aide de `TC-5.14` le rappelle explicitement.
- Durée de conservation par défaut : 3 ans après le dernier statut final, puis anonymisation (tâche planifiée `pg_cron`).
- Mentions d'information affichées sur l'écran de connexion et en pied de questionnaire.

---

## 9. Glossaire à l'exécution

1. Au chargement, `glossary.js` indexe `glossaire` par `id`.
2. Au rendu d'un libellé ou d'une option, le moteur repère chaque `\*` et l'associe **dans l'ordre d'apparition** (libellé puis options) aux identifiants de la colonne `glossaire`. Le mot qui précède l'astérisque devient le déclencheur de l'infobulle.
3. Le terme est rendu ainsi :
   ```html
   <button class="gl-term" data-gl="opco" aria-describedby="gl-opco">OPCO<sup>*</sup></button>
   ```
4. Au survol, au focus clavier ou au toucher : infobulle avec **libellé, définition, exemple** et lien « Voir dans le glossaire ».
5. Les identifiants en surnombre (termes liés mais absents du texte) s'affichent en pastilles « Voir aussi » sous la question. Un `\*` sans identifiant correspondant, ou un identifiant absent du glossaire, fait échouer `check-coherence.mjs`.
6. Accessibilité : infobulle fermable par `Échap`, lue par les lecteurs d'écran, contraste AA.

---

## 10. Note de cadrage

### 10.1 Génération

1. Le consultant clique sur « Générer la note » (statut `en_analyse`).
2. `template.js` lit `04_MODELE_NOTE_DE_CADRAGE.md` (partie entre les commentaires `DÉBUT` et `FIN`), remplace les variables, évalue les blocs `{{#si}}` avec le même moteur que les conditions, rend les `{{#tableau}}`, construit `{{liste_nsp}}` et `{{glossaire_utilise}}`.
3. Le résultat Markdown est enregistré dans `notes_cadrage.contenu_md` (version 1, `brouillon`).
4. Le consultant retouche le texte dans un éditeur Markdown avec aperçu côte à côte.

### 10.2 Circuit de validation

`brouillon` → **Envoyer** → `envoyee` (e-mail au client) → le client **valide** (`validee`) ou **demande une modification** avec commentaire (`a_revoir`) → le consultant crée la version suivante.
Chaque version est conservée. Seule la dernière version validée fait foi.

### 10.3 Export PDF

`print.css` : format A4, marges 18 mm, en-tête avec logo et référence, pied avec numéro de page et version, sauts de page avant chaque section de niveau 2 si nécessaire, infobulles remplacées par l'annexe glossaire.

---

## 11. Correspondance Qualiopi\*

| Indicateur | Exigence (résumé) | Où l'application apporte la preuve |
|---|---|---|
| 1 | Information du public sur les prestations | Écran d'accueil du questionnaire, mentions |
| 4 | Analyse du besoin du bénéficiaire | TC-3, TC-4, TC-5, ANA.03 à ANA.05, note de cadrage validée |
| 5 | Objectifs opérationnels et évaluables | TC-6, ANA.07 (3C), note de cadrage section 5 |
| 6 | Contenus et modalités adaptés | TC-7, TC-8, volets V-FOR, V-MOD |
| 7 | Adéquation au référentiel de certification | TC-7.03, TC-7.04, volet V-CER |
| 8 | Positionnement à l'entrée | TC-5.09, ING.07 |
| 10 | Adaptation de la prestation et du suivi | ING.07, TC-5.13, TC-5.14 |
| 11 | Évaluation de l'atteinte des objectifs | TC-9 |
| 13 | Coordination en alternance | ING.08, ING.09 |
| 17 | Moyens humains et techniques | TC-8.14, FOR.03, FOR.04 |
| 26 | Accueil des personnes en situation de handicap | TC-2.04, TC-5.13, TC-5.14, FOR.05 |
| 27 | Sous-traitance | TC-1.12 à TC-1.14 |
| 30 | Recueil des appréciations | TC-9.01 (satisfaction à chaud et à froid) |

Export « Dossier de preuves » (V2) : un PDF par demande regroupant réponses, note validée et journal.

---

## 12. Interface

### 12.1 Charte RD Formation (`tokens.css`)

```css
:root {
  --rd-bleu: #1F4590;
  --rd-turquoise: #1CA098;
  --rd-orange: #FF570A;
  --fond: #F7F8FA;
  --surface: #FFFFFF;
  --texte: #1A1F2B;
  --texte-doux: #5B6475;
  --bordure: #E2E6ED;
  --succes: #1CA098;
  --alerte: #FF570A;
  --erreur: #C62828;
  --police-titre: 'Space Grotesk', system-ui, sans-serif;
  --police-texte: 'Plus Jakarta Sans', system-ui, sans-serif;
  --police-code: 'JetBrains Mono', ui-monospace, monospace;
  --rayon: 10px;
  --ombre: 0 2px 8px rgba(31, 69, 144, .08);
}
```

- Bleu : navigation, titres, boutons principaux. Turquoise : progression, validations. Orange : points « à définir », alertes, appels à l'action secondaires.
- Termes du glossaire : soulignement pointillé turquoise, astérisque en exposant.
- Icônes Lucide uniquement.
- Mobile d'abord : une question par ligne, boutons de 44 px minimum.
- Accessibilité visée : RGAA\* niveau AA (contrastes, navigation clavier, étiquettes, messages d'erreur liés aux champs).
- Aucun tiret cadratin dans les textes de l'interface.

### 12.2 Comportements

- Sauvegarde automatique 800 ms après la dernière frappe, indicateur « Enregistré » discret.
- Hors connexion : file d'attente locale des réponses, renvoyée au retour du réseau.
- Navigation libre entre sections ; les sections masquées par condition disparaissent de la navigation.
- Chaque question obligatoire vide au moment de la soumission est listée avec un lien direct.

---

## 13. Règles métier récapitulatives

| Code | Règle |
|---|---|
| RM-01 | Si `TC-0.01` contient `NSP`, aucun volet n'est affiché ; le consultant qualifie la demande en entretien via `ANA.06`. |
| RM-02 | `demandes.types` est synchronisé avec `TC-0.01` jusqu'à ce que `ANA.06` soit renseigné, puis avec `ANA.06`. |
| RM-03 | Les volets affichés côté consultant suivent `ANA.06` s'il est renseigné, sinon `TC-0.01`. |
| RM-04 | `demandes.date_limite` = `TC-13.02`. Alerte au tableau de bord à J-5. |
| RM-05 | Relance automatique au client après 7 jours sans saisie en statut `envoyee` ou `en_saisie` (V2). |
| RM-06 | Si `ANA.05` = « Non (réorienter) », le bouton « Passer en réorientée » est proposé et la note de cadrage bascule sur son bloc conditionnel de réorientation. |
| RM-07 | La note de cadrage ne peut être envoyée que si `ANA.03`, `ANA.04`, `ANA.05`, `ANA.06`, `ANA.07` et `ANA.12` sont renseignés. |
| RM-08 | Une note validée n'est plus modifiable ; toute évolution crée une nouvelle version. |

---

## 14. Découpage en lots

| Lot | Contenu | Critères d'acceptation |
|---|---|---|
| **0 · Référentiel** | Scripts de parsing, `check-coherence`, JSON, seed SQL | 187 questions et 134 termes parsés ; zéro erreur de cohérence ; tests `parse` verts |
| **1 · Socle** | Migrations, RLS, Auth (e-mail + mot de passe), routeur, charte, layout | Un client ne peut lire aucune demande hors `demande_acces` (test manuel avec deux comptes) |
| **2 · Moteur de formulaire** | 18 types de champs, conditions, validation, NSP, progression, autosave | Tests `conditions` et `validation` verts ; saisie complète d'une demande multi-volets sur mobile |
| **3 · Espace consultant** | Tableau de bord, liste, création, invitation, vue 360, mode entretien, statuts | Parcours `brouillon` → `en_analyse` complet, journal alimenté |
| **4 · Note de cadrage** | Moteur de gabarit, éditeur, envoi, validation client, versions, PDF | Note générée sans variable brute restante ; PDF A4 conforme |
| **5 · Pilotage** | Relances, alertes, exports CSV, dossier de preuves Qualiopi | Export conforme pour une demande test |

---

## 15. Évolutions envisagées (post V1)

- Préremplissage de la structure à partir du SIRET (API publique de l'INSEE).
- Aide à la rédaction des objectifs 3C à partir des réponses TC-4 et TC-6 (IA), toujours validée par le consultant.
- Génération de la proposition technique et financière à partir de la note validée.
- Modèles de questionnaire allégés par famille de prestation (par exemple un recueil court pour une prestation ponctuelle simple).
