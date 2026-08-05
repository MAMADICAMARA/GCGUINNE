-- ============================================================================
-- 30_fond_de_caisse.sql
-- Domaine : Activation des sessions de caisse (§05_caisses.sql, décidé en
--           conversation — §B2 SOLUTIONS_AUDIT_PRODUCTION.md)
-- ============================================================================
-- Le schéma (`cash_drawers`, `orders.cash_drawer_id`, le trigger de calcul
-- automatique du solde théorique) existait déjà depuis le début du projet
-- mais n'était relié à aucun code applicatif — cette migration corrige un
-- bug déjà présent dans ce trigger avant de le brancher pour de vrai.
--
-- BUG CORRIGÉ : le trigger ajoutait `NEW.total_amount` (le prix total de la
-- vente) au solde théorique, au lieu de `NEW.amount_paid` (ce qui a
-- RÉELLEMENT été encaissé en espèces). Pour une vente partiellement payée
-- (le reste en dette client, déjà une fonctionnalité existante), ça aurait
-- gonflé le solde théorique au-delà de ce qui est physiquement dans le
-- tiroir-caisse — un écart fantôme à chaque vente à crédit, qui aurait
-- rendu la fonctionnalité inutilisable dès le premier jour. Jamais
-- constaté en production : ce trigger n'a jamais été déclenché jusqu'ici
-- (aucune commande n'avait de cash_drawer_id).
--
-- Décidé en conversation : l'annulation/le retour d'une vente (§B1) ne
-- touche JAMAIS le solde théorique de la caisse — cohérent avec la
-- décision déjà prise à l'époque que ce système ne modélise pas les
-- remboursements en espèces. Si un remboursement physique a réellement eu
-- lieu, l'écart se verra simplement à la fermeture de la caisse.
-- ============================================================================

-- Note libre optionnelle à la fermeture, pour expliquer un écart
-- (ex: "50 GNF de moins, rendu de monnaie approximatif") — jamais
-- obligatoire, jamais exploitée automatiquement.
ALTER TABLE cash_drawers ADD COLUMN note TEXT;

CREATE OR REPLACE FUNCTION update_cash_drawer_expected_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cash_drawer_id IS NOT NULL AND NEW.payment_method = 'CASH' THEN
    UPDATE cash_drawers
    SET expected_balance = expected_balance + NEW.amount_paid
    WHERE id = NEW.cash_drawer_id AND status = 'OPEN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
