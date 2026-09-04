import { formatDate } from '@/utils/format';

/**
 * Libellés français + regroupement des actions du journal d'activité
 * (system_logs), et mise en forme lisible de leur `details` JSONB — partagé
 * entre AuditLogPanel (boutique propre), le Journal de supervision, ET
 * AdminAuditLogPage (Super Admin, plateforme entière) — § décidé en
 * conversation : la page Super Admin affichait jusqu'ici le code brut
 * (`ADMIN_PUBLISH_APP_VERSION`...) sans jamais réutiliser ce mécanisme,
 * illisible pour un utilisateur non technique. `ACTION_GROUPS` reste
 * volontairement limité aux actions D'UNE boutique précise (sert de filtre
 * pour le journal boutique/supervision) — les actions globales
 * (store_id NULL, ex: ADMIN_UPDATE_PLAN) n'y figurent jamais puisqu'elles
 * ne peuvent pas apparaître dans CE journal-là, mais restent bien dans
 * ACTION_LABELS/formatLogDetails ci-dessous pour la page Super Admin.
 */
const ROLE_LABELS = { SELLER: 'Vendeur', OWNER: 'Propriétaire' };

export const ACTION_GROUPS = [
  {
    label: 'Équipe',
    actions: [
      'INVITE_EMPLOYEE',
      'ADD_EMPLOYEE_EXISTING_ACCOUNT',
      'REMOVE_EMPLOYEE',
      'SET_SELLER_VOID_RETURN_PERMISSION',
      'SET_SELLER_EDIT_PRICE_PERMISSION',
      'SET_SELLER_ADD_PRODUCT_PERMISSION',
      'UPDATE_ADD_PRODUCT_SETTINGS',
    ],
  },
  {
    label: 'Ventes',
    actions: [
      'VOID_ORDER',
      'RETURN_ORDER_ITEM',
      'UPDATE_VOID_RETURN_SETTINGS',
      'UPDATE_EDIT_PRICE_SETTINGS',
    ],
  },
  {
    label: 'Achats',
    actions: [
      'CREATE_PURCHASE_ORDER',
      'RECEIVE_PURCHASE_ORDER',
      'CANCEL_PURCHASE_ORDER',
      'SUPPLIER_STOCK_DECREASED',
    ],
  },
  {
    label: 'Abonnement',
    actions: [
      'ADMIN_ACTIVATE_PLAN',
      'ADMIN_RENEW_PLAN',
      'ADMIN_DEACTIVATE_PLAN',
      'SUBMIT_PAYMENT_REQUEST',
      'REJECT_PAYMENT_REQUEST',
    ],
  },
  {
    label: 'Boutique',
    actions: ['CREATE_STORE', 'TRANSFER_STORE_OWNERSHIP', 'ADMIN_SUSPEND_STORE', 'ADMIN_REACTIVATE_STORE'],
  },
  {
    label: 'Connexion',
    actions: ['LOGIN', 'REGISTER_ACCOUNT', 'ACCEPT_INVITATION'],
  },
];

