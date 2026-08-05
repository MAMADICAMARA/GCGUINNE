const { Pool, types } = require('pg');
const env = require('./env');

/**
 * IMPORTANT : par défaut, le driver "pg" renvoie les colonnes NUMERIC/DECIMAL
 * (OID 1700, ex: products.selling_price) et BIGINT/INT8 (OID 20, ex: le
 * résultat de SUM() sur une colonne INTEGER) sous forme de **chaînes de
 * caractères**, afin d'éviter toute perte de précision côté JavaScript.
 *
 * Sans ce réglage, du code qui appelle `.toFixed()` sur un prix, ou qui
 * compare deux totaux issus d'un SUM() avec `>` / `>=`, produit des bugs
 * réels et déjà rencontrés dans ce projet :
 *   - `item.unitPrice.toFixed is not a function` (string, pas un number)
 *   - comparaison alphabétique au lieu de numérique ("9" >= "10" → true)
 *
 * On corrige ce comportement une seule fois, ici, plutôt que de forcer une
 * conversion (`Number(...)`) à chaque endroit du code où une valeur
 * numérique/bigint est lue.
 */
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : parseFloat(value)));
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : parseInt(value, 10)));

/**
 * Pool de connexions PostgreSQL partagé par toute l'application.
 *
 * Choix technique : utilisation du driver "pg" natif — le schéma est
 * appliqué via les scripts SQL de backend/database/ (seule source de
 * vérité). Prisma a été retiré du projet (§C2 SOLUTIONS_AUDIT_PRODUCTION.md,
 * décidé en conversation) : jamais utilisé dans le code applicatif, et son
 * schema.prisma désynchronisé de la vraie base aurait pu induire en erreur
 * un futur développeur qui l'aurait pris pour la source de vérité.
 */
const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Erreur inattendue sur une connexion PostgreSQL inactive', err);
});

module.exports = pool;