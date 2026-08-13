-- ============================================================================
-- 37_purge_comptes_non_verifies.sql
-- Domaine : Purge des comptes jamais vérifiés + réparation d'un conflit
--           entre l'immutabilité du journal d'audit et ON DELETE SET NULL
-- ============================================================================
-- Décidé en conversation : un compte resté PENDING_VERIFICATION (e-mail
-- inexistant, faute de frappe, inscription au nom d'un tiers jamais
-- confirmée) est désormais supprimé après 48h — soit immédiatement si
-- quelqu'un retente une inscription sur ce même e-mail
-- (auth.service.js#releaseStaleEmailIfAny), soit via une purge périodique
-- (auth.service.js#purgeStaleUnverifiedAccounts, appelée par server.js).
--
-- Bug découvert en testant cette purge : supprimer un utilisateur qui a au
-- moins une ligne dans system_logs (ex. l'entrée 'REGISTER_ACCOUNT', créée
-- pour CHAQUE inscription sans exception) échouait avec "registre
-- immuable". Cause : system_logs.user_id est en ON DELETE SET NULL
-- (§07_systeme_et_facturation.sql) — PostgreSQL doit donc UPDATE ces
-- lignes pour y mettre user_id à NULL, mais le trigger
-- trg_system_logs_no_update_delete (prevent_update_delete) bloque TOUTE
-- UPDATE sans distinction, y compris celle-ci. Même défaut pour
-- stock_movements.user_id, également en ON DELETE SET NULL.
--
-- Correctif : prevent_update_delete() autorise désormais UNE seule
-- exception, précise et vérifiée colonne par colonne — une UPDATE qui ne
-- fait STRICTEMENT que faire passer user_id de non-NULL à NULL, sur
-- system_logs ou stock_movements uniquement, aucune autre colonne
-- modifiée. Toute autre tentative de modification (falsifier action,
-- details, quantity...) continue d'être bloquée exactement comme avant —
-- l'immutabilité du contenu du registre n'est en rien affaiblie, seule la
-- rupture légitime d'un lien vers un compte supprimé est désormais permise.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('system_logs', 'stock_movements') THEN
    IF NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
       AND to_jsonb(NEW) - 'user_id' = to_jsonb(OLD) - 'user_id' THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION
    'Modification/suppression interdite sur la table % : registre immuable.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
