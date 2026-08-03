# Application mobile — Gestion Commerciale (Flutter)

Miroir mobile du frontend web : même API backend, même architecture
compte/boutique (§4.1 vs §4.2 du cahier des charges), mêmes rôles.

> ⚠️ **Important** : ce code n'a pas pu être compilé ni exécuté dans
> l'environnement qui l'a généré (accès réseau restreint aux serveurs de
> Google qui hébergent le SDK Dart et les packages pub.dev). Il a été écrit
> avec soin en suivant les conventions Flutter/Dart standard, mais **c'est
> à toi de le compiler en premier** pour repérer d'éventuelles coquilles —
> contrairement au backend/frontend web, aucune de ces briques n'a pu être
> testée de bout en bout au préalable.

## Mise en route — en 2 étapes

### Étape 1 — Générer le squelette natif du projet

Le dossier `android/`, `ios/`, etc. n'est **pas** fourni ici : ce sont des
templates que Flutter génère lui-même correctement, ça n'a aucun sens de
les écrire à la main. Génère-les toi-même :

```bash
flutter create --org com.gestioncommerciale --project-name gestion_commerciale_mobile mobile_scaffold
```

Cela crée un nouveau dossier `mobile_scaffold/` avec toute la structure
native (Android/iOS/Gradle/Info.plist...).

### Étape 2 — Remplacer par le code applicatif fourni

1. Copie `android/`, `ios/`, (et `web/`, `windows/`, etc. si tu en as besoin)
   du dossier `mobile_scaffold/` généré vers ce dossier `mobile/`.
2. Garde le `pubspec.yaml` **de ce dossier-ci** (`mobile/pubspec.yaml`) —
   il contient déjà les bonnes dépendances (go_router, provider, dio,
   flutter_secure_storage, intl). Tu peux fusionner manuellement si
   `flutter create` a ajouté d'autres lignes utiles (ex: `flutter_lints`
   est déjà inclus).
3. Le dossier `lib/` de ce projet remplace celui généré par `flutter create`.

```bash
cd mobile
flutter pub get
flutter run
```

## Configuration de l'URL de l'API

Par défaut, l'app pointe vers `http://10.0.2.2:4000/api/v1` (adresse
spéciale qui, depuis un **émulateur Android**, renvoie vers le `localhost`
de la machine hôte — donc vers ton backend Node qui tourne avec
`npm run dev`).

| Environnement de test | Configuration nécessaire |
|---|---|
| Émulateur Android | Rien à faire, la valeur par défaut fonctionne |
| Simulateur iOS | `flutter run --dart-define=API_BASE_URL=http://localhost:4000/api/v1` |
| Téléphone physique (même Wi-Fi) | `flutter run --dart-define=API_BASE_URL=http://TON_IP_LOCALE:4000/api/v1` (ex: `192.168.1.10`) — et vérifie que le CORS/pare-feu de ta machine autorise cette connexion |

## Structure du projet

```
lib/
├── main.dart                  Point d'entrée : DI + restauration de session
├── app.dart                   MaterialApp.router
├── core/
│   ├── config/app_config.dart      URL de l'API
│   ├── network/api_client.dart     Client HTTP (miroir apiClient.js)
│   ├── network/api_exception.dart  Erreur normalisée (miroir AppError)
│   └── storage/token_storage.dart  Persistance sécurisée de la session
├── state/
│   ├── auth_state.dart         État global (miroir authStore.js Zustand)
│   └── models/                 AppUser, StoreRef
├── routing/
│   ├── app_router.dart         go_router + redirections (miroir des 2 gardes web)
│   └── store_nav_items.dart    Navigation boutique filtrée par rôle
└── features/
    ├── auth/                   Connexion, inscription (compte seul)
    ├── account/                Espace compte : Accueil, Ma Boutique, Profil, Paramètres
    └── store_workspace/        Espace boutique : Tableau de bord, Caisse, Produits...
                                 (écrans placeholder, à implémenter — même état que le web)
```

## Choix d'architecture à connaître

- **Provider** (pas Riverpod) pour l'état global, comme demandé.
- **go_router** avec `redirect` reproduit exactement la logique de
  `ProtectedRoute.jsx` (espace compte : session seule requise) et
  `RequireStoreRoute.jsx` (espace boutique : boutique active requise).
- **Persistance de session** (`flutter_secure_storage`) : contrairement au
  web où la session ne survit qu'en mémoire, une app mobile doit rester
  connectée entre deux ouvertures — comportement standard attendu par les
  utilisateurs, ajouté ici mais absent côté web pour l'instant.
- **Drawer plutôt que bottom bar** pour l'espace boutique : jusqu'à 6
  entrées de menu selon le rôle (Owner), ce qui ne tient pas proprement
  dans une barre de navigation basse standard. L'espace compte (4 entrées
  fixes) utilise lui une `NavigationBar` classique.

## Ce qui reste à faire

- Implémenter les écrans de l'espace boutique (Tableau de bord, Caisse,
  Produits, Stock, Clients, Équipe) — actuellement des placeholders,
  reflet exact de l'état du web à ce stade.
- Modification du profil (nom, mot de passe) — placeholder côté page
  Profil.
- Contenu de la page Paramètres — volontairement laissé de côté (décision
  prise en cours de conversation, à reprendre plus tard).
