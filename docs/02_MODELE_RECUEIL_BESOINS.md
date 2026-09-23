# Modèle de recueil des besoins client

> **RD Formation** · Cahier des charges de la demande · Version 1.0
>
> Ce document est la **source de vérité** du questionnaire. Chaque tableau est converti en données par l'application (voir `01_ARCHITECTURE.md`, section 6).
> Les termes suivis d'un astérisque (\*) sont définis dans `03_GLOSSAIRE.md`. La colonne **Glossaire** donne l'identifiant de chaque terme.

## Mode d'emploi

**Colonnes des tableaux**

| Colonne | Signification |
|---|---|
| ID | Identifiant unique et stable de la question. Ne jamais le modifier une fois publié. |
| Question | Libellé affiché. Les termes marqués \* ouvrent une infobulle du glossaire. |
| Type | Type de champ (liste complète dans `01_ARCHITECTURE.md`, section 6.2). |
| Options | Valeurs proposées, séparées par ` ; `. Un code entre crochets `[XXX]` fixe la valeur stockée. |
| Obl. | `O` obligatoire, `N` facultatif. Une question obligatoire masquée par une condition n'est jamais exigée. |
| Par | Qui renseigne : `C` client (avant entretien), `F` formateur ou consultant (pendant ou après l'entretien), `C/F` les deux. |
| Condition | Règle d'affichage. `-` signifie toujours affichée. |
| Glossaire | Identifiants des termes \* utilisés dans la ligne. |

**Règle transversale** : toute question (sauf `oui_non` et les questions d'identification) propose automatiquement une case **« Je ne sais pas / à définir ensemble »**. Cochée, elle crée un point d'entretien pour le formateur.

**Codes de prestation** (utilisés dans les conditions)

| Code | Prestation |
|---|---|
| `FOR` | Formation (inter, intra, individuelle) |
| `PON` | Prestation ponctuelle (conseil, audit, atelier, coaching, accompagnement) |
| `MOD` | Conception d'un module ou d'une ressource pédagogique |
| `ING` | Ingénierie de parcours ou de dispositif |
| `CER` | Démarche certifiante |
| `NSP` | Le client ne sait pas encore : tous les volets restent masqués, la qualification se fait en entretien |

---

# PARTIE 1 · TRONC COMMUN

> Affiché pour toute demande, quel que soit le type de prestation.

## TC-0 · Cadrage de la demande

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-0.01 | Quel(s) type(s) de prestation\* recherchez-vous ? | choix_multiple | [FOR] Formation ; [PON] Prestation ponctuelle (conseil, audit, atelier, coaching) ; [MOD] Conception d'un module ou d'une ressource ; [ING] Ingénierie de parcours ou de dispositif ; [CER] Démarche certifiante ; [NSP] Je ne sais pas encore | O | C | - | prestation |
| TC-0.02 | Décrivez votre demande en quelques phrases, avec vos propres mots. | texte_long | - | O | C | - | - |
| TC-0.03 | À quelle date souhaitez-vous démarrer ? | date | - | N | C | - | - |
| TC-0.04 | Quel est le degré d'urgence ? | choix_unique | Faible ; Modéré ; Élevé ; Impératif (obligation légale ou date butoir) | O | C | - | - |
| TC-0.05 | Comment avez-vous connu RD Formation ? | choix_unique | Recommandation ; Site internet ; Réseaux sociaux ; OPCO\* ; Salon ou événement ; Déjà client ; Autre | N | C | - | opco |
| TC-0.06 | Cette demande s'inscrit-elle dans un appel d'offres\* ou une consultation formelle ? | oui_non | - | O | C | - | appel-offres |
| TC-0.07 | Joignez le dossier de consultation (DCE\*). | fichier | - | N | C | TC-0.06 = oui | dce |

## TC-1 · Identification de la structure

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-1.01 | Raison sociale | texte | - | O | C | - | - |
| TC-1.02 | Forme juridique | choix_unique | SARL ; SAS ; SASU ; EURL ; SA ; Entreprise individuelle ; Association ; Collectivité territoriale ; Établissement public ; Autre | O | C | - | - |
| TC-1.03 | Numéro SIRET\* | siret | - | O | C | - | siret |
| TC-1.04 | Code NAF\* | texte | - | N | C | - | naf |
| TC-1.05 | Secteur d'activité | texte | - | O | C | - | - |
| TC-1.06 | Adresse du siège | adresse | - | O | C | - | - |
| TC-1.07 | Adresse du lieu de réalisation, si différente | adresse | - | N | C | - | - |
| TC-1.08 | Effectif total de la structure | choix_unique | Moins de 11 salariés ; 11 à 49 ; 50 à 249 ; 250 à 999 ; 1 000 et plus | O | C | - | - |
| TC-1.09 | Convention collective (CCN\*) et numéro IDCC\* | texte | - | N | C | - | ccn ; idcc |
| TC-1.10 | OPCO\* de rattachement | choix_unique | AFDAS ; AKTO ; ATLAS ; Constructys ; OCAPIAT ; OPCO 2i ; OPCO Cohésion sociale ; OPCO Commerce ; OPCO EP ; OPCO Mobilités ; OPCO Santé ; Je ne sais pas | O | C | - | opco |
| TC-1.11 | Site internet | url | - | N | C | - | - |
| TC-1.12 | Votre structure est-elle elle-même un organisme de formation (demande de sous-traitance\*) ? | oui_non | - | O | C | - | sous-traitance |
| TC-1.13 | Numéro de déclaration d'activité (NDA\*) | texte | - | O | C | TC-1.12 = oui | nda |
| TC-1.14 | Votre structure est-elle certifiée Qualiopi\* ? | choix_unique | Oui ; Non ; En cours | O | C | TC-1.12 = oui | qualiopi |

## TC-2 · Interlocuteurs

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-2.01 | Commanditaire\* (personne qui décide et signe) | contact | - | O | C | - | commanditaire |
| TC-2.02 | Référent opérationnel du projet (personne qui suit au quotidien) | contact | - | O | C | - | - |
| TC-2.03 | Interlocuteur administratif et financier | contact | - | N | C | - | - |
| TC-2.04 | Référent handicap\* de votre structure, s'il existe | contact | - | N | C | - | referent-handicap |
| TC-2.05 | Experts métier mobilisables pour le projet | tableau_contacts | - | N | C/F | - | - |
| TC-2.06 | Tuteurs\* ou managers des futurs participants | tableau_contacts | - | N | C/F | - | tuteur |
| TC-2.07 | Canal de communication préféré | choix_multiple | E-mail ; Téléphone ; Visioconférence ; Rendez-vous sur site | N | C | - | - |

## TC-3 · Contexte et origine de la demande

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-3.01 | Qu'est-ce qui déclenche cette demande ? | choix_multiple | Projet stratégique ou de développement ; Nouvel outil ou logiciel ; Évolution réglementaire ; Réorganisation interne ; Difficultés constatées ; Recrutement ou intégration ; Reconversion ou mobilité interne ; Suite aux entretiens professionnels\* ; Démarche qualité ou certification ; Autre | O | C | - | entretien-professionnel |
| TC-3.02 | Décrivez le contexte : enjeux, projet en cours, calendrier de votre structure. | texte_long | - | O | C | - | - |
| TC-3.03 | Que se passera-t-il si rien n'est fait ? | texte_long | - | N | C/F | - | - |
| TC-3.04 | Des actions ont-elles déjà été menées sur ce sujet ? | oui_non | - | O | C | - | - |
| TC-3.05 | Lesquelles, et avec quels résultats ? | texte_long | - | O | C | TC-3.04 = oui | - |
| TC-3.06 | D'autres acteurs sont-ils impliqués (prestataires, consultants, institutions) ? | texte_long | - | N | C | - | - |

## TC-4 · Analyse du besoin

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-4.01 | Décrivez les situations de travail\* concernées (tâches, activités concrètes). | texte_long | - | O | C/F | - | situation-travail |
| TC-4.02 | Comment ces situations sont-elles réalisées aujourd'hui ? | texte_long | - | O | C/F | - | - |
| TC-4.03 | Comment devront-elles être réalisées demain ? | texte_long | - | O | C/F | - | - |
| TC-4.04 | Donnez des exemples concrets d'écarts\* constatés (erreurs, retards, difficultés, réclamations). | texte_long | - | O | C/F | - | ecart |
| TC-4.05 | Selon vous, ces écarts proviennent principalement de : | choix_multiple | Un manque de compétences ; Un manque d'information ; L'organisation du travail ; Des outils inadaptés ; La motivation ou l'engagement ; Le management ; Je ne sais pas | O | C/F | - | besoin-formation |
| TC-4.06 | Quelles compétences\* faut-il développer (savoirs, savoir-faire, savoir-être\*) ? | texte_long | - | O | C/F | - | competence ; savoir-etre |
| TC-4.07 | Quels indicateurs\* montreront que la prestation a réussi, pour votre structure ? | texte_long | - | O | C/F | - | indicateur |
| TC-4.08 | Données chiffrées disponibles | tableau | Colonnes : Indicateur ; Valeur actuelle ; Valeur visée ; Échéance | N | C/F | - | indicateur |
| TC-4.09 | Joignez les documents utiles (fiches de poste\*, procédures, comptes rendus, audits). | fichier | - | N | C | - | fiche-poste |

## TC-5 · Public concerné

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-5.01 | Nombre total de personnes concernées | nombre | - | O | C | - | - |
| TC-5.02 | Nombre de groupes envisagés | nombre | - | N | C/F | - | - |
| TC-5.03 | Postes ou métiers concernés | texte_long | - | O | C | - | - |
| TC-5.04 | Statut des participants | choix_multiple | Salariés ; Dirigeants ; Demandeurs d'emploi ; Alternants\* ; Agents publics ; Travailleurs indépendants ; Bénévoles ; Autre | O | C | - | alternant |
| TC-5.05 | Niveau de qualification\* des participants | choix_multiple | Sans diplôme ; Niveau 3 (CAP, BEP) ; Niveau 4 (Bac) ; Niveau 5 (Bac+2) ; Niveau 6 (Bac+3 ou 4) ; Niveau 7 et plus (Bac+5 et plus) ; Hétérogène | O | C | - | niveau-qualification |
| TC-5.06 | Ancienneté moyenne dans le poste | choix_unique | Moins d'un an ; 1 à 3 ans ; 3 à 10 ans ; Plus de 10 ans ; Hétérogène | N | C | - | - |
| TC-5.07 | Niveau actuel des participants sur le sujet | choix_unique | Débutant ; Notions ; Intermédiaire ; Avancé ; Hétérogène | O | C | - | - |
| TC-5.08 | Des prérequis\* sont-ils exigés pour entrer en formation ? | texte_long | - | N | C/F | - | prerequis |
| TC-5.09 | Souhaitez-vous un positionnement\* individuel avant la prestation ? | oui_non | - | O | C/F | - | positionnement |
| TC-5.10 | La participation est-elle : | choix_unique | Volontaire ; Imposée ; Mixte | O | C | - | - |
| TC-5.11 | Aisance des participants avec le numérique | choix_unique | Faible ; Moyenne ; Bonne ; Hétérogène | O | C | - | - |
| TC-5.12 | Maîtrise du français | choix_unique | Langue maternelle ; Courante ; Intermédiaire ; Débutante (besoin FLE\*) ; Hétérogène | O | C | - | fle |
| TC-5.13 | Des participants ont-ils besoin d'une compensation du handicap\* ? | choix_unique | Oui ; Non ; Je ne sais pas | O | C | - | compensation-handicap |
| TC-5.14 | Décrivez les adaptations nécessaires, sans aucune donnée médicale. | texte_long | - | N | C/F | TC-5.13 = oui | compensation-handicap |
| TC-5.15 | Contraintes de disponibilité (horaires, travail posté, saisonnalité, déplacements) | texte_long | - | N | C | - | - |
| TC-5.16 | Attentes ou appréhensions déjà exprimées par les participants | texte_long | - | N | C/F | - | - |

## TC-6 · Objectifs

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-6.01 | Objectif stratégique\* : qu'attend votre structure de cette prestation ? | texte_long | - | O | C | - | objectif-strategique |
| TC-6.02 | Objectifs opérationnels\* : que devront faire les personnes à leur poste ? | texte_long | - | O | C/F | - | objectif-operationnel |
| TC-6.03 | Objectifs pédagogiques\* : à l'issue de la prestation, les participants seront capables de… (actions observables, méthode des 3C\*, verbes de Bloom\*) | texte_long | - | O | F | - | objectif-pedagogique ; 3c ; bloom |
| TC-6.04 | Classez vos objectifs par ordre de priorité. | tableau | Colonnes : Priorité ; Objectif | N | C/F | - | - |
| TC-6.05 | À quels critères\* reconnaîtrez-vous que les objectifs sont atteints ? | texte_long | - | O | C/F | - | critere |

## TC-7 · Contenus et périmètre

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-7.01 | Thèmes attendus | texte_long | - | O | C | - | - |
| TC-7.02 | Thèmes à exclure ou déjà maîtrisés | texte_long | - | N | C | - | - |
| TC-7.03 | Référentiels à respecter | choix_multiple | RNCP\* ; Répertoire spécifique (RS\*) ; REAC\* ; Norme ou réglementation ; Procédures internes ; Aucun | O | C/F | - | rncp ; rs ; reac |
| TC-7.04 | Code ou référence précise du référentiel | texte | - | N | C/F | TC-7.03 contient RNCP OU TC-7.03 contient Répertoire spécifique (RS) OU TC-7.03 contient REAC | rncp ; rs |
| TC-7.05 | Outils ou logiciels métier à intégrer (nom et version) | texte_long | - | N | C | - | - |
| TC-7.06 | Pouvez-vous fournir des documents réels (cas, données anonymisées\*) ? | oui_non | - | N | C | - | donnees-anonymisees |
| TC-7.07 | Joignez ces documents. | fichier | - | N | C | TC-7.06 = oui | - |
| TC-7.08 | Niveau de personnalisation attendu | choix_unique | Catalogue\* ; Adapté (catalogue ajusté à votre contexte) ; Sur-mesure\* | O | C/F | - | catalogue ; sur-mesure |

## TC-8 · Modalités de réalisation

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-8.01 | Modalité souhaitée | choix_multiple | Présentiel ; Distanciel synchrone\* ; Distanciel asynchrone\* (e-learning\*) ; Blended learning\* ; AFEST\* ; Pas de préférence | O | C | - | synchrone ; asynchrone ; e-learning ; blended-learning ; afest |
| TC-8.02 | Format | choix_unique | Intra\* ; Inter\* ; Individuel | O | C | - | intra ; inter |
| TC-8.03 | Durée envisagée (en heures) | nombre | - | N | C/F | - | - |
| TC-8.04 | Rythme | choix_unique | Continu (jours consécutifs) ; Discontinu (par exemple un jour par semaine) ; Sessions courtes (demi-journées ou moins) ; À définir | O | C | - | - |
| TC-8.05 | Période de réalisation | periode | - | O | C | - | - |
| TC-8.06 | Plages horaires possibles | texte | - | N | C | - | - |
| TC-8.07 | Lieu de réalisation | choix_unique | Dans vos locaux ; Chez RD Formation ; Lieu externe ; À distance ; Mixte | O | C | - | - |
| TC-8.08 | Nombre maximum de participants par groupe | nombre | - | N | C/F | - | - |
| TC-8.09 | Méthodes pédagogiques\* souhaitées | choix_multiple | Méthodes actives\* ; Études de cas ; Mises en situation ; Ludopédagogie\* ; Classe inversée\* ; Apports théoriques ; Pas de préférence | N | C/F | - | methodes-pedagogiques ; methodes-actives ; ludopedagogie ; classe-inversee |
| TC-8.10 | Méthodes à éviter (expériences négatives passées) | texte_long | - | N | C | - | - |
| TC-8.11 | Disposez-vous d'une plateforme de formation (LMS\*) ? | oui_non | - | O | C | - | lms |
| TC-8.12 | Laquelle, et quelles normes accepte-t-elle ? | choix_multiple | SCORM\* 1.2 ; SCORM 2004 ; xAPI\* ; Je ne sais pas | N | C/F | TC-8.11 = oui | scorm ; xapi |
| TC-8.13 | Nom de la plateforme | texte | - | N | C | TC-8.11 = oui | lms |
| TC-8.14 | Équipements disponibles pour les participants | choix_multiple | Ordinateur individuel ; Tablette ; Smartphone ; Connexion internet fiable ; Casque et micro ; Salle équipée ; Aucun | O | C | - | - |

## TC-9 · Évaluation

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-9.01 | Quelles évaluations attendez-vous ? | choix_multiple | Positionnement\* ; Évaluation formative\* ; Évaluation sommative\* ; Évaluation certificative\* ; Satisfaction à chaud\* ; Évaluation à froid\* ; Mesure du transfert\* ; Mesure du ROI\* | O | C/F | - | positionnement ; evaluation-formative ; evaluation-sommative ; evaluation-certificative ; evaluation-chaud ; evaluation-froid ; transfert ; roi |
| TC-9.02 | Niveaux du modèle de Kirkpatrick\* visés | choix_multiple | Niveau 1 : Réaction ; Niveau 2 : Apprentissage ; Niveau 3 : Comportement au poste ; Niveau 4 : Résultats pour la structure | N | F | - | kirkpatrick |
| TC-9.03 | Qui observera l'application des acquis au poste de travail ? | texte | - | N | C/F | TC-9.01 contient Mesure du transfert | transfert |
| TC-9.04 | Délai souhaité pour l'évaluation à froid\* | choix_unique | 1 mois ; 3 mois ; 6 mois | N | C/F | TC-9.01 contient Évaluation à froid | evaluation-froid |
| TC-9.05 | Documents de bilan attendus | choix_multiple | Bilan pédagogique collectif ; Synthèse individuelle ; Tableau de bord ; Aucun | N | C | - | - |

## TC-10 · Financement et budget

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-10.01 | Mode de financement envisagé | choix_multiple | Fonds propres ; Autre ; Je ne sais pas | O | C | - | - |
| TC-10.02 | Enveloppe budgétaire envisagée (HT) | choix_unique | Moins de 1 500 € ; 1 500 à 5 000 € ; 5 000 à 15 000 € ; 15 000 à 50 000 € ; Plus de 50 000 € ; Non définie | O | C | - | - |
| TC-10.03 | Une demande de prise en charge\* est-elle déjà en cours ? | oui_non | - | O | C | - | prise-en-charge |
| TC-10.04 | Date limite de dépôt du dossier de financement | date | - | N | C | TC-10.03 = oui | - |
| TC-10.05 | Contraintes de facturation | choix_multiple | Bon de commande obligatoire ; Subrogation\* de paiement ; Paiement échelonné ; Portail de facturation (Chorus Pro, etc.) ; Aucune | N | C | - | subrogation |

## TC-11 · Cadre juridique et contraintes

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-11.01 | Une charte graphique\* doit-elle être respectée ? | oui_non | - | O | C | - | charte-graphique |
| TC-11.02 | Joignez votre charte graphique\*. | fichier | - | N | C | TC-11.01 = oui | charte-graphique |
| TC-11.03 | Un accord de confidentialité\* est-il nécessaire ? | oui_non | - | O | C | - | accord-confidentialite |
| TC-11.04 | La prestation implique-t-elle des données personnelles (RGPD\*) ? | choix_unique | Oui ; Non ; Je ne sais pas | O | C | - | rgpd |
| TC-11.05 | Propriété intellectuelle\* des supports produits | choix_unique | RD Formation reste propriétaire ; Cession de droits\* au client ; Licence d'utilisation\* accordée au client ; À définir ensemble | O | C/F | - | propriete-intellectuelle ; cession-droits ; licence-utilisation |
| TC-11.06 | Vos formateurs internes réutiliseront-ils les supports ? | oui_non | - | N | C | - | - |
| TC-11.07 | Contraintes d'accès au site (badge, EPI\*, habilitation de sécurité) | texte_long | - | N | C | - | epi |
| TC-11.08 | Autres contraintes | texte_long | - | N | C | - | - |

## TC-12 · Pilotage du projet

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-12.01 | Qui valide les livrables\* ? | texte | - | O | C | - | livrable |
| TC-12.02 | Délai de validation par livrable\* (jours ouvrés) | nombre | - | N | C/F | - | livrable |
| TC-12.03 | Nombre d'itérations\* de correction prévues par livrable | choix_unique | 1 ; 2 ; 3 ; À définir | N | C/F | - | iteration |
| TC-12.04 | Un comité de pilotage (COPIL\*) est-il prévu ? | oui_non | - | O | C | - | copil |
| TC-12.05 | Fréquence souhaitée des points de suivi | choix_unique | Hebdomadaire ; Toutes les deux semaines ; Mensuelle ; À chaque jalon\* | N | C | - | jalon |
| TC-12.06 | Jalons\* ou dates imposées | tableau | Colonnes : Jalon ; Date ; Commentaire | N | C/F | - | jalon |
| TC-12.07 | Modalités du bilan de fin de prestation | choix_unique | Réunion de bilan ; Rapport écrit ; Les deux ; Aucun | N | C | - | - |

## TC-13 · Réponse attendue

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| TC-13.01 | Format de proposition souhaité | choix_unique | Devis simple ; Proposition technique et financière\* ; Réponse formelle à l'appel d'offres ; Présentation orale | O | C | - | proposition-technique-financiere |
| TC-13.02 | Date limite de réception de la proposition | date | - | O | C | - | - |
| TC-13.03 | Classez vos critères de choix du prestataire. | classement | Prix ; Expertise métier ; Approche pédagogique ; Délais ; Références ; Proximité géographique ; Certification Qualiopi\* | N | C | - | qualiopi |
| TC-13.04 | D'autres prestataires sont-ils consultés ? | oui_non | - | N | C | - | - |
| TC-13.05 | Commentaires libres | texte_long | - | N | C | - | - |

---

# PARTIE 2 · VOLETS SPÉCIFIQUES

> Chaque volet s'affiche uniquement si le code correspondant est coché en `TC-0.01`. Plusieurs volets peuvent s'afficher pour une même demande.

## V-FOR · Organisation d'une formation

> **Condition de section** : `TC-0.01 contient FOR`

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| FOR.01 | Sessions souhaitées | tableau | Colonnes : Session ; Date de début ; Date de fin ; Nombre de participants | N | C | - | - |
| FOR.02 | Horaires journaliers | texte | - | O | C | - | - |
| FOR.03 | La salle est fournie par : | choix_unique | Votre structure ; RD Formation ; Location externe ; Sans objet (distanciel) | O | C | - | - |
| FOR.04 | Matériel à prévoir | choix_multiple | Vidéoprojecteur ; Paperboard ; Postes informatiques ; Wifi ; Logiciels installés ; Autre | N | C | - | - |
| FOR.05 | Les locaux sont-ils accessibles aux PMR\* ? | choix_unique | Oui ; Non ; Je ne sais pas | O | C | FOR.03 = Votre structure | pmr |
| FOR.06 | Restauration et pauses | choix_unique | Prises en charge par votre structure ; À organiser par RD Formation ; Libres | N | C | - | - |
| FOR.07 | Qui anime ? | choix_unique | Formateur RD Formation ; Formateur interne formé par RD Formation (formation de formateurs\*) ; Co-animation | O | C/F | - | formation-formateurs |
| FOR.08 | Supports remis aux participants | choix_multiple | Papier ; Numérique ; Accès à une plateforme ; Aucun | O | C | - | - |
| FOR.09 | Documents administratifs attendus | choix_multiple | Convention de formation\* ; Programme détaillé ; Convocations ; Feuilles d'émargement\* ; Certificat de réalisation\* ; Attestation de fin de formation\* | O | C/F | - | convention-formation ; emargement ; certificat-realisation ; attestation-fin-formation |
| FOR.10 | Qui envoie les convocations ? | choix_unique | Votre structure ; RD Formation | N | C | - | - |
| FOR.11 | Cette formation sera-t-elle reconduite (sessions récurrentes) ? | oui_non | - | N | C | - | - |

## V-PON · Prestation ponctuelle

> **Condition de section** : `TC-0.01 contient PON`

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| PON.01 | Nature de la prestation | choix_multiple | Conseil\* ; Audit\* ou diagnostic\* ; Animation d'atelier ou de séminaire ; Conférence ; Coaching\* individuel ; Coaching d'équipe ; Accompagnement Qualiopi\* ; Accompagnement de formateurs internes ; Participation à un jury ; Autre | O | C | - | conseil ; audit ; diagnostic ; coaching ; qualiopi |
| PON.02 | Quelle question précise la prestation doit-elle résoudre ? | texte_long | - | O | C/F | - | - |
| PON.03 | Livrable attendu | choix_multiple | Rapport écrit ; Plan d'action\* ; Restitution orale ; Support de présentation ; Grille de diagnostic ; Aucun | O | C | - | plan-action ; livrable |
| PON.04 | Durée estimée | choix_unique | Une demi-journée ; Une journée ; 2 à 5 jours ; Plus de 5 jours ; À définir | O | C/F | - | - |
| PON.05 | Nombre de personnes rencontrées ou participantes | nombre | - | N | C | - | - |
| PON.06 | Les documents et personnes nécessaires seront-ils accessibles ? | oui_non | - | O | C | - | - |
| PON.07 | Type d'audit Qualiopi préparé | choix_unique | Audit initial ; Audit de surveillance ; Audit de renouvellement ; Audit blanc\* | O | C | PON.01 contient Accompagnement Qualiopi | audit-blanc ; qualiopi |
| PON.08 | Date de l'audit prévu | date | - | N | C | PON.01 contient Accompagnement Qualiopi | - |
| PON.09 | Indicateurs Qualiopi\* à travailler en priorité | texte_long | - | N | C/F | PON.01 contient Accompagnement Qualiopi | indicateur-qualiopi |
| PON.10 | Souhaitez-vous un suivi après la prestation ? | choix_unique | Non ; Point à 1 mois ; Point à 3 mois ; Accompagnement continu | N | C | - | - |

## V-MOD · Conception d'un module ou d'une ressource

> **Condition de section** : `TC-0.01 contient MOD`

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| MOD.01 | Format final attendu | choix_multiple | E-learning\* autonome ; Support d'animation présentiel ; Classe virtuelle\* ; Microlearning\* ; Vidéo ; Serious game\* ; Ressource imprimable | O | C | - | e-learning ; classe-virtuelle ; microlearning ; serious-game |
| MOD.02 | Durée visée pour l'apprenant | texte | - | O | C/F | - | - |
| MOD.03 | Niveau d'interactivité\* souhaité | choix_unique | Niveau 1 : consultation ; Niveau 2 : interactions simples ; Niveau 3 : scénarios et simulations ; Niveau 4 : immersion complète | O | C/F | - | niveau-interactivite |
| MOD.04 | Gamification\* | choix_unique | Aucune ; Légère (points, badges) ; Forte (scénario, missions, progression) | N | C/F | - | gamification |
| MOD.05 | Médias attendus | choix_multiple | Texte ; Images ; Infographies ; Vidéo tournée ; Motion design\* ; Audio ou voix off ; Simulation logicielle | N | C | - | motion-design |
| MOD.06 | Qui fournit le contenu expert ? | choix_unique | Votre structure ; RD Formation ; Coproduction | O | C | - | - |
| MOD.07 | Joignez l'existant réutilisable (supports, vidéos, procédures). | fichier | - | N | C | - | - |
| MOD.08 | Livrables attendus | choix_multiple | Scénario pédagogique\* ; Storyboard\* ; Maquette\* ; Support animateur ; Support apprenant ; Activités et exercices ; Banque de questions\* ; Package SCORM\* ; Fichiers sources\* ; Guide de déploiement | O | C/F | - | scenario-pedagogique ; storyboard ; maquette ; banque-questions ; scorm ; fichiers-sources |
| MOD.09 | Contraintes techniques de diffusion (LMS\*, navigateurs, mobile first\*) | texte_long | - | N | C/F | - | lms ; mobile-first |
| MOD.10 | Exigences d'accessibilité numérique\* | choix_multiple | Conformité RGAA\* ; Sous-titres ; Transcriptions ; Non requise | N | C | - | accessibilite-numerique ; rgaa |
| MOD.11 | Langue(s) du module | texte | - | O | C | - | - |
| MOD.12 | Maintenance\* après livraison | choix_unique | Non ; Ponctuelle à la demande ; Contrat annuel | N | C | - | maintenance |

## V-ING · Ingénierie de parcours ou de dispositif

> **Condition de section** : `TC-0.01 contient ING`

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| ING.01 | Nature de l'ingénierie attendue | choix_unique | Ingénierie de formation\* (le dispositif) ; Ingénierie pédagogique\* (les contenus et scénarios) ; Les deux | O | C/F | - | ingenierie-formation ; ingenierie-pedagogique |
| ING.02 | Existe-t-il un référentiel de compétences\* ? | choix_unique | Oui ; Partiel ; Non, à construire | O | C | - | referentiel-competences |
| ING.03 | Existe-t-il un référentiel d'activités\* ou des fiches de poste\* ? | choix_unique | Oui ; Partiel ; Non | O | C | - | referentiel-activites ; fiche-poste |
| ING.04 | Joignez ces référentiels. | fichier | - | N | C | ING.02 = Oui OU ING.02 = Partiel OU ING.03 = Oui OU ING.03 = Partiel | - |
| ING.05 | Volume horaire global envisagé | nombre | - | N | C/F | - | - |
| ING.06 | Niveau de découpage attendu | choix_multiple | Blocs de compétences\* ; Modules\* ; Séquences\* ; Séances\* | O | F | - | bloc-competences ; module ; sequence ; seance |
| ING.07 | Individualisation\* souhaitée | choix_multiple | Positionnement\* d'entrée ; Parcours adaptatif\* ; Allègement de parcours\* ; Aucune | N | C/F | - | individualisation ; positionnement ; parcours-adaptatif ; allegement |
| ING.08 | Le parcours inclut-il de l'alternance\* ? | oui_non | - | O | C | - | alternance |
| ING.09 | Rythme d'alternance et rôle du tuteur\* | texte_long | - | O | C/F | ING.08 = oui | tuteur ; alternance |
| ING.10 | Répartition présentiel / distanciel souhaitée (en %) | texte | - | N | C/F | - | - |
| ING.11 | Nombre de cohortes\* prévues | nombre | - | N | C | - | cohorte |
| ING.12 | Livrables attendus | choix_multiple | Cartographie des compétences\* ; Matrice d'alignement\* ; Architecture du parcours ; Progression pédagogique\* ; Fiches séquences ; Fiches séances ; Grilles d'évaluation\* ; Plan d'évaluation ; Guide du formateur ; Livret apprenant\* ; Dossier de preuves Qualiopi\* | O | C/F | - | cartographie-competences ; matrice-alignement ; progression-pedagogique ; grille-evaluation ; livret-apprenant ; qualiopi |
| ING.13 | Faut-il prévoir une formation de formateurs\* pour les personnes qui déploieront le parcours ? | oui_non | - | N | C | - | formation-formateurs |
| ING.14 | Le dispositif doit-il être transféré en autonomie à vos équipes ? | oui_non | - | N | C | - | - |

## V-CER · Démarche certifiante

> **Condition de section** : `TC-0.01 contient CER`

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| CER.01 | Intitulé de la certification visée | texte | - | O | C | - | - |
| CER.02 | Code RNCP\* ou RS\* | texte | - | N | C/F | - | rncp ; rs |
| CER.03 | Certificateur\* | texte | - | N | C/F | - | certificateur |
| CER.04 | Statut de l'organisme préparant à la certification | choix_unique | Déjà habilité\* ; Habilitation à demander ; Je ne sais pas | O | C/F | - | habilitation |
| CER.05 | Périmètre visé | choix_unique | Certification complète ; Un ou plusieurs blocs de compétences\* ; Je ne sais pas | O | C | - | bloc-competences |
| CER.06 | Lesquels ? | texte_long | - | O | C/F | CER.05 = Un ou plusieurs blocs de compétences | bloc-competences |
| CER.07 | Certains participants visent-ils une VAE\* ? | oui_non | - | N | C | - | vae |
| CER.08 | Modalités d'évaluation imposées par le référentiel | texte_long | - | N | F | - | - |
| CER.09 | Dates de session d'examen connues | tableau | Colonnes : Session ; Date ; Lieu | N | C/F | - | - |
| CER.10 | Préparation aux épreuves attendue | choix_multiple | Dossier professionnel\* ; Oraux blancs ; Mises en situation d'examen ; Préparation complète | N | C | - | dossier-professionnel |
| CER.11 | Taux de réussite visé (%) | nombre | - | N | C | - | - |

---

# PARTIE 3 · ESPACE FORMATEUR (non visible par le client)

## ANA · Analyse du consultant

> Renseigné pendant ou après l'entretien. Alimente directement la note de cadrage\* (`04_MODELE_NOTE_DE_CADRAGE.md`). Section invisible pour le client.

| ID | Question | Type | Options | Obl. | Par | Condition | Glossaire |
|---|---|---|---|---|---|---|---|
| ANA.01 | Date et modalité de l'entretien | texte | - | O | F | - | - |
| ANA.02 | Personnes présentes à l'entretien | texte_long | - | O | F | - | - |
| ANA.03 | Reformulation de la demande (ce que le client demande) | texte_long | - | O | F | - | - |
| ANA.04 | Reformulation du besoin (ce dont le client a réellement besoin) | texte_long | - | O | F | - | besoin-formation |
| ANA.05 | Le besoin relève-t-il de la formation ? | choix_unique | Oui ; Partiellement ; Non (réorienter) | O | F | - | besoin-formation |
| ANA.06 | Prestation(s) retenue(s) après analyse | choix_multiple | [FOR] Formation ; [PON] Prestation ponctuelle ; [MOD] Conception de module ; [ING] Ingénierie ; [CER] Démarche certifiante | O | F | - | prestation |
| ANA.07 | Objectifs pédagogiques reformulés en 3C\* | tableau | Colonnes : Comportement (verbe de Bloom\*) ; Conditions ; Critères | O | F | - | 3c ; bloom |
| ANA.08 | Points de vigilance et risques | texte_long | - | N | F | - | - |
| ANA.09 | Points restant à clarifier | texte_long | - | N | F | - | - |
| ANA.10 | Estimation de charge (jours) | nombre | - | N | F | - | - |
| ANA.11 | Estimation financière (HT) | montant | - | N | F | - | - |
| ANA.12 | Go / No go | choix_unique | Go ; Go sous conditions ; No go | O | F | - | - |
| ANA.13 | Justification | texte_long | - | O | F | - | - |
