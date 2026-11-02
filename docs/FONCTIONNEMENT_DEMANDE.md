# RD Recueil : fonctionnement, de la création de la demande à la signature du devis

Ce document décrit ce que fait l'application et comment une demande avance, étape par étape, depuis sa création jusqu'à la signature de la proposition commerciale (le devis). Il complète `docs/01_ARCHITECTURE.md` (référence technique) et `docs/02_MODELE_RECUEIL_BESOINS.md` (les 187 questions).

Les noms de tables et de fonctions sont donnés avec le préfixe `crm_` de la nouvelle installation (voir `docs/INSTALLATION_SUPABASE.md`).

---

## 1. En bref

RD Recueil est l'outil de RD Formation pour transformer une demande de client (formation, prestation ponctuelle, module, ingénierie, démarche certifiante) en un devis signé, avec une trace complète de l'analyse du besoin.

Il fait quatre choses :

1. **Recueillir le besoin** : le client remplit un questionnaire intelligent de 187 questions, dont seules les parties utiles à sa demande s'affichent. Chaque terme technique est expliqué par une infobulle (glossaire de 134 termes).
2. **Préparer et mener l'entretien** : le client réserve un créneau, le consultant dispose d'un écran d'entretien qui met en tête tout ce qui reste à définir ensemble, puis il consigne son analyse.
3. **Cadrer** : une note de cadrage est générée à partir des réponses, retouchée par le consultant, puis lue et **signée en ligne** par le client.
4. **Chiffrer et conclure** : le consultant prépare une proposition commerciale (devis) pré-remplie depuis la grille tarifaire, l'envoie, et le client l'**accepte avec sa signature** ou la refuse en donnant un motif.

