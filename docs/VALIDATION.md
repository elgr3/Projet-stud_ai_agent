# Validation de Cap Étudiant

L’agent chargé de la validation lance les tests depuis la racine du dépôt sur la version candidate et joint les résultats à la livraison. Les cas utilisent des montants fictifs.

## Tests automatiques

```sh
npm test
npm run test:browser
```

La suite Node.js teste les règles de calcul. La suite navigateur lance le serveur sur un port local temporaire et ferme les processus qu’elle a lancés. Elle utilise Chromium et un contexte neuf pour chaque scénario.

Dans l’environnement Codex de développement, Playwright et Chromium sont disponibles. Sur une autre machine, installe Playwright comme outil de test local si nécessaire.

```sh
npm install --no-save --package-lock=false playwright@1.58.2
npx playwright install chromium
npm run test:browser
```

Le test cherche Chromium dans le cache Playwright, puis dans `/usr/bin/chromium`. Définis `CAP_CHROMIUM_PATH` pour utiliser un autre exécutable compatible.

## Parcours couverts

| Parcours | Attendu |
|---|---|
| Démo et création du budget | La démo contient des opérations d’exemple. Le budget personnel démarre avec le solde saisi. |
| Prévision avant la bourse | Un solde de 220 € et un loyer de 180 € laissent 40 € avant le versement prévu. Le loyer et la bourse apparaissent dans les échéances. Les hauteurs du graphique reflètent les soldes. |
| Dépense et statut | Une dépense payée de 15,50 € ramène le reste à 24,50 €. La correction à 20 € ramène le reste à 20 €. |
| Filtre et suppression | Le filtre affiche les dépenses. Une fois la dépense supprimée, le reste revient à 40 €. |
| Sauvegarde | Le reste survit au rechargement. Le fichier exporté restaure les opérations et le calcul. Un fichier d’un autre format est rejeté. |
| Onglets et mode démo | L’ajout depuis un second onglet et la suppression depuis le premier se répercutent dans les deux. Revenir de la démo retrouve les opérations personnelles. |
| Risque de découvert | Une charge supplémentaire de 35 € fait tomber le reste à 0 € et affiche un manque prévu de 15 €. |
| Mobile et clavier | À 390 px, le budget et une dépense sont saisissables. Le contenu tient dans la largeur et Échap ferme la fenêtre de saisie. |
| Requêtes et erreurs | Les scénarios surveillent les erreurs JavaScript non interceptées et les requêtes HTTP vers des sites externes. |

La version initiale a passé 12 tests Node.js et les deux parcours navigateur avec Playwright 1.58.2 et Chromium 156 dans Codex Cloud. Le contexte mobile est une émulation Chromium. Safari sur iPhone, Chrome sur Android avec clavier natif et la navigation au lecteur d’écran restent des vérifications à effectuer sur appareil avant d’élargir le pilote.
