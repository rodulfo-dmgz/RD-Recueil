# Modèle de note de cadrage

> **RD Formation** · Restitution de l'analyse de la demande · Version 1.0
>
> Ce gabarit est rempli automatiquement par l'application à partir des réponses du questionnaire.
>
> **Syntaxe des variables**
>
> | Syntaxe | Effet |
> |---|---|
> | `{{TC-1.01}}` | Valeur de la question. Choix multiples joints par des virgules. |
> | `{{TC-1.01 ?? "Non renseigné"}}` | Valeur, ou texte de repli si vide ou « à définir ». |
> | `{{#si TC-0.01 contient FOR}} … {{/si}}` | Bloc affiché uniquement si la condition est vraie (même grammaire que le questionnaire). |
> | `{{#tableau TC-4.08}}` | Rend une réponse de type `tableau` en tableau Markdown. |
> | `{{meta.reference}}`, `{{meta.date}}`, `{{meta.version}}`, `{{meta.redacteur}}` | Métadonnées de la demande. |
> | `{{liste_nsp}}` | Liste automatique des questions cochées « Je ne sais pas / à définir ensemble ». |
>
> Les termes marqués \* restent liés au glossaire dans la version écran ; ils sont renvoyés en annexe dans la version PDF.
>
> **Preuve Qualiopi\*** : la note validée et signée constitue une preuve des indicateurs 4 (analyse du besoin) et 5 (objectifs).

---

<!-- ================= DÉBUT DU GABARIT ================= -->

# Note de cadrage

| | |
|---|---|
| **Référence** | {{meta.reference}} |
| **Client** | {{TC-1.01}} |
| **Commanditaire\*** | {{TC-2.01}} |
| **Référent opérationnel** | {{TC-2.02}} |
| **Rédigée par** | {{meta.redacteur}}, RD Formation |
| **Date** | {{meta.date}} |
| **Version** | {{meta.version}} |
| **Entretien** | {{ANA.01}} |
| **Personnes présentes** | {{ANA.02}} |

## 1. Contexte

**Structure** : {{TC-1.01}}, {{TC-1.02}}, {{TC-1.08}}, secteur {{TC-1.05}}.
**Convention collective** : {{TC-1.09 ?? "À préciser"}} · **OPCO\*** : {{TC-1.10}}

**Origine de la demande** : {{TC-3.01}}

{{TC-3.02}}

**Actions déjà menées** : {{TC-3.05 ?? "Aucune action antérieure signalée."}}

## 2. Ce que vous nous avez demandé

{{ANA.03}}

## 3. Notre compréhension du besoin

{{ANA.04}}

**Situations de travail\* concernées** : {{TC-4.01}}

| Aujourd'hui | Demain |
|---|---|
| {{TC-4.02}} | {{TC-4.03}} |

**Écarts\* constatés** : {{TC-4.04}}

**Le besoin relève-t-il de la formation\* ?** {{ANA.05}}

