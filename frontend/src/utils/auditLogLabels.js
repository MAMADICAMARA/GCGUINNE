import { formatDate } from '@/utils/format';

/**
 * Libellés français + regroupement des actions du journal d'activité
 * (system_logs), et mise en forme lisible de leur `details` JSONB — partagé
 * entre AuditLogPanel (boutique propre) et le Journal de supervision, qui
 * consomment tous les deux backend/src/utils/auditLog.js. Seules les
 * actions pouvant apparaître dans le journal D'UNE boutique précise sont
 * listées (ADMIN_UPDATE_PLAN / ADMIN_REVOKE_SUPER_ADMIN ont store_id NULL,
 * donc n'y figurent jamais).
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
    ],
  },
  {
    label: 'Ventes',
    actions: ['VOID_ORDER', 'RETURN_ORDER_ITEM', 'UPDATE_VOID_RETURN_SETTINGS'],
  },
  {
    label: 'Abonnement',
    actions: ['ADMIN_ACTIVATE_PLAN', 'ADMIN_RENEW_PLAN', 'ADMIN_DEACTIVATE_PLAN'],
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
    default:
      return null;
  }
}
