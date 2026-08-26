import '../../../core/network/api_client.dart';
import 'employee_models.dart';

/// Miroir de employees.routes.js — réservé au Owner (déjà vérifié côté
/// serveur par requireRole('OWNER') sur toutes les routes /employees).
/// Pas de rôle Manager (abandonné, contexte guinéen) — un employé est
/// toujours Vendeur, aucun changement de rôle possible.
class EmployeesApi {
  const EmployeesApi(this._client);

  final ApiClient _client;

  Future<List<Employee>> list() async {
    final data = await _client.get('/employees');
    final raw = data['employees'] as List<dynamic>? ?? [];
    return raw.map((e) => Employee.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<EmployeeInvitation>> listInvitations() async {
    final data = await _client.get('/employees/invitations');
    final raw = data['invitations'] as List<dynamic>? ?? [];
    return raw.map((e) => EmployeeInvitation.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Toujours en tant que Vendeur — le serveur distingue automatiquement
  /// rattachement immédiat (compte existant) et invitation en attente
  /// (e-mail inconnu).
  Future<AddEmployeeResult> add(String email) async {
    final data = await _client.post('/employees', data: {'email': email.trim()});
    return AddEmployeeResult.fromJson(data);
  }

  Future<void> cancelInvitation(int invitationId) => _client.delete('/employees/invitations/$invitationId');

  /// C'est aussi le seul moyen de libérer quelqu'un pour qu'il puisse
  /// rejoindre une autre boutique en tant que Vendeur (règle d'exclusivité).
  Future<void> remove(int userId) => _client.delete('/employees/$userId');

  /// Autorisation individuelle d'annulation/retour de vente — indépendant
  /// du réglage global "tous les vendeurs" (StoresApi.updateVoidReturnSettings).
  Future<void> updateVoidReturnPermission(int userId, bool canVoidReturn) =>
      _client.patch('/employees/$userId/permissions', data: {'canVoidReturn': canVoidReturn});

  /// Autorisation individuelle de modification du prix à la Caisse
  /// (§39_prix_editable_vente.sql) — indépendant du réglage global
  /// (StoresApi.updateEditPriceSettings).
  Future<void> updateEditPricePermission(int userId, bool canEditPrice) =>
      _client.patch('/employees/$userId/permissions', data: {'canEditPrice': canEditPrice});

  /// Autorisation individuelle de création de produit
  /// (§40_autorisation_ajout_produit.sql) — indépendant du réglage global
  /// (StoresApi.updateAddProductSettings).
  Future<void> updateAddProductPermission(int userId, bool canAddProduct) =>
      _client.patch('/employees/$userId/permissions', data: {'canAddProduct': canAddProduct});
}
