# Cahier des charges — Transformer le CRM existant en CRM "Twenty-like"

> **Document destiné à Claude Code**
> Évolution progressive d'un CRM existant vers une UX moderne inspirée de Twenty, **sans changer la stack**.

[Twenty CRM OPEN SOURCE](https://github.com/twentyhq/twenty)

---

## Sommaire

1. [Mission](#0-mission)
2. [Objectif général](#1-objectif-général)
3. [Règle fondamentale](#2-règle-fondamentale)
4. [Première étape obligatoire : audit](#3-première-étape-obligatoire--audit-du-projet)
5. [Architecture cible](#4-architecture-cible)
6. [Design System](#5-design-system)
7. [Phases 1 à 21](#6-phase-1--shell-de-lapplication)
8. [Ordre exact d'exécution](#35-ordre-exact-dexécution)
9. [Critères de réussite](#37-critères-de-réussite)
10. [Première instruction à exécuter](#39-première-instruction-à-exécuter-maintenant)

---

## 0. Mission

Faire évoluer le **CRM existant** sans repartir de zéro et sans remplacer sa stack.

### Stack IMPOSÉE

- HTML
- CSS
- JavaScript vanilla
- Supabase
- Lucide.js pour les icônes

### Interdictions

| Interdit | Détail |
|---|---|
| ❌ Frameworks JS | React, Vue, Angular, Svelte |
| ❌ CSS Frameworks | Tailwind CSS, Bootstrap |
| ❌ Langages | TypeScript |
| ❌ Runtime | Node.js obligatoire pour le runtime de l'application |
| ❌ Backend | Remplacer Supabase |
| ❌ Copie | Cloner intégralement Twenty |
| ❌ Backend Twenty | GraphQL / NestJS / Redis / ORM |

> **Objectif** : reproduire les meilleurs **patterns UX** de Twenty dans le CRM existant, **pas copier son code**.
>
> Le résultat doit rester un projet **simple à maintenir** en HTML/CSS/JS + Supabase.

---

## 1. Objectif général

Transformer progressivement le CRM existant en une interface CRM moderne inspirée de Twenty :

- Navigation latérale moderne
- Espace de travail
- Recherche globale
- Command Menu `Ctrl+K`
- Listes / tableaux puissants
- Vues sauvegardées
- Filtres avancés
- Tris
- Regroupements
- Kanban
- Calendrier
- Fiches détaillées
- Drawers latéraux
- Timeline d'activité
- Formulaires modernes
- Skeleton loaders
- États vides
- Notifications / toasts
- Responsive desktop / tablette
- Système d'icônes Lucide.js cohérent

> Les **données**, la **logique métier** et les **droits** restent ceux du CRM existant et de Supabase.

---

## 2. Règle fondamentale

### 🚫 NE PAS RECONSTRUIRE L'APPLICATION AVANT DE L'AVOIR AUDITÉE

Avant toute modification :

1. Analyser l'arborescence actuelle
2. Identifier les pages
3. Identifier les composants existants
4. Identifier les fichiers CSS
5. Identifier les fichiers JavaScript
6. Identifier la connexion Supabase
7. Identifier les tables Supabase utilisées
8. Identifier les fonctions RPC éventuelles
9. Identifier les politiques RLS
10. Identifier les fonctionnalités déjà opérationnelles

> **Ne pas supprimer ou réécrire massivement du code fonctionnel sans nécessité.**

---

## 3. Première étape obligatoire : audit du projet

Commencer par produire un rapport `AUDIT_CRM.md`.

### Structure du rapport

#### Frontend

- Fichiers HTML
- Fichiers CSS
- Fichiers JS
- Modules existants
- Composants réutilisables
- Pages
- Navigation
- Formulaires
- Tableaux
- Modales
- Drawers
- Scripts Supabase

#### Supabase

Lister :

- Tables utilisées
- Colonnes importantes
- Relations
- Vues SQL
- Fonctions RPC
- Triggers
- RLS
- Storage
- Auth

#### Fonctionnalités existantes

Classer en :

- ✅ Fonctionnel
- 🟡 Partiellement fonctionnel
- 🔴 Cassé
- ⚪ Absent

#### Risques

Identifier :

- Code dupliqué
- JS trop centralisé
- CSS dupliqué
- Dépendances inutiles
- Problèmes d'événements
- Problèmes de sécurité
- Requêtes Supabase répétées
- Problèmes de responsive
- Problèmes de performance

> ⚠️ **Ne rien casser pendant cet audit.**

---

## 4. Architecture cible

**Ne pas convertir le projet en framework.** L'objectif est une architecture vanilla propre.

```text
/
├── index.html
├── login.html
│
├── pages/
│   ├── dashboard.html
│   ├── entreprises.html
│   ├── contacts.html
│   ├── prospects.html
│   ├── opportunites.html
│   ├── formations.html
│   ├── sessions.html
│   ├── stagiaires.html
│   ├── devis.html
│   ├── factures.html
│   └── activites.html
│
├── assets/
│   ├── css/
│   │   ├── tokens.css
│   │   ├── reset.css
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── tables.css
│   │   ├── forms.css
│   │   ├── drawers.css
│   │   ├── command-menu.css
│   │   └── responsive.css
│   │
│   └── js/
│       ├── app.js
│       ├── supabase.js
│       ├── auth.js
│       ├── navigation.js
│       ├── command-menu.js
│       ├── toast.js
│       ├── modal.js
│       ├── drawer.js
│       ├── table.js
│       ├── filters.js
│       ├── views.js
│       ├── search.js
│       └── utils.js
│
└── modules/
    ├── entreprises/
    ├── contacts/
    ├── prospects/
    ├── opportunites/
    ├── formations/
    ├── sessions/
    ├── stagiaires/
    ├── devis/
    ├── factures/
    └── activites/
```

> **Adapter cette structure à l'existant** au lieu de déplacer arbitrairement tous les fichiers.

---

## 5. Design System

Créer un design system léger en CSS.

### Typographie

- **Space Grotesk** → titres et éléments importants
- **Plus Jakarta Sans** → contenu

### Icônes — Lucide.js **exclusivement**

```html
<script src="https://unpkg.com/lucide@latest"></script>
```

Puis :

```html
<i data-lucide="building-2"></i>
<i data-lucide="users"></i>
<i data-lucide="calendar"></i>
```

Initialisation :

```js
lucide.createIcons();
```

> ❌ Ne plus introduire **plusieurs** bibliothèques d'icônes.
> ❌ Pas de Font Awesome, Phosphor, Bootstrap Icons dans les nouveaux composants.

### Couleurs — Tokens

Utiliser les tokens RD Recueil.


> ❌ Ne pas utiliser les couleurs de Twenty comme identité visuelle.

---

## 6. Phase 1 — Shell de l'application

Créer une structure commune :

```text
┌──────────────────────────────────────────────────────┐
│ Header                                               │
├───────────────┬──────────────────────────────────────┤
│ Sidebar       │ Main                                 │
│               │                                      │
│ Navigation    │ Page                                 │
│               │                                      │
│               │                                      │
└───────────────┴──────────────────────────────────────┘
```

### Sidebar

Prévoir :

- Logo RD
- Workspace
- Recherche
- Favoris
- Sections
- Navigation
- Paramètres
- Utilisateur

Exemple :

```text
RD CRM

⌕ Rechercher

FAVORIS
  Dashboard
  Prospects
  Clients

COMMERCIAL
  Entreprises
  Contacts
  Opportunités
  Pipeline

ACTIVITÉ
  Emails
  Appels
  Rendez-vous
  Tâches

FORMATION
  Formations
  Sessions
  Stagiaires

FINANCE
  Devis
  Factures

Paramètres
```

> La sidebar doit pouvoir être **réduite**.
> ❌ Ne pas utiliser `position: fixed` partout sans raison.

---

## 7. Phase 2 — Header

Créer un header cohérent :

```text
[breadcrumb]              [Recherche] [+] [Notifications] [Avatar]
```

Prévoir :

- Breadcrumb
- Recherche globale
- Bouton création rapide
- Notifications
- Profil

---

## 8. Phase 3 — Command Menu

Accessible via `Ctrl + K` et `Cmd + K` (Mac).

```text
┌─────────────────────────────────────────┐
│ Rechercher ou exécuter une commande...  │
├─────────────────────────────────────────┤
│                                         │
│ Créer une entreprise                    │
│ Créer un contact                        │
│ Créer un prospect                       │
│ Créer une opportunité                   │
│ Créer une tâche                         │
│                                         │
│ Rechercher une entreprise               │
│ Rechercher un contact                   │
│                                         │
│ Importer                                │
│ Exporter                                │
│ Paramètres                              │
└─────────────────────────────────────────┘
```

**Clavier-friendly obligatoire** :

- `Arrow Up`
- `Arrow Down`
- `Enter`
- `Escape`

---

## 9. Phase 4 — Tables CRM

Créer un composant **table réutilisable**.

### Fonctions

- Recherche
- Pagination
- Tri
- Sélection
- Sélection multiple
- Actions groupées
- Colonnes configurables
- Largeur des colonnes
- Masquage des colonnes
- Loading
- Skeleton
- Empty state
- Erreur
- Refresh

### Exemple

```text
Entreprises

[Rechercher...] [Filtrer] [Trier] [Colonnes] [+ Ajouter]

┌────┬──────────────┬────────────┬──────────┬──────────┐
│ □  │ Entreprise   │ Contact    │ Statut   │ Activité │
├────┼──────────────┼────────────┼──────────┼──────────┤
│ □  │ ACME         │ Dupont     │ Client   │ 02/10    │
│ □  │ ABC          │ Martin     │ Prospect │ 01/10    │
└────┴──────────────┴────────────┴──────────┴──────────┘
```

---

## 10. Phase 5 — Views

Créer un système de **vues sauvegardées**.

Une vue doit pouvoir stocker :

- Nom
- Module
- Type
- Filtres
- Tri
- Groupement
- Colonnes
- Ordre
- Visibilité

### Types

`table` · `kanban` · `calendar` · `list`

### Exemples

```text
Entreprises
├── Toutes
├── Mes entreprises
├── Clients
├── Prospects
└── À relancer

Prospects
├── Tous
├── Nouveaux
├── À qualifier
├── Qualifiés
├── Proposition
└── Perdus
```

> ⚠️ Avant de créer de nouvelles tables Supabase, **vérifier si une structure équivalente existe déjà**.

---

## 11. Phase 6 — Filtres

Créer un **Filter Builder générique**.

```text
Statut        est          Client
ET
Ville         contient    Montpellier
ET
Dernière activité >       30 jours
```

Prévoir :

- `AND` / `OR`
- Ajout de condition
- Suppression
- Groupes
- Opérateurs adaptés au type de colonne

### Types supportés

- Texte
- Nombre
- Date
- Booléen
- Enum
- Relation

---

## 12. Phase 7 — Drawer

Lorsqu'un utilisateur clique sur une ligne, **ne pas forcément changer de page**. Ouvrir un drawer :

```text
┌───────────────────────────────┬──────────────────────────┐
│ Liste                         │ Entreprise               │
│                               │                          │
│ ACME                          │ ACME FORMATION           │
│ ABC                           │ Client                   │
│ RD Formation                  │                          │
│                               │ SIREN                    │
│                               │ 123456789                │
│                               │                          │
│                               │ Contact                  │
│                               │ Jean Dupont              │
│                               │                          │
│                               │ [Ouvrir la fiche]        │
└───────────────────────────────┴──────────────────────────┘
```

Le drawer doit :

- Être accessible
- Avoir `Escape`
- Avoir fermeture
- Gérer le focus
- Fonctionner sur mobile

---

## 13. Phase 8 — Record Pages

Créer une structure générique de fiche.

```text
← Entreprises

ACME FORMATION                         [Modifier] [...]

Client
Formation professionnelle

[Vue d'ensemble] [Activité] [Contacts] [Commercial] [Finance]

┌──────────────────────┐ ┌────────────────────────┐
│ Informations         │ │ Contact principal      │
│                      │ │                        │
│ SIREN                │ │ Jean Dupont            │
│ SIRET                │ │ jean@acme.fr           │
│ NDA                  │ │ 06 00 00 00 00         │
│ Adresse              │ │                        │
└──────────────────────┘ └────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Activité                                        │
│                                                 │
│ Email envoyé                                    │
│ Appel                                           │
│ Devis envoyé                                    │
└─────────────────────────────────────────────────┘
```

---

## 14. Phase 9 — Timeline

Créer un composant `<ActivityTimeline />`.

### Événements

- Email
- Appel
- Rendez-vous
- Tâche
- Note
- Devis
- Facture
- Formation
- Changement de statut

Chaque événement affiche :

- Icône (Lucide)
- Type
- Date
- Utilisateur
- Titre
- Description
- Relation

---

## 15. Phase 10 — Kanban

Kanban générique pour les **opportunités**.

```text
Nouveau       Qualifié       Proposition      Négociation
─────────────────────────────────────────────────────────

ACME          ABC            Formation X      Société Y

RD Formation  DEF            Formation Y
```

Prévoir **drag & drop**.

> ⚠️ Le changement de colonne doit mettre à jour Supabase.
> ❌ Ne pas modifier le statut localement sans confirmer la réussite Supabase.
> ✅ Prévoir rollback UI si la requête échoue.

---

## 16. Phase 11 — Calendrier

Prévoir un calendrier pour :

- Rendez-vous
- Sessions
- Tâches
- Événements

> ⚠️ Ne pas installer une grosse librairie si un calendrier vanilla suffit.
> Avant d'ajouter une dépendance, **vérifier qu'elle est réellement nécessaire**.

---

## 17. Phase 12 — Skeletons

Chaque page importante doit avoir un état de chargement.

```text
████████████████
████████
████████████████████
```

> ❌ Ne pas afficher une page vide pendant une requête Supabase.

Créer des skeletons pour :

- Table
- Fiche
- Carte
- Timeline
- KPI

---

## 18. Phase 13 — Empty states

Créer un composant `<EmptyState />`.

```text
Aucune entreprise

Tu n'as encore aucune entreprise dans cette vue.

[Créer une entreprise]
```

> Les empty states doivent être **utiles** et **orientés vers une action**.

---

## 19. Phase 14 — Toasts

Créer `showToast()`.

### Types

- `success`
- `error`
- `warning`
- `info`

### Exemples

- Entreprise créée
- Entreprise modifiée
- Suppression impossible
- Connexion perdue

> ❌ Ne pas utiliser `alert()` pour les interactions normales.

---

## 20. Phase 15 — Formulaires

Créer des composants cohérents :

- Input
- Textarea
- Select
- Combobox
- Date
- Checkbox
- Radio
- File upload

Prévoir :

- Validation
- Erreurs
- Loading
- Disabled
- Success
- Accessibilité

> ❌ Ne pas dupliquer la logique de validation dans chaque page.

---

## 21. Phase 16 — Supabase

❌ Ne pas mettre les appels Supabase directement partout dans le HTML.
✅ Créer des **modules JS**.

```js
async function getEntreprises(filters = {}) {
    const { data, error } = await supabase
        .from('entreprises')
        .select('*');

    if (error) {
        throw error;
    }

    return data;
}
```

Puis :

```text
modules/
└── entreprises/
    ├── entreprises.js
    ├── entreprises.api.js
    ├── entreprises.ui.js
    └── entreprises.html
```

> Adapter à l'architecture existante.

---

## 22. Sécurité Supabase

- ❌ Ne jamais contourner RLS
- ❌ Ne jamais mettre `service_role` dans le frontend
- ✅ Utiliser uniquement la clé publique prévue pour le client
- ✅ Protéger les opérations sensibles par Auth + RLS + éventuellement RPC sécurisées

> Avant toute modification de données, **vérifier les politiques existantes**.

---

## 23. Module Entreprises

**Commencer par ce module.** Il doit devenir la référence pour les autres.

### Fonctions

- Liste
- Recherche
- Filtres
- Vues
- Tri
- Drawer
- Fiche
- Modification
- Création
- Suppression selon permissions
- Contacts liés
- Opportunités
- Formations
- Devis
- Factures
- Activité

> Une fois Entreprises terminé, **réutiliser les composants** pour les autres modules.

---

## 24. Module Contacts

Même architecture :

```text
liste → vue → filtre → drawer → fiche → activité → relations
```

---

## 25. Module Prospects

Prévoir :

```text
Prospect → qualification → opportunité → proposition → client
```

> ⚠️ Ne pas inventer les statuts métier : **rechercher ceux déjà présents** dans Supabase ou dans le CRM actuel.

---

## 26. Module Opportunités

Prévoir :

- Table
- Kanban
- Fiche
- Timeline
- Montant
- Probabilité **si elle existe déjà**
- Date prévue
- Entreprise
- Contact
- Formation
- Devis

> ⚠️ Ne pas inventer de logique commerciale si elle n'existe pas déjà.

---

## 27. Modules Formation

Le CRM doit pouvoir intégrer la spécificité **formation professionnelle**.

Prévoir progressivement :

- Formations
- Sessions
- Stagiaires
- Formateurs
- Entreprises
- Financement
- Devis
- Factures

> ⚠️ Utiliser les tables existantes.
> Ne pas créer une nouvelle structure de données avant d'avoir vérifié le schéma Supabase actuel.

---

## 28. Finance

Prévoir :

- Devis
- Factures
- Paiements
- Relances

Avec :

- Filtres
- Statuts
- Dates
- Montants
- Entreprise
- Formation
- Session

---

## 29. Recherche globale

Créer une recherche globale sur les modules autorisés :

- `ACME`
- `Jean Dupont`
- `Formation Excel`
- `DEV-2026-001`

### Résultats groupés

- Entreprises
- Contacts
- Prospects
- Opportunités
- Formations
- Documents

> Respecter les permissions.

---

## 30. Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl/Cmd + K` | Command Menu |
| `Ctrl/Cmd + /` | Recherche |
| `Escape` | Fermer modal / drawer |
| `N` | Nouvelle création si cohérent |

> ❌ Ne pas imposer des raccourcis qui entrent en conflit avec les champs texte.

---

## 31. Responsive

Le CRM est **prioritairement desktop**. Mais prévoir :

- Desktop
- Tablet
- Mobile

Sur mobile :

- Sidebar transformée en menu
- Tableaux transformés si nécessaire
- Drawers plein écran
- Boutons accessibles
- Pas de débordement horizontal inutile

---

## 32. Performance

### À faire

- Pagination
- Sélection de colonnes
- Lazy loading
- Debounce sur recherche
- Cache simple si pertinent
- Requêtes ciblées

### À éviter

- ❌ Ne pas charger toutes les données au démarrage
- ❌ Éviter `select('*')` si seules quelques colonnes sont nécessaires

---

## 33. Qualité du code

Le code doit respecter :

- Fonctions courtes
- Modules cohérents
- Noms explicites
- Pas de duplication inutile
- Pas de variables globales inutiles
- Pas de `onclick=""`
- `addEventListener`
- `async/await`
- Gestion explicite des erreurs
- Commentaires uniquement lorsqu'ils apportent une information utile

> ❌ Ne pas transformer chaque fichier en framework artisanal.

---

## 34. Règle absolue pour les modifications

À chaque modification :

1. Identifier le problème
2. Identifier le fichier concerné
3. Faire la **plus petite modification fiable**
4. Tester
5. Vérifier les fonctionnalités existantes
6. Seulement ensuite continuer

> ❌ Ne pas réécrire 20 fichiers pour corriger un bouton.

---

## 35. Ordre exact d'exécution

> Claude doit suivre cet ordre **strictement**.

| # | Étape | Livrable |
|---|---|---|
| 1 | Auditer le projet | `AUDIT_CRM.md` — ne rien modifier |
| 2 | Cartographier Supabase | `SUPABASE_SCHEMA.md` — ne rien supprimer |
| 3 | Créer le design system | `tokens.css` `base.css` `components.css` + Lucide |
| 4 | Refondre le shell | Sidebar, Header, Main, Breadcrumb, User menu |
| 5 | Créer Command Menu | — |
| 6 | Créer composants génériques | Button, Input, Select, Badge, Modal, Drawer, Toast, Skeleton, EmptyState, Tabs, Dropdown |
| 7 | Créer composant Table | — |
| 8 | Créer filtres | — |
| 9 | Créer vues sauvegardées | — |
| 10 | Créer Drawer de fiche | — |
| 11 | Créer Record Page | — |
| 12 | Créer Timeline | — |
| 13 | Transformer module Entreprises | — |
| 14 | Utiliser Entreprises comme modèle | Contacts, Prospects, Opportunités |
| 15 | Créer Kanban | — |
| 16 | Créer Calendar | — |
| 17 | Adapter | Formations, Sessions, Stagiaires |
| 18 | Adapter | Devis, Factures, Relances |
| 19 | Créer recherche globale | — |
| 20 | Responsive + accessibilité + performance | — |
| 21 | Audit final | — |

---

## 36. Ce que Claude doit produire après chaque phase

Après chaque phase, fournir :

1. **Fichiers modifiés**
2. **Fichiers créés**
3. **Fonctionnalités ajoutées**
4. **Problèmes rencontrés**
5. **Tests effectués**
6. **Ce qui reste à faire**

> ⚠️ Ne pas prétendre qu'une fonctionnalité fonctionne sans l'avoir vérifiée.

---

## 37. Critères de réussite

### Navigation

- [ ] Sidebar moderne
- [ ] Navigation cohérente
- [ ] Sidebar collapsible
- [ ] Responsive

### Données

- [ ] Supabase reste la source de vérité
- [ ] RLS respectée
- [ ] Aucun secret exposé

### UX

- [ ] Recherche
- [ ] Command Menu
- [ ] Drawers
- [ ] Tables
- [ ] Filtres
- [ ] Vues
- [ ] Fiches
- [ ] Timeline
- [ ] Kanban

### Design

- [ ] Space Grotesk
- [ ] Plus Jakarta Sans
- [ ] Lucide.js
- [ ] Tokens CSS
- [ ] Identité RD
- [ ] Interface sobre
- [ ] Pas de Bootstrap
- [ ] Pas de Tailwind

### Code

- [ ] JavaScript vanilla
- [ ] HTML
- [ ] CSS
- [ ] Modules propres
- [ ] Aucune dépendance inutile

---

## 38. Important : ne pas copier Twenty aveuglément

Twenty est une **source d'inspiration architecturale et UX**.

Le but n'est **pas** :

```text
Twenty + changement de logo
```

Le but est :

```text
UX moderne inspirée de Twenty
+
CRM existant
+
Supabase
+
Lucide
+
métier formation professionnelle
+
identité RD
```

> Le CRM final doit être reconnaissable comme **notre propre application**, pas comme un fork visuel de Twenty.

---

## 39. Première instruction à exécuter maintenant

Commence **UNIQUEMENT** par :

1. Analyser l'intégralité du projet existant
2. Analyser sa structure Supabase disponible
3. Produire un audit détaillé
4. Proposer la structure cible
5. Identifier les fichiers qui devront être modifiés
6. Identifier les fichiers qui peuvent être conservés
7. Identifier les composants qui peuvent être mutualisés
8. Identifier les éventuels problèmes de sécurité
9. Identifier les éventuelles incohérences UX
10. **Attendre** avant de procéder à une refonte massive

### Interdictions strictes pour cette étape

- ❌ Ne supprime rien
- ❌ Ne remplace rien
- ❌ Ne recrée pas le projet
- ❌ Ne migre pas vers React
- ❌ Ne migre pas vers TypeScript
- ❌ Ne change pas Supabase

> Après l'audit, proposer le **Plan Phase 1**, puis exécuter **uniquement cette phase**.

---

## 40. Principe directeur

Le projet doit évoluer de :

```text
CRM fonctionnel
```

vers :

```text
CRM professionnel
        ↓
UX moderne
        ↓
Architecture modulaire
        ↓
Composants réutilisables
        ↓
Views
        ↓
Record pages
        ↓
Command Menu
        ↓
Timeline
        ↓
Automatisation progressive
```

Tout en conservant :

- **HTML**
- **CSS**
- **JavaScript**
- **Supabase**
- **Lucide.js**

> 🎯 **Ne change pas la stack. Améliore l'architecture, l'UX et la maintenabilité.**