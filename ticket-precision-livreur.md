# Ticket — Champ "Précision pour le livreur"

## Contexte
En Côte d'Ivoire, une adresse formelle (rue, coordonnées GPS) ne suffit souvent pas à garantir une livraison réussie. Les repères humains (portail de couleur, commerce voisin, après tel carrefour) sont fréquemment ce qui fait qu'un livreur trouve — ou ne trouve pas — le bon endroit. C'est une donnée que ni Mapbox, ni Google Maps, ni Yandex ne peuvent fournir : elle est propre à chaque livraison et à la connaissance du terrain par le client lui-même.

Ce champ est un **avantage produit potentiellement différenciant** face à Yango, pas un simple détail UX de formulaire.

## Où ça s'intègre dans le flow (à ne pas confondre avec le sélecteur de carte)
Ce champ n'appartient pas à l'écran de sélection d'adresse sur carte (`spec-address-picker-map-v2.md`) — il s'intègre à deux endroits distincts :

1. **Formulaire de commande** (après confirmation de l'adresse) : champ texte libre optionnel, proposé juste après que l'adresse a été confirmée via le sélecteur de carte.
2. **Écran livreur pendant la course** : affichage bien visible de cette précision au moment où le livreur approche du point de livraison — pas noyée dans les détails de la commande.

## Comportement attendu

### Côté client (au moment de la commande)
- Champ texte libre, optionnel, avec placeholder explicite donnant des exemples concrets, par exemple : *"Ex. : portail orange, à côté de la pharmacie, après le carrefour..."*
- Positionné juste sous l'adresse confirmée (rue/quartier), avant la validation finale de la commande.
- Limite de caractères raisonnable (ex. 150 caractères) pour éviter les pavés de texte non lus par le livreur.
- Ne doit jamais être un champ obligatoire — certaines adresses n'en ont pas besoin (immeuble avec numéro clair, par exemple).

### Côté livreur (pendant la course)
- Afficher cette précision de façon proéminente dans l'écran de navigation/course, pas dans un sous-menu ou un détail à déplier.
- Idéalement visible dès que le livreur arrive à proximité du point (ex. dans les derniers 200-300m du trajet), en complément du pin GPS.

### Côté backend
- Stocker ce champ comme une donnée à part entière de la commande (pas fusionné dans `formattedAddress`), pour permettre :
  - de l'afficher séparément côté livreur,
  - de l'analyser plus tard en agrégat (ex. identifier les zones où ce champ est systématiquement rempli, signe d'un besoin de meilleure couverture d'adresse dans cette zone).

## Suggestion de schéma de données
```json
{
  "address": {
    "latitude": 5.359,
    "longitude": -3.986,
    "formattedAddress": "Rue F146, Angré 8e Tranche, Cocody, Abidjan",
    "neighborhood": "Angré 8e Tranche",
    "city": "Abidjan",
    "deliveryNote": "Portail orange, juste après la pharmacie"
  }
}
```

## Priorité
Non bloquant pour le sprint carte en cours (`spec-address-picker-map-v2.md`). À traiter comme ticket séparé une fois le sélecteur d'adresse livré, puisqu'il dépend du flow de commande complet plutôt que de l'écran carte seul.

## Critères de validation
- ✅ Champ visible et optionnel dans le formulaire de commande, après confirmation d'adresse
- ✅ Placeholder avec exemples concrets adaptés au contexte ivoirien
- ✅ Donnée stockée séparément de l'adresse formatée côté backend
- ✅ Affichage proéminent côté écran livreur pendant l'approche du point de livraison
