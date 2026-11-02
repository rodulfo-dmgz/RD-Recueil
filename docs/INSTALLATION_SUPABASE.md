# Installer RD Recueil sur un projet Supabase

Ce guide installe la base complète du CRM « RD Recueil » dans un projet Supabase vide (par exemple celui d'un nouveau compte). Tous les objets SQL portent le préfixe `crm_` : tables, vues, fonctions, index et contraintes. Le préfixe laisse la place à d'autres applications dans le même projet.

Le script a été validé hors ligne : structure identique à la production d'origine (aux noms près) et 48 contrôles fonctionnels (droits par rôle, changements de statut, journal d'audit, fusion de clients, référence des demandes) sur une base Postgres simulant Supabase.

## 1. Créer le projet

1. Créer un projet Supabase (région Europe de préférence).
2. Noter l'URL (`https://<ref>.supabase.co`), la clé publique `anon` et, pour l'étape 5, la clé `service_role` (elle ne sort jamais du tableau de bord, jamais dans le dépôt).

## 2. Installer la base

Dans l'éditeur SQL du projet, exécuter dans cet ordre :

1. `supabase/migrations/20261007000000_crm_install.sql` : séquence, 33 tables `crm_*`, 3 vues, 43 fonctions, déclencheurs, sécurité par ligne et politiques, droits, buckets de stockage `demandes` et `taches` avec leurs politiques, déclencheur sur `auth.users`.
2. `supabase/seed/seed_v1.sql` : questionnaire (187 questions, 20 sections), glossaire (134 termes) et probabilités par statut.

Avec la CLI : `supabase link --project-ref <ref>` puis `supabase db push`, puis exécuter le seed à part.

Le script se lance une seule fois, sur un projet vide. Pour repartir de zéro : supprimer les objets `crm_*` ou recréer le projet.

## 3. Réglages d'authentification

Dans Authentication :

- Fournisseur **Email** activé, **inscription libre désactivée** (« Allow new users to sign up » à off) : les comptes sont créés uniquement par la fonction `creer-compte`.
- **Protection contre les mots de passe compromis** activée (Providers, Email).
- Longueur minimale du mot de passe : 8 ou plus.
- URL du site (Site URL) : l'adresse publique de l'application ; ajouter la même adresse dans les Redirect URLs.

## 4. Premier compte administrateur

Aucune inscription n'est possible, il faut donc créer le premier administrateur à la main :

1. Authentication, Users, « Add user » : saisir l'e-mail et un mot de passe, cocher « Auto Confirm User ».
2. Dans l'éditeur SQL, déclarer son rôle (remplacer l'e-mail et le nom) :

```sql
insert into public.crm_profils (user_id, role, nom, email)
select id, 'admin', 'Votre Nom', email from auth.users where email = 'vous@exemple.fr';
```

Les autres comptes (consultants, clients) se créent ensuite depuis l'application (Comptes), qui appelle `creer-compte`.

## 5. Fonctions serveur (Edge Functions)

Déployer les cinq fonctions de `supabase/functions/` avec la vérification JWT activée (valeur par défaut) :

```bash
supabase functions deploy creer-compte
supabase functions deploy supprimer-utilisateur
supabase functions deploy envoyer-notification-email
supabase functions deploy rncp-lookup
supabase functions deploy certifinfo-lookup
```

Secrets à définir (`supabase secrets set NOM=valeur`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.

| Secret | Usage | Obligatoire |
|---|---|---|
| `RESEND_API_KEY` | Envoi des e-mails (création de compte, notifications) | Non : sans clé, aucun e-mail n'est envoyé |
| `APP_URL` | Adresse de l'application dans les e-mails | Non (valeur par défaut : GitHub Pages) |
| `RNCP_API_TOKEN` | Recherche RNCP | Non |
| `CERTIFINFO_API_TOKEN` | Recherche Certif Info | Non |

L'expéditeur des e-mails (`notifications@mail.rd-formation.com`) suppose que le domaine est validé dans le compte Resend utilisé.

## 6. Brancher l'application

Dans `app/js/config.js`, remplacer `SUPABASE_URL` et `SUPABASE_ANON_KEY` par ceux du nouveau projet (clé publique uniquement), puis publier. L'application utilise déjà les noms `crm_*`.

## 7. Vérifier

- Connexion avec le compte administrateur, changement de mot de passe non exigé pour ce compte.
- Création d'un client, d'une demande et d'un compte client de test : le client voit uniquement sa demande.
- Dépôt d'un fichier sur une demande, puis téléchargement.
- Supabase, Advisors : aucune alerte de sécurité nouvelle.

## Correspondance des noms

Chaque objet de l'ancienne base `X` devient `crm_X` (tables, vues, fonctions : `clients` devient `crm_clients`, `rpc_changer_statut` devient `crm_rpc_changer_statut`). Exceptions : les buckets de stockage (`demandes`, `taches`) et les noms logiques du journal d'audit, qui restent sans préfixe pour que l'historique et son affichage ne changent pas. La séquence des références est `crm_demande_seq`.

## Reprise des données

Le script d'installation crée une base vide. Les données de l'ancien projet (28 tables, comptes Auth, fichiers des buckets) se reprennent avec `scripts/migrer-donnees.mjs` (Node 20, aucune dépendance). Les exports contiennent des données personnelles : ils sont écrits dans `sauvegardes/`, ignoré par git. Les clés `service_role` se donnent par variables d'environnement, jamais dans un fichier du dépôt.

À faire **avant** de supprimer l'ancien projet, après les étapes 1 à 6 ci-dessus (installation, seed, fonctions serveur) :

1. Exporter l'ancien projet (lecture seule) :
```bash
ANCIEN_URL=https://kowvfsesbuevylxayinl.supabase.co ANCIEN_SERVICE_KEY=<clé service_role> node scripts/migrer-donnees.mjs exporter
```
Produit `sauvegardes/export-donnees-AAAAMMJJHHMM/` : une table par fichier JSON, les comptes, les fichiers de stockage et un manifeste avec les nombres de lignes.

2. Recréer les comptes et déposer les fichiers dans le nouveau projet :
```bash
NOUVEAU_URL=https://<ref>.supabase.co NOUVEAU_SERVICE_KEY=<clé service_role> node scripts/migrer-donnees.mjs importer
```
Les comptes gardent leur identifiant (les liens entre tables restent valables) mais reçoivent un **mot de passe temporaire**, écrit dans `mots-de-passe-temporaires.csv` : les hachages d'origine ne sortent pas par l'API. Chaque compte devra le changer à sa première connexion. Les mots de passe sont à transmettre aux personnes concernées.

3. Générer puis exécuter le script de données :
```bash
node scripts/migrer-donnees.mjs sql
```
Coller `import-donnees.sql` dans l'éditeur SQL du nouveau projet. Le script suspend les déclencheurs (journal, historique des réponses, notifications repris à l'identique, sans doublon), insère les 28 tables sous leurs noms `crm_*`, repositionne la séquence des références et les compteurs automatiques, puis affiche un tableau de contrôle : « present » doit égaler « attendu » partout.

Ni le questionnaire, ni le glossaire, ni les probabilités ne sont repris : ils viennent du seed. Si l'export utilise une version du questionnaire absente du seed, l'étape 3 le signale.

Vérifié hors ligne par un aller-retour sur la base simulée : mêmes lignes dans toutes les tables, journal et identifiants conservés, référence suivante correcte (`RDF-2026-0002` après `0001`). Non vérifiable hors ligne : la création des comptes par l'API d'administration et le transfert des fichiers ; le script contrôle que chaque compte garde bien son identifiant et s'arrête sinon.