{{#si ANA.05 = Partiellement}}
> Une partie des écarts relève d'autres leviers (organisation, outils, management). Nous les signalons ci-dessous afin que la prestation porte sur ce qu'elle peut réellement faire évoluer : {{TC-4.05}}
{{/si}}
{{#si ANA.05 = Non (réorienter)}}
> Notre analyse montre que la formation n'est pas la réponse principale. Nous vous proposons une réorientation décrite en section 10.
{{/si}}

**Compétences\* à développer** : {{TC-4.06}}

## 4. Prestation(s) retenue(s)

{{ANA.06}}

{{#si ANA.06 contient FOR}}- **Formation** : animation de l'action décrite ci-dessous.{{/si}}
{{#si ANA.06 contient PON}}- **Prestation ponctuelle** : {{PON.01}}. Question traitée : {{PON.02}}{{/si}}
{{#si ANA.06 contient MOD}}- **Conception de module** : {{MOD.01}}, durée apprenant {{MOD.02}}.{{/si}}
{{#si ANA.06 contient ING}}- **Ingénierie** : {{ING.01}}.{{/si}}
{{#si ANA.06 contient CER}}- **Démarche certifiante** : {{CER.01}} ({{CER.02 ?? "code à confirmer"}}).{{/si}}

## 5. Objectifs

**Objectif stratégique\*** : {{TC-6.01}}

**Objectifs opérationnels\*** : {{TC-6.02}}

**Objectifs pédagogiques\*** (méthode des 3C\*) :

{{#tableau ANA.07}}

**Critères\* de réussite retenus** : {{TC-6.05}}

**Indicateurs\* de suivi pour votre structure** :

{{#tableau TC-4.08}}

## 6. Public

| Élément | Retenu |
|---|---|
| Effectif | {{TC-5.01}} personnes, {{TC-5.02 ?? "nombre de groupes à définir"}} groupe(s) |
| Postes | {{TC-5.03}} |
| Statut | {{TC-5.04}} |
| Niveau de qualification\* | {{TC-5.05}} |
| Niveau sur le sujet | {{TC-5.07}} |
| Prérequis\* | {{TC-5.08 ?? "Aucun prérequis exigé"}} |
| Positionnement\* | {{TC-5.09}} |
| Participation | {{TC-5.10}} |
| Aisance numérique | {{TC-5.11}} |
| Maîtrise du français | {{TC-5.12}} |
| Compensation du handicap\* | {{TC-5.13}} |

{{#si TC-5.13 = Oui}}
> Les adaptations seront définies avec votre référent handicap\* ({{TC-2.04 ?? "à désigner"}}) et le référent handicap de RD Formation avant le démarrage.
{{/si}}

## 7. Périmètre

**Inclus** : {{TC-7.01}}
**Exclu** : {{TC-7.02 ?? "Aucune exclusion signalée."}}
**Référentiels** : {{TC-7.03}} {{TC-7.04}}
**Outils métier** : {{TC-7.05 ?? "Aucun outil spécifique."}}
**Personnalisation** : {{TC-7.08}}

## 8. Modalités

| Élément | Retenu |
|---|---|
| Modalité | {{TC-8.01}} |
| Format | {{TC-8.02}} |
| Durée | {{TC-8.03 ?? "À définir"}} heures |
| Rythme | {{TC-8.04}} |
| Période | {{TC-8.05}} |
| Lieu | {{TC-8.07}} |
| Taille des groupes | {{TC-8.08 ?? "À définir"}} |
| Méthodes pédagogiques\* | {{TC-8.09 ?? "Méthodes actives\* privilégiées"}} |
| Plateforme (LMS\*) | {{TC-8.13 ?? "Aucune"}} {{TC-8.12}} |
| Équipements | {{TC-8.14}} |

{{#si ANA.06 contient FOR}}
### Organisation de la formation
Horaires : {{FOR.02}} · Salle : {{FOR.03}} · Animation : {{FOR.07}} · Supports : {{FOR.08}}
Documents administratifs : {{FOR.09}}

{{#tableau FOR.01}}
{{/si}}

## 9. Évaluation

**Dispositif d'évaluation** : {{TC-9.01}}
**Niveaux de Kirkpatrick\* visés** : {{TC-9.02 ?? "Niveaux 1 et 2 par défaut"}}
{{#si TC-9.01 contient Évaluation à froid}}**Évaluation à froid\*** : à {{TC-9.04}}.{{/si}}
{{#si TC-9.01 contient Mesure du transfert}}**Observation du transfert\*** : {{TC-9.03}}.{{/si}}
**Documents de bilan** : {{TC-9.05}}

## 10. Livrables

{{#si ANA.06 contient PON}}- Prestation ponctuelle : {{PON.03}}{{/si}}
{{#si ANA.06 contient MOD}}- Module : {{MOD.08}}{{/si}}
{{#si ANA.06 contient ING}}- Ingénierie : {{ING.12}}{{/si}}
{{#si ANA.06 contient CER}}- Certification : préparation {{CER.10}}{{/si}}

**Propriété intellectuelle\*** : {{TC-11.05}}

## 11. Pilotage et calendrier

| Élément | Retenu |
|---|---|
| Validation des livrables\* | {{TC-12.01}}, sous {{TC-12.02 ?? "5"}} jours ouvrés |
| Itérations\* incluses | {{TC-12.03 ?? "2"}} par livrable |
| COPIL\* | {{TC-12.04}} |
| Points de suivi | {{TC-12.05}} |
| Bilan final | {{TC-12.07}} |

**Jalons\*** :

{{#tableau TC-12.06}}

## 12. Budget et financement

**Financement envisagé** : {{TC-10.01}}
**Enveloppe indiquée** : {{TC-10.02}}
**Estimation RD Formation** : {{ANA.11 ?? "Communiquée dans la proposition"}} HT, pour {{ANA.10 ?? "…"}} jours de charge.
**Facturation** : {{TC-10.05 ?? "Standard"}}

## 13. Points de vigilance

{{ANA.08 ?? "Aucun point de vigilance identifié."}}

## 14. Points restant à clarifier

{{ANA.09}}

{{liste_nsp}}

## 15. Décision

**Avis RD Formation** : {{ANA.12}}

{{ANA.13}}

## 16. Validation

En signant, le client confirme que cette note reflète fidèlement sa demande et son besoin. Elle sert de référence à la proposition et à la réalisation. Toute modification ultérieure du périmètre fera l'objet d'un avenant.

| Pour le client | Pour RD Formation |
|---|---|
| Nom : {{TC-2.01}} | Nom : {{meta.redacteur}} |
| Date : | Date : |
| Signature : | Signature : |

---

### Annexe · Glossaire des termes utilisés

{{glossaire_utilise}}

<!-- ================= FIN DU GABARIT ================= -->