Autour de ce parcours, l'application est aussi un petit CRM : fiches clients et contacts, tâches, montants et pipeline en euros, financements, factures, avis de satisfaction, réclamations, journal d'audit. Ces fonctions servent le parcours (le montant d'une demande, sa probabilité de signature) mais ne sont pas nécessaires pour le suivre.

L'ensemble est une preuve pour la certification Qualiopi (indicateurs 4, 5, 6, 11 et 30 notamment) : analyse du besoin, objectifs reformulés, note signée, horodatage et identité conservés.

---

## 2. Qui fait quoi

| Rôle | Qui | Ce qu'il fait dans le parcours |
|---|---|---|
| **Administrateur** | Rodulfo Dominguez | Tout. Attribue les demandes aux consultants, gère les comptes, publie les versions du questionnaire, voit les indicateurs financiers. |
| **Consultant** | Formateur ou consultant RD Formation | Voit uniquement ses demandes. Crée la demande, invite le client, mène l'entretien, rédige la note de cadrage et le devis. |
| **Client** | Contact invité de l'entreprise cliente | Voit uniquement ses demandes. Répond au questionnaire, choisit son créneau, signe la note de cadrage, accepte ou refuse le devis. Ne voit jamais l'analyse du consultant ni les commentaires internes. |

Les comptes ne se créent pas librement : le consultant invite le client, ce qui crée son compte avec un mot de passe temporaire qu'il devra changer à sa première connexion.

---

## 3. Le parcours en un coup d'œil

```
 CRÉATION            RECUEIL               ENTRETIEN              CADRAGE                    DEVIS
 consultant          client                client + consultant    consultant puis client     consultant puis client

 brouillon ─► envoyee ─► en_saisie ─► soumise ─► entretien_planifie ─► en_analyse ─► cadrage_envoye ─► cadrage_valide ─► proposition_envoyee ─► gagnee
                                          ▲                                          │   │                                                    └─► perdue
                                          │ réouverture                              │   └─► cadrage_a_revoir ─► (nouvelle version) ─► cadrage_envoye
                                          └──────────────────────────────────────────┘
 en_analyse ─► reorientee (le besoin n'est pas un besoin de formation)
 tout statut non final ─► abandonnee
```

Quatorze statuts au total. Quatre sont **finaux** (la demande ne bouge plus) : `gagnee`, `perdue`, `reorientee`, `abandonnee`.

### Feuille de route détaillée

| # | Étape | Statut obtenu | Qui agit | Écran | Ce qui déclenche l'étape suivante |
|---|---|---|---|---|---|
| 1 | Création de la demande | `brouillon` | Consultant | `#/demandes/nouvelle` | Invitation du client |
| 2 | Invitation du client | `envoyee` | Consultant | Vue 360 de la demande | Première réponse du client |
| 3 | Saisie du questionnaire | `en_saisie` (automatique) | Client | `#/d/:ref` | Bouton « Envoyer mes réponses » |
| 4 | Réponses envoyées | `soumise` | Client | `#/d/:ref/recap` | Choix d'un créneau d'entretien |
| 5 | Entretien planifié | `entretien_planifie` | Client | `#/d/:ref/creneaux` | Le consultant passe en analyse |
| 6 | Entretien et analyse | `en_analyse` | Consultant | `#/demandes/:ref/entretien` | Envoi de la note de cadrage |
| 7 | Note de cadrage envoyée | `cadrage_envoye` | Consultant | `#/demandes/:ref/cadrage` | Le client signe ou demande une modification |
| 7b | Modification demandée | `cadrage_a_revoir` | Client | `#/d/:ref/cadrage` | Nouvelle version de la note |
| 8 | Note de cadrage signée | `cadrage_valide` | Client | `#/d/:ref/cadrage` | Envoi de la proposition |
| 9 | Proposition envoyée | `proposition_envoyee` | Consultant | `#/demandes/:ref/proposition` | Décision du client |
| 10 | Devis signé ou refusé | `gagnee` ou `perdue` | Client | `#/d/:ref/proposition` | Fin du parcours |

Toute transition passe par la fonction `crm_rpc_changer_statut`, qui vérifie qu'elle est autorisée et qui l'écrit dans le journal `crm_evenements` (qui, quand, de quel statut vers quel statut, commentaire). Il n'existe aucun moyen de changer un statut directement dans l'application.

---

## 4. Chaque étape en détail

### Étape 1 : créer la demande (consultant)

Le consultant ouvre « Nouvelle demande » et choisit :

- le **client** : une entreprise existante (liste déroulante) ou une nouvelle (raison sociale, SIRET). La recherche par SIRET interroge la base SIRENE et pré-remplit la fiche ; si le SIRET est déjà connu, le client existant est sélectionné au lieu de créer un doublon ;
- les **types de prestation pressentis** parmi les cinq familles : Formation (`FOR`), Prestation ponctuelle (`PON`), Conception de module (`MOD`), Ingénierie (`ING`), Démarche certifiante (`CER`). Ce choix pré-coche la première question du questionnaire ;
- une **date limite** éventuelle.

La demande reçoit automatiquement une **référence** de la forme `RDF-2026-0001`, est attribuée à son créateur (l'administrateur peut la réattribuer) et démarre en `brouillon`. Rien n'est visible du client à ce stade.

### Étape 2 : inviter le client

Depuis la vue 360, le consultant saisit l'e-mail du client. L'application crée son compte (fonction `creer-compte`), lui donne accès à la demande (`crm_demande_acces`) et lui envoie un e-mail avec un mot de passe temporaire. La demande passe en `envoyee`. Un même client peut inviter ou être rejoint par plusieurs contacts sur la même demande.

Si le client ne répond pas, la demande apparaît dans « Sans réponse depuis 7 jours » du tableau de bord, et le consultant peut créer en un clic une tâche de relance (échéance à 3 jours).

### Étape 3 : le client remplit le questionnaire

À sa première connexion, le client change son mot de passe, puis arrive sur son tableau de bord et ouvre sa demande.

**Structure du questionnaire (187 questions)**

| Partie | Contenu | Questions |
|---|---|---|
| Partie 1, « Tronc commun » TC-0 à TC-13 | Cadrage de la demande, structure, interlocuteurs, contexte, analyse du besoin, public, objectifs, contenus, modalités, évaluation, financement et budget, cadre juridique, pilotage, réponse attendue | 116 |
| Partie 2, volets spécifiques | `FOR` (11), `PON` (10), `MOD` (12), `ING` (14), `CER` (11) : n'apparaissent que si le type correspondant est coché en TC-0.01 | 58 |
| Partie 3, `ANA` | Analyse du consultant : **invisible du client** | 13 |

**Comment le questionnaire s'adapte**

- Chaque question a une **condition d'affichage** (par exemple la question sur le dossier de consultation n'apparaît que si le client indique un appel d'offres). Un moteur de conditions décide en direct de ce qui est visible.
- Chaque question dit **qui doit y répondre** : le client (`C`), le consultant (`F`) ou les deux (`C/F`).
- Si le client ne sait pas répondre, il coche **« Je ne sais pas / à définir ensemble »**. Ces points sont comptés comme renseignés pour la progression, et listés automatiquement en tête de l'entretien.
- Les termes techniques marqués d'un astérisque sont expliqués par une **infobulle** tirée du glossaire.
- Les types de champs gèrent la validation (e-mail, SIRET, code postal, montant, date, fichiers PDF/DOCX/XLSX/PPTX/PNG/JPG de 20 Mo maximum).
- La **sauvegarde est automatique** à chaque réponse : le client peut quitter et reprendre. Chaque modification de réponse est historisée dans `crm_reponses_historique`.
- Une **barre de progression** par section montre l'avancement (questions visibles, obligatoires et attribuées au client).

**Règles de qualification**

- Si le client ne sait pas quel type de prestation il cherche (TC-0.01 = « Je ne sais pas »), aucun volet n'est affiché : le consultant qualifiera la demande en entretien (champ `ANA.06`).
- Le type de la demande suit TC-0.01 tant que `ANA.06` n'est pas rempli, puis suit `ANA.06`.

Dès la première réponse, la demande passe seule en `en_saisie`.

### Étape 4 : envoyer les réponses

Sur l'écran récapitulatif, le client voit toutes ses réponses et la liste des questions obligatoires encore vides. Le bouton **« Envoyer mes réponses »** appelle `crm_rpc_soumettre`, qui **refuse l'envoi** s'il reste une question obligatoire sans réponse (une réponse « à définir ensemble » suffit). La demande passe en `soumise`, la date d'envoi est enregistrée, et le consultant et l'administrateur sont notifiés (cloche dans l'application et e-mail).

Le client ne peut plus modifier ses réponses. Le consultant peut **rouvrir la saisie** (retour à `en_saisie`) s'il manque des éléments.

### Étape 5 : planifier l'entretien

Le client choisit un créneau directement sur l'agenda du consultant, via le widget **Cal.com**. Dès que la réservation est confirmée, la fonction `crm_rpc_confirmer_reservation_calcom` enregistre le créneau et passe la demande en `entretien_planifie`. Le client peut ajouter le rendez-vous à Google Agenda ou télécharger un fichier `.ics`. Une seule réservation confirmée est possible par demande. Le consultant est notifié.

### Étape 6 : mener l'entretien et analyser

Le **mode entretien** est un écran conçu pour être utilisé en direct :

1. **En tête** : les questions cochées « à définir ensemble » et les obligatoires vides, c'est-à-dire exactement ce qu'il faut traiter ensemble.
2. **Ensuite** : toutes les questions du consultant (`F` et `C/F`), section par section, avec la réponse du client en lecture et un champ d'annotation.
3. **En fin d'écran** : la partie 3, **Analyse du consultant (ANA)**, avec l'aide QQOQCP à côté des champs de reformulation.

Les 13 champs d'analyse :

| Champ | Contenu |
|---|---|
| ANA.01, ANA.02 | Date et modalité de l'entretien, personnes présentes |
| ANA.03 | Reformulation de la **demande** (ce que le client demande) |
| ANA.04 | Reformulation du **besoin** (ce dont le client a réellement besoin) |
| ANA.05 | Le besoin relève-t-il de la formation ? (Oui, Partiellement, Non à réorienter) |
| ANA.06 | Prestation(s) retenue(s) après analyse |
| ANA.07 | Objectifs pédagogiques reformulés en **3C** (Comportement avec un verbe de Bloom, Conditions, Critères) |
| ANA.08, ANA.09 | Points de vigilance, points restant à clarifier |
| ANA.10, ANA.11 | Estimation de charge (jours) et estimation financière (HT) |
| ANA.12, ANA.13 | **Go / Go sous conditions / No go** et sa justification |

Le consultant passe la demande en `en_analyse` après l'entretien. Si `ANA.05` indique que le besoin ne relève pas de la formation, il peut la passer en **`reorientee`** (statut final) ; la note de cadrage bascule alors sur son bloc de réorientation.

L'estimation financière d'ANA.11 reste une note d'analyse. Le montant suivi dans le pipeline se saisit à part, dans la carte « Enjeu commercial » de la vue 360 (estimation et probabilité), tant qu'aucun devis n'est chiffré.

### Étape 7 : la note de cadrage

**Génération.** Le consultant clique sur « Générer la note ». Le moteur de gabarit prend `docs/04_MODELE_NOTE_DE_CADRAGE.md`, remplace les variables par les réponses, évalue les blocs conditionnels avec le même moteur que le questionnaire, met en tableau les réponses tabulaires, ajoute la liste des points « à définir » et le glossaire des termes utilisés. Le résultat est un document Markdown en `brouillon`, version 1.

**Contenu.** 16 rubriques : contexte, ce que le client a demandé, compréhension du besoin, prestation(s) retenue(s), objectifs, public, périmètre, modalités, évaluation, livrables, pilotage et calendrier, budget et financement, points de vigilance, points à clarifier, décision, validation.

**Retouche.** Le consultant retouche le texte dans un éditeur avec aperçu côte à côte. Chaque version est conservée.

**Envoi.** Le bouton « Envoyer » met la note en `envoyee` et la demande en `cadrage_envoye` ; le client reçoit une notification et un e-mail. La règle métier RM-07 prévoit que `ANA.03`, `ANA.04`, `ANA.05`, `ANA.06`, `ANA.07` et `ANA.12` soient renseignés avant l'envoi ; l'éditeur ne bloque pas aujourd'hui l'envoi si l'un d'eux manque, c'est donc une vérification à faire soi-même.

**Lecture et signature par le client.** Le client lit la note (les termes du glossaire restent en infobulles à l'écran, renvoyés en annexe à l'impression) et peut :

- **Valider et signer** : une fenêtre propose de dessiner sa signature ou de taper son nom, rendu sur un canevas. La fonction `crm_rpc_valider_cadrage` exige une signature, enregistre l'image, la date, l'identité du signataire, son adresse IP et un **code de vérification** généré côté serveur, puis passe la demande en `cadrage_valide`. L'administrateur et le consultant sont notifiés ;
- **Demander une modification** avec un commentaire : la note passe en `a_revoir`, la demande en `cadrage_a_revoir`. Le consultant peut alors soit **créer une nouvelle version** et la renvoyer (retour direct à `cadrage_envoye`), soit **rouvrir la saisie** si ce sont les réponses qui sont en cause.

Une note validée n'est plus modifiable : toute évolution crée une nouvelle version, et seule la dernière version validée fait foi. La note s'exporte en PDF (A4, en-tête avec logo et référence, numéros de page, annexe glossaire).

### Étape 8 : la proposition commerciale (devis)

Elle n'est possible qu'une fois la note signée (`cadrage_valide`). Le consultant ouvre l'éditeur de proposition.

**Pré-remplissage depuis la grille tarifaire.** Un panneau « Pré-remplir depuis la grille tarifaire » reprend la logique du simulateur de devis de RD Formation :

| Type de prestation | Conception | Animation | Suivi | Taux horaire |
|---|---|---|---|---|
| Prestation ponctuelle / conseil | 2 h | 3 h | 0,5 h | 70 € |
| Conception de module | 4 h | 7 h | 1 h | 60 € |
| Formation complète | 10 h | 21 h | 2 h | 55 € |
| Conception e-learning | 16 h | 0 h | 2 h | 65 € |

Le type est suggéré depuis la famille de la demande (FOR et CER vers formation, PON vers prestation ponctuelle, MOD et ING vers module), mais le consultant reste libre. Il règle ensuite :

- le **taux horaire** (modifiable) ;
- le **niveau d'expertise** : coefficient 1 (sujet rodé), 1,25 (préparation technique réelle) ou 1,5 (expertise rare ou sur mesure) ;
- les **frais annexes** : kilomètres et tarif au km, nuitées et forfait par nuitée, regroupés en une ligne.

« Générer les lignes » crée les lignes du devis : conception, animation, suivi (à 80 % du taux) et déplacements.

**Édition.** Chaque ligne a une désignation, une quantité et un prix unitaire ; le total de ligne et le total général se calculent en direct. Le consultant peut ajouter ou retirer des lignes à la main, et rédiger une **justification** (argumentaire, modalités, conditions) en Markdown.

**Mentions.** Le devis imprimable reprend l'identité de l'émetteur (RD Formation, entrepreneur individuel), la référence de la demande, les informations du client tirées de ses réponses, la mention **« TVA non applicable, art. 293 B du CGI »** (franchise de TVA : tous les montants sont HT) et une **validité de 30 jours**. L'export PDF passe par l'impression du navigateur.

**Envoi.** « Envoyer au client » met la proposition en `envoyee` et la demande en `proposition_envoyee` ; le client est notifié par cloche et e-mail. Le montant du devis remplace alors l'estimation dans le pipeline.

### Étape 9 : la décision du client et la signature du devis

Le client ouvre « Ma proposition » : il lit le devis (détail des lignes, total, justification), peut l'imprimer ou le télécharger, puis choisit :

- **Accepter** : la même fenêtre de signature (dessin ou nom tapé) s'ouvre. La fonction `crm_rpc_accepter_proposition` **exige la signature**, enregistre l'image, le **code de vérification** à douze chiffres généré côté serveur, la date et le compte signataire, passe la proposition en `acceptee` et la demande en **`gagnee`**. Le consultant et l'administrateur sont notifiés ;
- **Refuser** : le client indique un motif, la proposition passe en `refusee`, la demande en **`perdue`**, et le motif est conservé et affiché au consultant.

**Valeur de la signature.** C'est une signature électronique **simple** : un tracé graphique associé à l'horodatage, au compte et au code de vérification déjà enregistrés. Ce n'est pas une signature qualifiée au sens du règlement européen eIDAS. Côté RD Formation, la signature est une image fixe, identique sur tous les documents.

### Après la signature

Une demande `gagnee` ouvre le suivi administratif, qui n'est pas bloquant pour le parcours : références de **factures** (émises dans Shine, importables par CSV), **financements** (OPCO, région, reste à charge), puis demande d'**avis de satisfaction** à chaud ou à froid, et éventuelles **réclamations**.

---

## 5. Qui peut déclencher quelle transition

| Depuis | Vers | Déclenchée par |
|---|---|---|
| `brouillon` | `envoyee` | Consultant (invitation du client) |
| `envoyee` | `en_saisie` | Automatique, première réponse du client |
| `en_saisie` | `soumise` | Client (« Envoyer mes réponses »), refusé s'il manque une obligatoire |
| `soumise` | `entretien_planifie` | Client (réservation Cal.com) |
| `soumise` | `en_saisie` | Consultant (réouverture) |
| `entretien_planifie` | `en_analyse` | Consultant |
| `en_analyse` | `cadrage_envoye` | Consultant (envoi de la note) |
| `en_analyse` | `reorientee` | Consultant |
| `cadrage_envoye` | `cadrage_valide` | Client (signature) |
| `cadrage_envoye` | `cadrage_a_revoir` | Client (demande de modification) |
| `cadrage_a_revoir` | `cadrage_envoye` | Consultant (nouvelle version) |
| `cadrage_a_revoir` | `en_saisie` | Consultant (réouverture de la saisie) |
| `cadrage_valide` | `proposition_envoyee` | Consultant (envoi du devis) |
| `proposition_envoyee` | `gagnee` | Client (signature du devis) |
| `proposition_envoyee` | `perdue` | Client (refus motivé) |
| tout statut non final | `abandonnee` | Consultant ou client |

Une transition qui n'est pas dans ce tableau est rejetée par la base, quel que soit l'écran utilisé. Un client ne peut déclencher que celles marquées « Client », et seulement par les fonctions prévues (qui contrôlent les droits).

---

## 6. Suivre l'avancement (la roadmap vue de l'application)

**Côté client**, les 14 statuts sont regroupés en **cinq étapes** lisibles :

| Étape affichée | Statuts regroupés | Prochaine action proposée |
|---|---|---|
| Vos réponses | `brouillon`, `envoyee`, `en_saisie` | « Compléter vos réponses » |
| Entretien | `soumise`, `entretien_planifie`, `en_analyse` | « Choisir un créneau d'entretien », puis attente |
| Note de cadrage | `cadrage_envoye`, `cadrage_a_revoir`, `cadrage_valide` | « Signer la note de cadrage », puis attente |
| Proposition | `proposition_envoyee` | « Répondre à la proposition » |
| Décision | `gagnee`, `perdue`, `reorientee`, `abandonnee` | Aucune |

Le tableau de bord client affiche pour chaque demande l'étape en cours, la prochaine action attendue (avec le lien direct) et un calendrier « Mon planning ». La page **« Mon rapport de projet »** donne les étapes franchies, la durée écoulée, le délai de réponse, le prochain rendez-vous et la chronologie des **jalons** avec le délai entre chacun ; elle s'imprime.

**Les jalons** sont déduits du journal des statuts : demande créée, accès envoyé, début de la saisie, réponses envoyées, entretien planifié, rendez-vous d'entretien, analyse du besoin, note envoyée, note signée, proposition envoyée, proposition acceptée ou refusée, plus la date limite et les tâches. Un retour manuel à un statut antérieur est tracé à part et n'alourdit pas les délais.

**Côté consultant**, le tableau de bord liste ce qui est « À traiter » avec l'action à mener, les demandes sans réponse depuis 7 jours, les échéances proches (alerte à J-5 de la date limite) et propose une vue Kanban des demandes. La **vue 360** d'une demande regroupe les réponses par section, les points à définir, les fichiers, les commentaires internes, le journal, la note, la proposition et les cartes financières.

**Côté administrateur**, la page Indicateurs donne le taux de conversion, les délais moyens par étape (réponse du client, prise de rendez-vous, rédaction et signature de la note, décision sur la proposition, durée totale) et le pipeline.

### Enjeu commercial et probabilité

Chaque demande porte un **montant** et une **probabilité de signature**, tout en HT :

- **Montant retenu** : le total de la proposition s'il est chiffré, sinon l'estimation saisie dans la carte « Enjeu commercial », sinon zéro ;
- **Probabilité par défaut** selon le statut, modifiable demande par demande :

| Statut | % | Statut | % |
|---|---|---|---|
| `brouillon` | 5 | `cadrage_a_revoir` | 50 |
| `envoyee` | 10 | `cadrage_envoye` | 55 |
| `en_saisie` | 15 | `cadrage_valide` | 65 |
| `soumise` | 25 | `proposition_envoyee` | 75 |
| `entretien_planifie` | 35 | `gagnee` | 100 |
| `en_analyse` | 45 | `perdue`, `reorientee`, `abandonnee` | 0 |

- **Montant pondéré** = montant retenu multiplié par la probabilité. Le chiffre d'affaires signé est daté par la réponse du client au devis.

---

## 7. Notifications

Chaque étape importante prévient l'autre partie, dans l'application (cloche) et par e-mail.

| Transition | Qui est prévenu |
|---|---|
| `soumise`, `entretien_planifie`, `cadrage_a_revoir`, `cadrage_valide`, `gagnee`, `perdue` | L'équipe : l'administrateur et le consultant de la demande |
| `cadrage_envoye`, `proposition_envoyee` | Le client |
| `en_analyse`, `reorientee`, `abandonnee` | Personne (décisions internes) |

L'envoi d'e-mail ne bloque jamais l'action : s'il échoue, l'étape est tout de même enregistrée.

---

## 8. Sécurité et traçabilité

- **Cloisonnement** : la sécurité par ligne de la base fait respecter les droits. Un consultant ne voit que ses demandes et ses clients ; un client ne voit que ses demandes ; la partie ANA et les commentaires internes ne sont jamais lisibles par le client (le client lit les réponses par une vue qui retire l'annotation du consultant).
- **Fichiers** : stockés dans un espace privé ; le droit d'accès se déduit de la référence de la demande dans le chemin du fichier.
- **Traçabilité** : chaque changement de statut, chaque réponse modifiée, chaque signature (image, code, date, IP pour la note) et chaque création, modification ou suppression sur les tables du CRM sont journalisés ; le journal d'audit est en ajout seul.
- **RGPD** : charte consultable par le client, consentements des contacts, relecture des fiches sans activité depuis 36 mois.

---

## 9. Limites à connaître

- La signature est une **signature électronique simple**, pas une signature qualifiée eIDAS.
- La vérification des champs obligatoires avant l'envoi de la note de cadrage (RM-07) est une règle documentée, non bloquante dans l'éditeur.
- Pas de relance automatique du client après 7 jours : l'application l'affiche et facilite la tâche de relance, elle ne l'envoie pas (prévu en V2).
- Le devis est un document de proposition : pas de numérotation comptable, pas de facture émise par l'application (les factures restent dans Shine, seule leur référence est conservée).
- L'export « Dossier de preuves » complet en un seul PDF est prévu en V2.
