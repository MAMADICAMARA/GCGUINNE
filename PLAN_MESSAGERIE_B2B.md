# Messagerie B2B (Owner ↔ Employé, Owner ↔ Fournisseur, Owner ↔ Supervisé)

## Contexte

Décidé en conversation, après analyse approfondie : Fournisseurs et Superviser sont aujourd'hui à sens unique (on consulte, on ne peut pas échanger). Une messagerie comble ce trou pour trois relations qui existent déjà dans le schéma :
- **Owner ↔ Employé** (même boutique, `user_store`) — bidirectionnel, les deux côtés peuvent écrire.
- **Owner ↔ Fournisseur** (`store_supplier_links`) — entre deux propriétaires de boutiques différentes.
- **Owner ↔ Supervisé** (`store_supervisors`) — entre deux propriétaires, l'un supervisant l'autre.

Réservée aux plans **STANDARD et PREMIUM** (comme Superviser/Fournisseurs), jamais FREEMIUM.

Explicitement **hors périmètre** (décidé en conversation) : la messagerie client↔marchand façon Alibaba/AliExpress, qui suppose des comptes clients réels et une vitrine publique — aucun des deux n'existe aujourd'hui. Ce chantier ne construit que le B2B, mais avec un nommage générique ("messagerie", pas "messagerie d'équipe") pour ne pas fermer la porte à un futur troisième type d'acteur sans tout reconstruire.

## Principe d'architecture central

**Jamais de recherche par téléphone/e-mail/ID de boutique.** Ces trois options ont été explicitement écartées : le numéro de boutique brut est énumérable (même problème déjà résolu par `supervision_code`/`supplier_code`), et une recherche par téléphone/e-mail créerait un annuaire permettant de sonder qui est sur la plateforme. À la place : **aucune saisie d'identifiant** — un bouton "Écrire" est ajouté directement sur les listes déjà affichées (Équipe, Fournisseurs, Superviser), qui contiennent déjà les noms des personnes autorisées. L'autorisation de démarrer une conversation découle uniquement d'un lien déjà établi (`user_store`, `store_supplier_links`, `store_supervisors`) — jamais d'un identifiant tapé à la main.

**Un seul modèle générique, pas trois messageries séparées.** Les trois relations connectent toujours deux `users.id` (l'Owner d'une boutique est un compte utilisateur comme un autre) — une seule table `conversations` + `messages` suffit ; seule la vérification d'autorisation (`canConverse`) varie selon laquelle des trois relations existe entre les deux personnes.

**Le plan se vérifie à l'envoi, jamais à la lecture.** Cohérent avec le principe déjà appliqué partout ailleurs (suspendre une boutique ne supprime jamais rien) : l'historique d'une conversation reste toujours lisible, même si l'abonnement d'une des deux parties retombe en FREEMIUM depuis. Seul l'envoi d'un nouveau message est bloqué — même logique que `getSupplierCatalog` qui vérifie déjà le plan du fournisseur en plus de celui de l'acheteur (`suppliers.service.js`). Pour la messagerie, **les deux côtés** doivent avoir un plan qui l'autorise pour qu'un envoi passe.

## Étapes (à valider une par une, testées au fur et à mesure)

### Étape 1 — Fondations schéma
Nouvelle migration `backend/database/22_messagerie.sql` :
- `subscription_plans` : ajout de `allows_messaging BOOLEAN NOT NULL DEFAULT FALSE` (FREEMIUM `false`, STANDARD/PREMIUM `true`), même pattern que `allows_supervision`/`allows_suppliers`.
- `conversations` : `id`, `user_a_id`/`user_b_id` (INTEGER REFERENCES users), `created_at`. Ordre canonique imposé par un `CHECK (user_a_id < user_b_id)` + `UNIQUE (user_a_id, user_b_id)` — une seule conversation possible entre deux personnes, jamais de doublon selon qui initie.
- `messages` : `id`, `conversation_id` REFERENCES conversations, `sender_id` REFERENCES users, `body TEXT NOT NULL CHECK (length(trim(body)) > 0)`, `created_at`, `read_at` (nullable — badge non-lu).
- Index sur `conversations(user_a_id)`, `conversations(user_b_id)` (boîte de réception), `messages(conversation_id, created_at)` (fil ordonné).
Appliquée directement sur la base locale, vérifiée par `\d`.

