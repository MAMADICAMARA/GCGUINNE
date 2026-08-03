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
 * Choix technique : utilisation du driver "pg" natif plutôt que Prisma pour
 * l'exécution des requêtes. Le schéma est déjà appliqué via les scripts SQL
 * de backend/database/ (source de vérité). Prisma reste installé et pourra
 * être synchronisé plus tard avec `prisma db pull` si l'équipe souhaite un
 * client typé, mais n'est pas requis pour faire fonctionner l'application.
 */
const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Erreur inattendue sur une connexion PostgreSQL inactive', err);
});

module.exports = pool;