export const ACTION_LABELS = {
  LOGIN: 'Connexion',
  REGISTER_ACCOUNT: 'Création de compte',
  ACCEPT_INVITATION: 'Invitation acceptée',
  CREATE_STORE: 'Boutique créée',
  TRANSFER_STORE_OWNERSHIP: 'Propriété transférée',
  INVITE_EMPLOYEE: 'Employé invité',
  ADD_EMPLOYEE_EXISTING_ACCOUNT: 'Employé rattaché',
  REMOVE_EMPLOYEE: 'Employé retiré',
  ADMIN_SUSPEND_STORE: 'Boutique suspendue',
  ADMIN_REACTIVATE_STORE: 'Boutique réactivée',
  ADMIN_ACTIVATE_PLAN: 'Abonnement activé',
  ADMIN_RENEW_PLAN: 'Abonnement renouvelé',
  ADMIN_DEACTIVATE_PLAN: 'Abonnement désactivé',
  VOID_ORDER: 'Vente annulée',
  RETURN_ORDER_ITEM: 'Article retourné',
  UPDATE_VOID_RETURN_SETTINGS: "Réglage d'autorisation modifié",
  SET_SELLER_VOID_RETURN_PERMISSION: 'Autorisation vendeur modifiée',
  UPDATE_EDIT_PRICE_SETTINGS: 'Réglage prix modifiable mis à jour',
  SET_SELLER_EDIT_PRICE_PERMISSION: 'Autorisation prix vendeur modifiée',
  UPDATE_ADD_PRODUCT_SETTINGS: 'Réglage ajout produit mis à jour',
  SET_SELLER_ADD_PRODUCT_PERMISSION: 'Autorisation ajout produit modifiée',
  SUBMIT_PAYMENT_REQUEST: 'Paiement déclaré',
  REJECT_PAYMENT_REQUEST: 'Paiement refusé',
  CREATE_PURCHASE_ORDER: "Commande d'achat créée",
  RECEIVE_PURCHASE_ORDER: "Commande d'achat reçue",
  CANCEL_PURCHASE_ORDER: "Commande d'achat annulée",
  SUPPLIER_STOCK_DECREASED: 'Stock diminué (commande client)',
  DECLARE_ORDER_DELIVERED: 'Livraison confirmée (fournisseur)',
  MERGE_DUPLICATE_PRODUCTS: 'Produits fusionnés',
  STOCK_TRANSFER_SENT: 'Transfert de stock envoyé',
  STOCK_TRANSFER_RECEIVED: 'Transfert de stock reçu',
  OPEN_CASH_DRAWER: 'Caisse ouverte',
  CLOSE_CASH_DRAWER: 'Caisse fermée',
  SET_SELLER_MANAGE_STOCK_PERMISSION: 'Autorisation stock vendeur modifiée',
  SET_SELLER_MANAGE_SUPPLIERS_PERMISSION: 'Autorisation fournisseurs vendeur modifiée',
  SET_SELLER_MANAGE_PURCHASES_PERMISSION: 'Autorisation achats vendeur modifiée',
  UPDATE_STOCK_SETTINGS: 'Réglage autorisation stock mis à jour',
  UPDATE_SUPPLIERS_SETTINGS: 'Réglage autorisation fournisseurs mis à jour',
  UPDATE_PURCHASES_SETTINGS: 'Réglage autorisation achats mis à jour',
  CHANGE_PASSWORD: 'Mot de passe changé',
  PASSWORD_RESET: 'Mot de passe réinitialisé',
  UPDATE_PROFILE: 'Profil mis à jour',
  VERIFY_EMAIL: 'E-mail vérifié',
  // Actions globales (store_id NULL, Super Admin uniquement).
  ADMIN_PUBLISH_APP_VERSION: "Version de l'app publiée",
  ADMIN_UPDATE_PLAN: "Plan d'abonnement modifié",
  ADMIN_UPDATE_USER_EMAIL: 'E-mail utilisateur modifié',
  ADMIN_RELAUNCH_VERIFICATION: 'Vérification relancée',
  ADMIN_REVOKE_SUPER_ADMIN: 'Droits Super Admin retirés',
};

export function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