### Étape 2 — Backend : autorisation + envoi/lecture des messages
- `backend/src/utils/planContext.js` : nouvelle fonction `getEffectivePlanForUser(userId)` — résout la boutique pertinente de N'IMPORTE QUEL utilisateur (celle qu'il possède via `owner_id`, sinon celle où il est rattaché via `user_store`), puis délègue à `getEffectivePlan` déjà existant. Généralise `getEffectivePlanForOwnedStore` (déjà là, utilisée par Superviser) pour couvrir aussi les employés.
- Nouveau module `backend/src/modules/messages/` :
  - `canConverse(userAId, userBId)` — vrai si (a) même `store_id` dans `user_store` pour les deux, ou (b) les boutiques respectivement possédées sont liées via `store_supplier_links` (dans un sens ou l'autre), ou (c) liées via `store_supervisors`.
  - `getOrCreateConversation(userAId, userBId)` — normalise l'ordre, vérifie `canConverse`, réutilise la conversation existante sinon la crée.
  - `listConversations(userId)`, `listMessages(conversationId, userId)` (marque `read_at` au passage), `sendMessage(conversationId, senderId, body)` — vérifie `getEffectivePlanForUser` des DEUX participants (`allowsMessaging`), sinon 403 `PLAN_FEATURE_LOCKED` (même code déjà utilisé par `requirePlanFeature`).
- Routes (`requireAuth, requireActiveStore`, cohérent avec le reste du projet) :
  `GET /messages`, `GET /messages/unread-count`, `POST /messages/start` (accepte `targetUserId` OU `targetStoreId` — ce dernier résolu côté serveur vers `owner_id`, pour ne rien changer aux réponses existantes de `suppliers`/`supervision`), `GET /messages/:id`, `POST /messages/:id`.
Testé via API (comptes de test existants) : conversation refusée entre deux inconnus, acceptée entre Owner/Employé et Owner/Fournisseur liés, envoi bloqué si un des deux camps est FREEMIUM, lecture de l'historique toujours possible malgré le blocage.

### Étape 3 — Points d'entrée "Écrire" sur les pages existantes
Backend déjà prêt (étape 2) ; ici on branche le frontend :
- `frontend/src/pages/employees/EmployeesPage.jsx` — bouton "Écrire" par ligne d'employé (`targetUserId` déjà connu).
- `frontend/src/pages/suppliers/SuppliersPage.jsx` — bouton "Écrire" sur chaque carte fournisseur ET chaque ligne client (`targetStoreId` déjà connu).
- `frontend/src/pages/Account/SupervisePage.jsx` — bouton "Écrire" sur chaque boutique supervisée.
Chaque bouton appelle `POST /messages/start` puis navigue vers `/messages/:conversationId`.

### Étape 4 — Frontend : boîte de réception + fil de conversation
- `frontend/src/pages/messages/MessagesPage.jsx` — liste des conversations (nom de l'autre personne, dernier message, badge non-lu), route `/messages`.
- `frontend/src/pages/messages/ConversationPage.jsx` — fil de messages + formulaire d'envoi, route `/messages/:id`. Champ d'envoi désactivé + message explicatif si le plan ne couvre pas la messagerie (même style que les blocages déjà faits sur Notes/POS/Clients) — l'historique reste visible.
- Ajout des deux routes dans `App.jsx`, nouvel item nav dans `frontend/src/routes/navigation.js` (`roles: ['OWNER', 'SELLER']`).

### Étape 5 — Badge non-lu
- `frontend/src/store/authStore.js` : ajout de `unreadMessagesCount` (même pattern que `planBanner` — peuplé une fois par session boutique, pas de polling continu, cohérent avec le choix déjà fait de ne pas viser le temps réel).
- Affiché à côté de "Messages" dans `DashboardLayout.jsx`, rafraîchi après lecture/envoi.

### Étape 6 — Vérification globale
Chaque étape testée avant de passer à la suivante (API via comptes de test, puis navigateur via Playwright comme pour toutes les fonctionnalités précédentes) — nettoyage des artefacts de test après coup, comme d'habitude.
