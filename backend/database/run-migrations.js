#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

/**
 * Applique les migrations SQL manquantes, dans l'ordre, en gardant une
 * trace en base (table `schema_migrations`) de celles déjà appliquées —
 * remplace définitivement les scripts jetables (`_tmp_apply_migration_*.cjs`)
 * utilisés jusqu'ici au fil des sessions de travail. Voir DEPLOIEMENT_PRODUCTION.md
 * §A2 pour le contexte complet.
 *
 * Usage :
 *   node database/run-migrations.js                 → applique les migrations manquantes
 *   node database/run-migrations.js --mark-existing  → les déclare appliquées SANS les
 *                                                       rejouer (pour adopter ce mécanisme
 *                                                       sur une base déjà à jour "à la main")
 *
 * Seuls les fichiers `NN_nom.sql` (préfixe à 2 chiffres) sont considérés des
 * migrations — jamais `drop_all.sql`, `reset-data.sql`, `fix-*.sql`, qui sont
 * des scripts d'entretien ponctuels, ni `README.md`/`run_migrations.sh`.
 */
const DATABASE_DIR = __dirname;
const MIGRATION_PATTERN = /^\d{2}_.*\.sql$/;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function listMigrationFiles() {
  // Tri lexicographique = tri numérique ici, tous les préfixes ayant
  // exactement 2 chiffres (00 à 99) — même principe que le glob
  // `[0-9][0-9]_*.sql` déjà utilisé par run_migrations.sh.
  return fs
    .readdirSync(DATABASE_DIR)
    .filter((f) => MIGRATION_PATTERN.test(f))
    .sort();
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

/**
 * Chaque migration dans sa PROPRE transaction : un échec à mi-fichier
 * annule uniquement ce fichier (jamais marqué comme appliqué), sans jamais
 * toucher aux migrations précédentes déjà validées.
 */
async function applyMigration(client, filename) {
  const sql = fs.readFileSync(path.join(DATABASE_DIR, filename), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`✔ Migration appliquée : ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`✘ Échec de la migration ${filename} :`, err.message);
    throw err;
  }
}

async function markAsApplied(client, filename) {
  await client.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename]
  );
  console.log(`… Déclarée déjà appliquée (non rejouée) : ${filename}`);
}

async function main() {
  const markOnly = process.argv.includes('--mark-existing');

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const pending = listMigrationFiles().filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('Aucune migration en attente — base déjà à jour.');
      return;
    }

    console.log(`${pending.length} migration(s) ${markOnly ? 'à déclarer' : 'à appliquer'} :`);
    pending.forEach((f) => console.log(`  - ${f}`));
    console.log('');

    for (const filename of pending) {
      if (markOnly) {
        await markAsApplied(client, filename);
      } else {
        await applyMigration(client, filename);
      }
    }

    console.log(`\n${pending.length} migration(s) ${markOnly ? 'déclarée(s)' : 'appliquée(s)'} avec succès.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Échec du script de migrations :', err.message);
  process.exit(1);
});
