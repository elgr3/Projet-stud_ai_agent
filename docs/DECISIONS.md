# Décisions du MVP

| Décision | Raison |
| --- | --- |
| Cibler les étudiants qui paient des charges et reçoivent leur argent à plusieurs dates | Faire du reste à dépenser entre deux versements la décision centrale du produit. |
| Livrer une application web mobile en français et en euros | Le pilote est conçu pour des étudiants en France. Un navigateur suffit pour y participer. |
| Saisir manuellement le solde et les opérations | Mettre à l’épreuve la valeur de la prévision avec une prise en main courte et sans accès bancaire. |
| Calculer le budget jusqu’aux premières rentrées prévues ou, en leur absence, jusqu’à la fin du mois | Donner une échéance lisible. Les charges dues le même jour que le versement sont provisionnées par prudence. |
| Conserver les données dans le navigateur, avec export et import JSON | Le pilote se passe de compte utilisateur et de serveur de données. La sauvegarde manuelle protège contre une perte du stockage local. |
| Fournir une démonstration distincte du budget personnel | Permettre de comprendre le produit et d’y revenir sans écraser les données saisies. |
| Maintenir trois rôles d’agents spécialisés et une vérification CI | Le pilote orchestre les interventions, rattache les tests à la livraison et peut réutiliser les profils à chaque évolution. |

## Hypothèse à valider

Auprès d’étudiants qui ont un loyer et des ressources versées en décalé, mesurer sur un cycle de versement s’ils reviennent spontanément consulter le montant disponible, s’ils continuent à saisir leurs opérations et si la prévision change une décision d’achat. Le MVP fonctionne sans compte, synchronisation, connexion bancaire ni télémétrie. Tout résultat d’usage devra être recueilli avec l’accord des participants.

## Exploitation par l’équipe

À chaque demande de maintenance, le pilote précise le résultat attendu, délègue au profil concerné, demande à l’agent de validation de vérifier les parcours touchés et intègre le changement après vérification. En cas de changement du format de sauvegarde, l’équipe fournit une lecture compatible ou une migration testée. La CI exécute les tests à chaque push et pull request. Les profils sont invoqués à la demande dans Codex, et aucune tâche d’agent récurrente n’est hébergée par le MVP.
