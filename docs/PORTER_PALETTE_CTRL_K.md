# Porter la recherche globale « Ctrl+K » (modale centrée) dans un autre projet

Document destiné à **Claude Code**, à lire en entier avant de toucher au code du projet cible.

## Objectif

Ajouter au projet cible un **menu de commandes** ouvert par `Ctrl+K` (`Cmd+K` sur Mac), affiché dans une **modale au milieu de l'écran**, qui permet de :

- aller à une page de l'application ;
- lancer une action (changer de thème, se déconnecter, créer un élément...) ;
- **chercher dans les données** (ici : clients, contacts, demandes, factures) avec une recherche qui ignore accents et casse.

Navigation entièrement au clavier : `↑` `↓` pour choisir, `Entrée` pour valider, `Échap` pour fermer. Fenêtre accessible (rôle `dialog`, `combobox`, `listbox`).

L'implémentation de référence existe déjà dans le projet **RD Recueil**, sur le même ordinateur :

```
C:\Users\Rodul\Desktop\Cahier_charges\App_cahier\
```

Tous les chemins ci-dessous sont relatifs à ce dossier. **Lire les fichiers sources avant de les adapter** : ce document dit quoi copier et où regarder, pas le code complet.

---

## 1. Fichiers à copier (et à lire)

| Rôle | Fichier de référence | À faire dans le projet cible |
|---|---|---|
| **Interface de la modale** (raccourci clavier, ouverture, liste, navigation, accessibilité) | `app/js/components/palette-commandes.js` (187 lignes) | Copier, puis adapter les imports et les libellés. |
| **Filtre des commandes** (pages et actions, par mots tapés, sans accents) | `app/js/engine/commandes.js` (20 lignes, fonction pure) | Copier tel quel. |
| **Normalisation de texte** (accents, casse, ponctuation) | `app/js/engine/texte.js` (30 lignes, fonctions pures) | Copier tel quel (ou fusionner avec un utilitaire équivalent déjà présent). |
| **Moteur de recherche dans les données** (notes, groupes, limites) | `app/js/engine/recherche.js` (105 lignes, fonction pure) | **Réécrire la partie métier** : groupes, champs cherchés, liens (voir 3). |
| **Chargement des données** (pagination, cache d'une minute, invalidation) | `app/js/services/recherche.js` (50 lignes) | **Réécrire** pour les tables du projet cible (voir 3). |
| **Assistants DOM** `el()` et `icone()` | `app/js/components/dashboard-ui.js`, lignes 5 à 17 | Reprendre ces deux fonctions (ou utiliser celles du projet cible). |
| **Styles de la modale** | `app/css/allure.css`, lignes 235 à 251 (bloc « Menu de commandes Ctrl+K ») | Copier, puis recaler sur les variables du projet cible (voir 4). |
| **Branchement dans l'en-tête** | `app/js/components/entete.js`, lignes 11 et 409 à 428 (`configurerPalette(...)`) | S'en inspirer (voir 5). |
| **Tests** | `tests/commandes.test.mjs`, `tests/recherche.test.mjs` (`node:test`) | Copier et adapter aux données du projet cible. |

Facultatif, seulement si le projet cible veut aussi un champ de recherche dans sa barre du haut (en plus de `Ctrl+K`) : `app/js/components/recherche-globale.js` (190 lignes) et les styles `.recherche-globale*` de `app/css/crm.css` (lignes 25 à 38). Ce n'est pas nécessaire pour la modale.

Dépendance cachée à connaître : `engine/recherche.js` importe `nomComplet` depuis `app/js/engine/fiche-client.js` (assemble prénom + nom). Soit recréer ce petit utilitaire, soit l'inliner.

---

## 2. Prérequis dans le projet cible

Le code de référence suppose :

- **JavaScript natif en modules ES**, sans framework ni bundler. Si le projet cible utilise React, Vue ou autre, **garder la logique pure** (`commandes.js`, `texte.js`, `recherche.js`, `services/recherche.js`) et ne réécrire que `palette-commandes.js` en composant.
- **Routage par hash** : l'ouverture d'un résultat fait `window.location.hash = href` (valeurs comme `#/clients/42`). Si le projet cible a un autre routeur, remplacer cette ligne dans `lancer()` par l'appel de navigation du projet.
- **Icônes Lucide** chargées globalement (`window.lucide.createIcons()`), via des éléments `<i data-lucide="...">`. Sinon, adapter `icone()` ou retirer les icônes.
- **Variables CSS** de thème : `--surface`, `--texte`, `--texte-doux`, `--bordure`, `--fond`, `--rd-bleu` (accent). Voir 4.
- Un client **Supabase** (`import { supabase } from '../supabase.js'`) dans `services/recherche.js`. Si le projet cible a une autre source de données, ne changer que ce fichier.

Avant de commencer, repérer dans le projet cible : le point d'entrée JS, l'en-tête (ou la mise en page principale), la feuille de styles globale et l'endroit où vit le routeur.

---

## 3. Adapter les données et la recherche

### 3.1 Définir ce qui se cherche

Dans `engine/recherche.js`, chaque **groupe** de résultats est décrit ainsi :

```js
{
  id,        // identifiant de l'élément
  titre,     // ligne principale affichée
  detail,    // ligne secondaire, en gris
  href,      // où aller (route du projet cible)
  note: noterElement([champs texte...], [champs numeros...], terme),
}
```

À faire :

1. Lister les entités du projet cible à rendre cherchables (par exemple produits, commandes, utilisateurs).
2. Pour chacune : les champs texte à comparer, les éventuels champs numériques (téléphone, référence : comparés en chiffres seuls dès 3 chiffres), le titre, le détail et la route de destination.
3. Remplacer dans `rechercher()` les quatre blocs `resultatsClients`, `resultatsContacts`, `resultatsDemandes`, `resultatsFactures`, l'objet `TITRES` et la liste `groupes`.

À ne **pas** changer, ce sont les règles qui font la qualité de la recherche :

- terme de **2 caractères minimum** (`LONGUEUR_MIN_RECHERCHE`) ;
- **notation** : 100 identique, 80 commence par le terme, 60 un mot commence par le terme, 40 le contient ;
- plusieurs mots tapés : **tous** doivent se retrouver, la note est la plus faible des notes de mot ;
- **5 résultats par groupe** dans la page de recherche, **4** dans la modale (`{ limite: 4 }`) ;
- tri par note décroissante puis ordre alphabétique français.

### 3.2 Charger les données

Dans `services/recherche.js` :

- remplacer les requêtes de `charger()` par celles du projet cible, en ne sélectionnant que les colonnes utiles à la recherche ;
- **garder** `toutCharger()` : la base renvoie au plus 1 000 lignes par requête, la fonction enchaîne les pages ; le `.order('id')` rend la pagination stable ;
- **garder** le cache d'une minute et l'export `invaliderRecherche()` à appeler après toute création, modification ou suppression ;
- la recherche se fait **dans le navigateur** sur ces listes ; la base ne renvoie déjà que ce que l'utilisateur a le droit de voir (sécurité par ligne). Ne pas contourner ça avec une clé de service.

Si les volumes dépassent quelques milliers de lignes par table, ne pas charger toute la table : passer à une recherche côté serveur (fonction SQL ou `ilike`) et ne garder que la couche d'affichage.

---

## 4. Style : la modale au milieu de l'écran

Structure DOM produite par `palette-commandes.js` :

```
div.palette-fond                 (fond assombri, plein écran, ferme au clic)
  div.palette[role=dialog]
    input.palette__champ         (champ de saisie)
    div.palette__liste           (résultats, défilement interne)
      div.palette__groupe
        p.palette__titre
        div.palette__item        (une ligne : icône, libellé, détail)
    p.palette__pied              (rappel des touches)
```

Le fichier de référence place la boîte à `top: 12vh` (centrée horizontalement, proche du haut, comme Spotlight). Pour une modale **réellement centrée au milieu de l'écran**, utiliser ceci dans le projet cible (hauteur fixe pour que la fenêtre ne saute pas quand le nombre de résultats change) :

```css
.palette-fond {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: center;          /* centre horizontal et vertical */
  padding: 16px;
  background: rgba(15, 23, 42, .3);
}
.palette {
  display: flex; flex-direction: column;
  width: min(640px, 100%);
  height: min(520px, 70vh);                     /* hauteur stable */
  overflow: hidden;
  border: 1px solid var(--bordure);
  border-radius: 12px;
  background: var(--surface); color: var(--texte);
  box-shadow: 0 16px 48px rgba(15, 23, 42, .25);
}
@media (prefers-reduced-motion: no-preference) {
  .palette { animation: palette-entree .12s ease-out; }
}
@keyframes palette-entree { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }
```

Dans la version de référence, `.palette` est en `position: absolute; left: 50%; transform: translateX(-50%)` : **supprimer** ces trois propriétés et l'animation `translateX` quand on passe à `display: grid; place-items: center` sur le fond, sinon la boîte sera décalée.

Le reste des styles (`.palette__champ`, `.palette__liste`, `.palette__titre`, `.palette__item`, `.palette__item--actif`, `.palette__message`, `.palette__pied`) se copie depuis `app/css/allure.css`, lignes 240 à 251, sans changement de structure. Les remplacer par les variables du projet cible si les noms diffèrent (`--surface`, `--texte`, `--texte-doux`, `--bordure`, `--fond`, et `--rd-bleu` pour la barre d'accent à gauche de l'élément actif).

Contraintes à respecter (elles viennent du projet de référence) :

- cibles tactiles d'au moins **40 px** de haut (`min-height: 40px` sur `.palette__item`), champ de **56 px** ;
- police du champ à **16 px** minimum (évite le zoom automatique sur iPhone) ;
- contraste suffisant en **thème clair et sombre** : tester les deux ;
- respect de `prefers-reduced-motion` (déjà prévu).

---

## 5. Brancher le menu

### 5.1 Le raccourci

`palette-commandes.js` installe **une seule écoute** `keydown` pour toute la session (garde `window.__paletteRaccourciAttache`), parce que l'en-tête de l'application de référence est recréé à chaque navigation. Elle :

- réagit à `Ctrl+K` ou `Cmd+K` (et pas `Alt`) ;
- ne fait rien si le menu n'est pas configuré ;
- ouvre le menu, ou le ferme s'il est déjà ouvert.

### 5.2 La configuration

Le menu ne s'ouvre que si `configurerPalette(...)` a été appelée. Appeler cette fonction **au même endroit que l'en-tête ou la barre latérale**, à chaque rendu, avec :

```js
configurerPalette({
  liens: [ { href: '#/accueil', icone: 'home', libelle: 'Accueil' }, /* ... */ ],   // groupe « Aller à »
  admin: false,                                                                     // true : charge aussi les données réservées à l'admin
  actions: [                                                                        // groupe « Actions »
    { id: 'action:nouveau', libelle: 'Nouveau client', icone: 'plus', mots: 'creer ajouter', href: '#/clients/nouveau' },
    { id: 'action:theme', libelle: 'Changer de thème', icone: 'moon', mots: 'sombre clair dark', executer: () => document.querySelector('[data-theme-toggle]')?.click() },
  ],
});
```

- `liens` : reprendre les entrées du menu de navigation du projet cible (le projet de référence les déduit de sa barre latérale par `aplatir(liens)`).
- `actions` : `href` pour naviguer, `executer` pour lancer une fonction. `mots` : synonymes sans accents qui font retrouver l'action (« creer » trouve « Nouveau... »).
- Pour **désactiver** le menu pour certains rôles (le projet de référence le coupe pour les clients), passer `null` : le raccourci ne fait alors rien.

### 5.3 Les libellés

Le projet de référence est en français (vouvoiement, phrases courtes, sans tiret cadratin). Garder la langue du projet cible. Chaînes à traduire ou adapter dans `palette-commandes.js` : placeholder du champ, `aria-label`, pied de fenêtre, groupes « Aller à » et « Actions », messages de chargement, d'erreur et « Aucun résultat ».

---

## 6. Comportements à conserver

À vérifier un par un dans le projet cible :

1. `Ctrl+K` ouvre, un second `Ctrl+K` ferme ; `Échap` ferme ; un clic sur le fond assombri ferme.
2. Le focus va dans le champ à l'ouverture et **revient sur l'élément précédent** à la fermeture.
3. `Tab` ne sort pas du champ (le focus reste dans la fenêtre).
4. `↑` `↓` bouclent sur les résultats ; `Entrée` ouvre l'élément actif ; la souris active l'élément survolé.
5. À l'ouverture, **sans rien taper**, la liste montre les pages et les actions. Taper filtre pages et actions immédiatement, et ajoute les résultats de données dès 2 caractères.
6. Pendant le chargement des données, un message « Chargement... » s'affiche ; en cas d'échec, un message d'erreur : la liste des pages reste utilisable.
7. Accessibilité : `role="dialog"` + `aria-modal`, champ `role="combobox"` avec `aria-controls`, `aria-activedescendant` mis à jour, éléments `role="option"` avec `aria-selected`.
8. Le raccourci n'interfère pas avec un `Ctrl+K` du navigateur ou d'un éditeur du projet cible : tester sur une page avec un éditeur de texte si le projet en a un.

---

## 7. Tests

Copier `tests/commandes.test.mjs` et `tests/recherche.test.mjs` (format `node:test`, lancés par `node --test tests/`) et :

- garder les cas de `commandes.test.mjs` (filtre par mots, accents, synonymes, tri) tels quels ;
- réécrire les jeux de données de `recherche.test.mjs` avec les entités du projet cible, en gardant les cas : terme trop court, accents et casse, plusieurs mots, recherche par numéro, limite par groupe, tri par pertinence ;
- ajouter un test qui vérifie que **chaque route** produite par `rechercher()` et listée dans `liens` existe dans le routeur du projet cible.

Vérification finale en navigateur (375 px et 1440 px de large, thèmes clair et sombre) : ouverture au raccourci, centrage de la modale, saisie, navigation clavier, clic sur un résultat, fermeture.

---

## 8. Plan de travail conseillé

1. Lire les 5 fichiers de référence (section 1) et repérer en face les équivalents dans le projet cible.
2. Copier `engine/commandes.js` et `engine/texte.js` ; copier leurs tests ; les lancer.
3. Adapter `engine/recherche.js` et ses tests aux entités du projet ; les lancer.
4. Adapter `services/recherche.js` (requêtes, colonnes, cache).
5. Copier `components/palette-commandes.js`, `el()` et `icone()` ; corriger les imports.
6. Ajouter les styles (section 4) à la feuille globale.
7. Appeler `configurerPalette(...)` depuis l'en-tête ou la mise en page (section 5).
8. Vérifier en navigateur (section 6) et lancer toute la suite de tests.

Ne rien inventer en plus : pas de bibliothèque tierce (le menu de référence est en JavaScript natif), pas de recherche floue, pas d'historique de recherche. Si une de ces fonctions est utile, la proposer à part.
