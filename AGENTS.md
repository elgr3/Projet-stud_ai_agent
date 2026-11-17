# Cap Étudiant

Le dépôt contient une application web en français pour estimer le reste à dépenser entre deux versements. Utiliser le checkout existant dans Codex Cloud. Node.js 22 ou une version plus récente suffit pour lancer l’application et les tests unitaires.

## Équipe

Le pilote de la tâche découpe le travail et délègue, quand le demandeur autorise l’usage d’agents.

- `budget_engine` maintient le modèle de prévision et ses tests.
- `product_interface` maintient le parcours étudiant et l’interface mobile.
- `quality_reviewer` valide le comportement dans un navigateur et examine l’impact des changements sur les sauvegardes.
- Le pilote intègre, tranche les questions de périmètre, lance la vérification finale et rend compte de la livraison.

Les profils sont sous `.codex/agents/`. Donner à chaque agent un périmètre de fichiers avant de lui demander de modifier le dépôt partagé. Faire relire les changements liés à l’argent, aux dates ou aux sauvegardes par l’agent de validation.

## Vérification

- `npm test`
- `npm start`, puis ouvrir le port 3000.
- `npm run test:browser` avec Chromium et Playwright. Voir [la procédure](docs/VALIDATION.md).

Garder les montants en centimes entiers et les dates de calendrier au format `AAAA-MM-JJ`. Préserver la lecture des sauvegardes utilisateur existantes. Utiliser des données de démonstration pour toute capture et tout test. Documenter les décisions qui affectent l’usage, les données ou la livraison dans [le récapitulatif](docs/DECISIONS.md).
