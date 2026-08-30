-- ============================================================================
-- 42_facturation_boutique.sql
-- Domaine : Section "Facturation" des paramètres boutique
-- ============================================================================
-- Décidé en conversation : quatre volets regroupés sous "Facturation" —
-- taux de taxe par défaut appliqué en Caisse, informations légales
-- affichées sur la Facture PDF, numérotation de facture dédiée
-- (indépendante du numéro de commande), export comptable (aucune colonne
-- requise pour ce dernier volet, lecture seule sur les commandes existantes).
--
-- default_tax_percent est une colonne dédiée (et non dans receipt_settings/
-- billing_settings) car elle doit voyager dans la même requête SELECT que
-- le reste de activeStore (auth.service.js#getStoresForUser,
-- stores.service.js#listMyStores) pour être disponible en Caisse sans appel
-- réseau supplémentaire à chaque vente.
--
-- billing_settings (JSONB, même principe que receipt_settings en
-- 23_personnalisation_recu.sql) regroupe les informations légales et la
-- config de numérotation — consultées seulement depuis Paramètres >
-- Facturation ou au moment de générer une Facture PDF, jamais en Caisse.
--
-- invoice_next_number est un compteur dédié (pas dans le JSONB) car il doit
-- être incrémenté atomiquement (UPDATE ... RETURNING) à chaque attribution
-- d'un numéro de facture, jamais lu/écrit via un merge JSONB classique.
--
-- orders.invoice_number reste NULL tant que la numérotation dédiée n'est
-- pas activée ou que la facture d'une commande n'a jamais été générée —
-- attribué une seule fois, au premier téléchargement (cf.
-- orders.service.js#getInvoiceData), pour rester stable ensuite.
-- ============================================================================

ALTER TABLE stores ADD COLUMN default_tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN billing_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stores ADD COLUMN invoice_next_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE orders ADD COLUMN invoice_number VARCHAR(50);
CREATE UNIQUE INDEX uq_orders_store_invoice_number ON orders (store_id, invoice_number) WHERE invoice_number IS NOT NULL;
