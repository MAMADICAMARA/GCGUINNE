/// Miroir de frontend/src/utils/auditLogLabels.js — libellés français +
/// regroupement des actions du journal d'activité (system_logs), partagé
/// entre le Journal de Supervision et (plus tard) un éventuel Journal
/// d'activité pour sa propre boutique. Seules les actions pouvant
/// apparaître dans le journal D'UNE boutique précise sont listées.
library;

import '../utils/formatters.dart';

const Map<String, String> _kRoleLabels = {'SELLER': 'Vendeur', 'OWNER': 'Propriétaire'};

class AuditActionGroup {
  const AuditActionGroup(this.label, this.actions);
  final String label;
  final List<String> actions;
}

const List<AuditActionGroup> kAuditActionGroups = [
  AuditActionGroup('Équipe', [
    'INVITE_EMPLOYEE',
    'ADD_EMPLOYEE_EXISTING_ACCOUNT',
    'REMOVE_EMPLOYEE',
    'SET_SELLER_VOID_RETURN_PERMISSION',
  ]),
  AuditActionGroup('Ventes', ['VOID_ORDER', 'RETURN_ORDER_ITEM', 'UPDATE_VOID_RETURN_SETTINGS']),
  AuditActionGroup('Achats', [
    'CREATE_PURCHASE_ORDER',
    'RECEIVE_PURCHASE_ORDER',
    'CANCEL_PURCHASE_ORDER',
    'SUPPLIER_STOCK_DECREASED',
  ]),
  AuditActionGroup('Abonnement', [
    'ADMIN_ACTIVATE_PLAN',
    'ADMIN_RENEW_PLAN',
    'ADMIN_DEACTIVATE_PLAN',
    'SUBMIT_PAYMENT_REQUEST',
    'REJECT_PAYMENT_REQUEST',
  ]),
  AuditActionGroup('Boutique', [
    'CREATE_STORE',
    'TRANSFER_STORE_OWNERSHIP',
    'ADMIN_SUSPEND_STORE',
    'ADMIN_REACTIVATE_STORE',
  ]),
  AuditActionGroup('Connexion', ['LOGIN', 'REGISTER_ACCOUNT', 'ACCEPT_INVITATION']),
];

const Map<String, String> kAuditActionLabels = {
  'LOGIN': 'Connexion',
  'REGISTER_ACCOUNT': 'Création de compte',
  'ACCEPT_INVITATION': 'Invitation acceptée',
  'CREATE_STORE': 'Boutique créée',
  'TRANSFER_STORE_OWNERSHIP': 'Propriété transférée',
  'INVITE_EMPLOYEE': 'Employé invité',
  'ADD_EMPLOYEE_EXISTING_ACCOUNT': 'Employé rattaché',
  'REMOVE_EMPLOYEE': 'Employé retiré',
  'ADMIN_SUSPEND_STORE': 'Boutique suspendue',
  'ADMIN_REACTIVATE_STORE': 'Boutique réactivée',
  'ADMIN_ACTIVATE_PLAN': 'Abonnement activé',
  'ADMIN_RENEW_PLAN': 'Abonnement renouvelé',
  'ADMIN_DEACTIVATE_PLAN': 'Abonnement désactivé',
  'VOID_ORDER': 'Vente annulée',
  'RETURN_ORDER_ITEM': 'Article retourné',
  'UPDATE_VOID_RETURN_SETTINGS': "Réglage d'autorisation modifié",
  'SET_SELLER_VOID_RETURN_PERMISSION': 'Autorisation vendeur modifiée',
  'SUBMIT_PAYMENT_REQUEST': 'Paiement déclaré',
  'REJECT_PAYMENT_REQUEST': 'Paiement refusé',
  'CREATE_PURCHASE_ORDER': "Commande d'achat créée",
  'RECEIVE_PURCHASE_ORDER': "Commande d'achat reçue",
  'CANCEL_PURCHASE_ORDER': "Commande d'achat annulée",
  'SUPPLIER_STOCK_DECREASED': 'Stock diminué (commande client)',
};

String auditActionLabel(String action) => kAuditActionLabels[action] ?? action;

/// Miroir de formatLogDetails() — met en forme le JSON `details` en une
/// courte phrase lisible, spécifique à chaque action.
String? formatAuditLogDetails(String action, Map<String, dynamic>? details) {
  if (details == null) return null;
  String? str(Object? v) => v?.toString();

  switch (action) {
    case 'REGISTER_ACCOUNT':
      return str(details['email']);
    case 'INVITE_EMPLOYEE':
      return [str(details['email']), _kRoleLabels[details['roleCode']] ?? str(details['roleCode'])]
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .join(' — ');
    case 'ADD_EMPLOYEE_EXISTING_ACCOUNT':
      return _kRoleLabels[details['roleCode']] ?? str(details['roleCode']);
    case 'ADMIN_ACTIVATE_PLAN':
      return [
        str(details['planName']),
        details['expiresAt'] != null ? "jusqu'au ${formatDate(details['expiresAt'])}" : null,
      ].whereType<String>().where((s) => s.isNotEmpty).join(' — ');
    case 'ADMIN_RENEW_PLAN':
      return details['expiresAt'] != null ? "jusqu'au ${formatDate(details['expiresAt'])}" : null;
    case 'VOID_ORDER':
      return str(details['orderNumber']);
    case 'RETURN_ORDER_ITEM':
      return [
        str(details['orderNumber']),
        details['returnedQty'] != null ? '${details['returnedQty']} article(s)' : null,
      ].whereType<String>().where((s) => s.isNotEmpty).join(' — ');
    case 'UPDATE_VOID_RETURN_SETTINGS':
      return details['allowAllSellers'] == true ? 'Tous les vendeurs autorisés' : 'Autorisation globale retirée';
    case 'SET_SELLER_VOID_RETURN_PERMISSION':
      return details['canVoidReturn'] == true ? 'Vendeur autorisé' : 'Autorisation retirée';
    case 'SUBMIT_PAYMENT_REQUEST':
      return [
        str(details['planName']),
        details['amount'] != null ? formatGNF(details['amount']) : null,
      ].whereType<String>().where((s) => s.isNotEmpty).join(' — ');
    case 'REJECT_PAYMENT_REQUEST':
      return str(details['reason']);
    case 'CREATE_PURCHASE_ORDER':
      return [
        details['totalAmount'] != null ? formatGNF(details['totalAmount']) : null,
        details['itemCount'] != null ? '${details['itemCount']} article(s)' : null,
      ].whereType<String>().where((s) => s.isNotEmpty).join(' — ');
    case 'RECEIVE_PURCHASE_ORDER':
    case 'SUPPLIER_STOCK_DECREASED':
      return details['itemCount'] != null ? '${details['itemCount']} article(s)' : null;
    default:
      return null;
  }
}
