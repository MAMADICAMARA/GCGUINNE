# Checklist de déploiement en production

À vérifier avant **chaque** mise en ligne sur un nouveau serveur — la plupart de ces oublis sont silencieux (l'application démarre quand même, avec une protection en moins).

## Variables d'environnement (`backend/.env`)

- [ ] `NODE_ENV=production` — sans ça, l'application démarre en mode `development` par défaut : CORS ouvert à n'importe quelle origine, et les erreurs renvoyées au client incluent la pile technique complète (`stack`). Un avertissement s'affiche dans les logs de démarrage si cette variable est absente — ne jamais l'ignorer.
- [ ] `CORS_ORIGIN=<domaine(s) réel(s) du frontend>` (ex: `https://app.mondomaine.com`) — plusieurs domaines séparés par des virgules si nécessaire. Sans ça, la valeur par défaut ne couvre que `localhost`.
- [ ] `JWT_SECRET=<valeur générée dédiée, jamais celle du développement>` — générer avec `openssl rand -base64 48` (ou équivalent). Le serveur refuse de démarrer si cette variable est absente (voir §A2 de `SOLUTIONS_AUDIT_PRODUCTION.md`) — c'est volontaire.
- [ ] `DATABASE_URL=<connexion vers la vraie base de production>`, jamais celle de développement.
- [ ] `BCRYPT_SALT_ROUNDS` — 12 par défaut, suffisant, à ne baisser sous aucun prétexte pour "aller plus vite".

## Base de données

- [ ] Toutes les migrations de `backend/database/*.sql` appliquées dans l'ordre (`run_migrations.sh`), y compris `24_reparation_schema.sql` une fois créée (§A3/A4 de `SOLUTIONS_AUDIT_PRODUCTION.md`).
- [ ] Connexion effectuée en UTF-8 (comportement par défaut du driver `pg` utilisé par ce projet — à vérifier seulement si les migrations sont un jour rejouées via `psql` directement).

## Après démarrage

- [ ] Vérifier les logs de démarrage : aucun avertissement `NODE_ENV non défini` ne doit apparaître.
- [ ] `GET /api/v1/health` répond `200`.
- [ ] Une tentative d'appel avec une origine non autorisée est bien rejetée (CORS effectif).
- [ ] Une erreur volontaire (ex: mauvais mot de passe) ne renvoie **aucune** trace technique (`stack`) dans la réponse JSON.