export function formatLogDetails(action, details) {
  if (!details) return null;
  switch (action) {
    case 'REGISTER_ACCOUNT':
      return details.email || null;
    case 'INVITE_EMPLOYEE':
      return [details.email, ROLE_LABELS[details.roleCode] || details.roleCode].filter(Boolean).join(' — ');
    case 'ADD_EMPLOYEE_EXISTING_ACCOUNT':
      return ROLE_LABELS[details.roleCode] || details.roleCode || null;
    case 'ADMIN_ACTIVATE_PLAN':
      return [details.planName, details.expiresAt ? `jusqu'au ${formatDate(details.expiresAt)}` : null]
        .filter(Boolean)
        .join(' — ');
    case 'ADMIN_RENEW_PLAN':
      return details.expiresAt ? `jusqu'au ${formatDate(details.expiresAt)}` : null;
    case 'VOID_ORDER':
      return details.orderNumber || null;
    case 'RETURN_ORDER_ITEM':
      return [details.orderNumber, details.returnedQty ? `${details.returnedQty} article(s)` : null]
        .filter(Boolean)
        .join(' — ');
    case 'UPDATE_VOID_RETURN_SETTINGS':
      return details.allowAllSellers ? 'Tous les vendeurs autorisés' : 'Autorisation globale retirée';
    case 'SET_SELLER_VOID_RETURN_PERMISSION':
      return details.canVoidReturn ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'UPDATE_EDIT_PRICE_SETTINGS':
      return details.allowAllSellers ? 'Tous les vendeurs autorisés' : 'Autorisation globale retirée';
    case 'SET_SELLER_EDIT_PRICE_PERMISSION':
      return details.canEditPrice ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'UPDATE_ADD_PRODUCT_SETTINGS':
      return details.allowAllSellers ? 'Tous les vendeurs autorisés' : 'Autorisation globale retirée';
    case 'SET_SELLER_ADD_PRODUCT_PERMISSION':
      return details.canAddProduct ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'SUBMIT_PAYMENT_REQUEST':
      return [details.planName, details.amount ? `${Number(details.amount).toLocaleString('fr-FR')} GNF` : null]
        .filter(Boolean)
        .join(' — ');
    case 'REJECT_PAYMENT_REQUEST':
      return details.reason || null;
    case 'CREATE_PURCHASE_ORDER':
      return [
        details.totalAmount ? `${Number(details.totalAmount).toLocaleString('fr-FR')} GNF` : null,
        details.itemCount ? `${details.itemCount} article(s)` : null,
      ]
        .filter(Boolean)
        .join(' — ');
    case 'RECEIVE_PURCHASE_ORDER':
      return details.itemCount ? `${details.itemCount} article(s)` : null;
    case 'SUPPLIER_STOCK_DECREASED':
      return details.itemCount ? `${details.itemCount} article(s)` : null;
    case 'DECLARE_ORDER_DELIVERED':
      return details.orderId ? `Commande #${details.orderId}` : null;
    case 'MERGE_DUPLICATE_PRODUCTS':
      return details.transferredQuantity ? `${details.transferredQuantity} en stock transféré` : null;
    case 'STOCK_TRANSFER_SENT':
      return [
        details.productName,
        details.quantity ? `${details.quantity} unité(s)` : null,
        details.toStoreName ? `vers ${details.toStoreName}` : null,
      ]
        .filter(Boolean)
        .join(' — ');
    case 'STOCK_TRANSFER_RECEIVED':
      return [details.productName, details.quantity ? `${details.quantity} unité(s)` : null]
        .filter(Boolean)
        .join(' — ');
    case 'OPEN_CASH_DRAWER':
      return details.openingBalance != null
        ? `Fonds de départ : ${Number(details.openingBalance).toLocaleString('fr-FR')} GNF`
        : null;
    case 'CLOSE_CASH_DRAWER':
      return [
        details.closingBalance != null ? `${Number(details.closingBalance).toLocaleString('fr-FR')} GNF` : null,
        details.discrepancy ? `écart ${Number(details.discrepancy).toLocaleString('fr-FR')} GNF` : null,
      ]
        .filter(Boolean)
        .join(' — ');
    case 'SET_SELLER_MANAGE_STOCK_PERMISSION':
      return details.canManageStock ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'SET_SELLER_MANAGE_SUPPLIERS_PERMISSION':
      return details.canManageSuppliers ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'SET_SELLER_MANAGE_PURCHASES_PERMISSION':
      return details.canManagePurchases ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'UPDATE_STOCK_SETTINGS':
    case 'UPDATE_SUPPLIERS_SETTINGS':
    case 'UPDATE_PURCHASES_SETTINGS':
      return details.allowAllSellers ? 'Tous les vendeurs autorisés' : 'Autorisation globale retirée';
    case 'ADMIN_PUBLISH_APP_VERSION': {
      const levelLabels = { OPTIONAL: 'Optionnel', RECOMMENDED: 'Recommandée', MANDATORY: 'Obligatoire' };
      return [
        details.versionName ? `${details.versionName} (code ${details.versionCode})` : null,
        levelLabels[details.updateLevel] || details.updateLevel,
      ]
        .filter(Boolean)
        .join(' — ');
    }
    case 'ADMIN_UPDATE_PLAN':
      return details.planName || null;
    case 'ADMIN_UPDATE_USER_EMAIL':
      return details.newEmail || null;
    case 'ADMIN_REVOKE_SUPER_ADMIN':
      return details.targetEmail || null;
    default:
      return null;
  }
}
