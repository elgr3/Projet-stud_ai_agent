# Cap Étudiant

Une application web pour répondre à une question simple. **Combien puis-je dépenser avant ma prochaine rentrée d’argent ?**

## Démarrage

Avec Node.js 22 ou une version plus récente, lancez `npm start` à la racine du dépôt et ouvrez `http://localhost:3000`. `PORT` et `HOST` permettent de choisir le port et l’interface d’écoute. Aucun paquet applicatif à installer.

Commencez avec la démonstration ou choisissez « Créer mon budget ». Indiquez le solde disponible au début de la journée choisie, puis ajoutez les charges, les rentrées d’argent et les dépenses réalisées. Les opérations réalisées avant cette date sont conservées dans l’historique et supposées déjà incluses dans le solde de départ. Lorsqu’une charge ou une rentrée est réglée, renseignez la date effective de paiement ou de réception.

Les données restent dans le navigateur utilisé. Téléchargez régulièrement une sauvegarde JSON pour pouvoir restaurer le budget dans un autre navigateur ou après un effacement des données du site. Une importation remplace le budget personnel après confirmation si un budget personnel existe déjà. Le fichier de sauvegarde contient les montants et les libellés en clair.

## Développement et livraison

- `npm test` vérifie le calcul et le format des sauvegardes.
- `npm run test:browser` lance les parcours sur Chromium. Voir [la procédure de validation](docs/VALIDATION.md).
- `npm start` sert les fichiers de l’application. Les fichiers `index.html`, `styles.css`, `app.js`, `budget.js` et `storage.js` peuvent aussi être déployés ensemble sur un hébergeur statique HTTPS.
- Les rôles de l’équipe et les vérifications de maintenance sont décrits dans [AGENTS.md](AGENTS.md).
- Les choix du MVP et les limites du pilote sont dans [le récapitulatif des décisions](docs/DECISIONS.md).
