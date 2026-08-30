import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/widgets/icon_badge.dart';
import '../../../account/data/stores_api.dart';
import '../../data/employee_models.dart';
import '../../data/employees_api.dart';

/// Point d'entrée unique vers les 3 autorisations vendeur (annulation/
/// retour, prix modifiable, création produit) — consolidées dans une seule
/// feuille (§ décidé en conversation) plutôt que 3 cartes séparées, pour
/// rester simple à trouver et à comprendre pour un public peu habitué à la
/// tech. Miroir de AuthorizationCard.jsx/AuthorizationModal.jsx côté web.
class AuthorizationCard extends StatelessWidget {
  const AuthorizationCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showAuthorizationSheet(context),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.violet.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.verified_user_outlined, size: 20, color: AppColors.violet),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Autorisation', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(
                      'Choisissez ce que vos vendeurs peuvent faire : annuler/retourner une vente, modifier un prix, créer un produit.',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500, height: 1.3),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: Colors.grey.shade300),
            ],
          ),
        ),
      ),
    );
  }
}

class _PermissionDef {
  const _PermissionDef({required this.key, required this.icon, required this.color, required this.title, required this.description});

  final String key; // canVoidReturn | canEditPrice | canAddProduct | canManageStock | canManageSuppliers | canManagePurchases
  final IconData icon;
  final Color color;
  final String title;
  final String description;
}

const _permissions = [
  _PermissionDef(
    key: 'canVoidReturn',
    icon: Icons.assignment_return_outlined,
    color: AppColors.rose,
    title: 'Annulation / retour de vente',
    description: "Annuler une vente ou accepter le retour d'un article. Un vendeur autorisé ne peut agir que sur ses propres ventes, jamais celles d'un collègue.",
  ),
  _PermissionDef(
    key: 'canEditPrice',
    icon: Icons.sell_outlined,
    color: AppColors.teal,
    title: 'Modification du prix à la Caisse',
    description: 'Négocier un prix différent avec le client au moment de la vente — jamais en dessous du prix normal, toujours vérifié automatiquement.',
  ),
  _PermissionDef(
    key: 'canAddProduct',
    icon: Icons.add_box_outlined,
    color: AppColors.emerald,
    title: 'Création de produit',
    description: 'Ajouter une nouvelle fiche produit au catalogue. Modifier ou désactiver un produit existant reste réservé à vous.',
  ),
  _PermissionDef(
    key: 'canManageStock',
    icon: Icons.warehouse_outlined,
    color: AppColors.amber,
    title: 'Accès à Stock',
    description: 'Ouvrir la page Stock et ajuster une quantité (casse, inventaire...). Consulter le stock ailleurs (Produits, Caisse) reste toujours possible pour tous.',
  ),
  _PermissionDef(
    key: 'canManageSuppliers',
    icon: Icons.local_shipping_outlined,
    color: AppColors.blue,
    title: 'Accès à Fournisseurs',
    description: 'Ouvrir la page Fournisseurs — voir/ajouter des fournisseurs, consulter leur catalogue. Réservé au Owner tant que non autorisé.',
  ),
  _PermissionDef(
    key: 'canManagePurchases',
    icon: Icons.shopping_bag_outlined,
    color: AppColors.violet,
    title: 'Accès à Achats',
    description: 'Ouvrir la page Achats — créer et suivre des commandes auprès de vos fournisseurs. Réservé au Owner tant que non autorisé.',
  ),
];

Future<void> showAuthorizationSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const _AuthorizationSheet(),
  );
}

class _AuthorizationSheet extends StatefulWidget {
  const _AuthorizationSheet();

  @override
  State<_AuthorizationSheet> createState() => _AuthorizationSheetState();
}

class _AuthorizationSheetState extends State<_AuthorizationSheet> {
  bool _loading = true;
  String? _error;
  final Map<String, bool> _allowAll = {};
  List<Employee> _sellers = [];
  String? _savingAllKey;
  String? _savingSeller; // "$userId:$key"

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final storesApi = context.read<StoresApi>();
      final employeesApi = context.read<EmployeesApi>();
      final results = await Future.wait([
        storesApi.getVoidReturnSettings(),
        storesApi.getEditPriceSettings(),
        storesApi.getAddProductSettings(),
        storesApi.getStockSettings(),
        storesApi.getSuppliersSettings(),
        storesApi.getPurchasesSettings(),
        employeesApi.list(),
      ]);
      if (!mounted) return;
      setState(() {
        _allowAll['canVoidReturn'] = results[0] as bool;
        _allowAll['canEditPrice'] = results[1] as bool;
        _allowAll['canAddProduct'] = results[2] as bool;
        _allowAll['canManageStock'] = results[3] as bool;
        _allowAll['canManageSuppliers'] = results[4] as bool;
        _allowAll['canManagePurchases'] = results[5] as bool;
        _sellers = (results[6] as List<Employee>).where((e) => e.roleCode == 'SELLER').toList();
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleAll(_PermissionDef permission, bool value) async {
    setState(() => _savingAllKey = permission.key);
    try {
      final storesApi = context.read<StoresApi>();
      final result = switch (permission.key) {
        'canVoidReturn' => await storesApi.updateVoidReturnSettings(value),
        'canEditPrice' => await storesApi.updateEditPriceSettings(value),
        'canAddProduct' => await storesApi.updateAddProductSettings(value),
        'canManageStock' => await storesApi.updateStockSettings(value),
        'canManageSuppliers' => await storesApi.updateSuppliersSettings(value),
        _ => await storesApi.updatePurchasesSettings(value),
      };
      if (!mounted) return;
      setState(() => _allowAll[permission.key] = result);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingAllKey = null);
    }
  }

  Future<void> _toggleSeller(_PermissionDef permission, Employee seller, bool value) async {
    final savingId = '${seller.userId}:${permission.key}';
    setState(() => _savingSeller = savingId);
    try {
      final employeesApi = context.read<EmployeesApi>();
      switch (permission.key) {
        case 'canVoidReturn':
          await employeesApi.updateVoidReturnPermission(seller.userId, value);
        case 'canEditPrice':
          await employeesApi.updateEditPricePermission(seller.userId, value);
        case 'canAddProduct':
          await employeesApi.updateAddProductPermission(seller.userId, value);
        case 'canManageStock':
          await employeesApi.updateManageStockPermission(seller.userId, value);
        case 'canManageSuppliers':
          await employeesApi.updateManageSuppliersPermission(seller.userId, value);
        default:
          await employeesApi.updateManagePurchasesPermission(seller.userId, value);
      }
      if (!mounted) return;
      setState(() {
        _sellers = _sellers.map((s) {
          if (s.userId != seller.userId) return s;
          return switch (permission.key) {
            'canVoidReturn' => s.copyWith(canVoidReturn: value),
            'canEditPrice' => s.copyWith(canEditPrice: value),
            'canAddProduct' => s.copyWith(canAddProduct: value),
            'canManageStock' => s.copyWith(canManageStock: value),
            'canManageSuppliers' => s.copyWith(canManageSuppliers: value),
            _ => s.copyWith(canManagePurchases: value),
          };
        }).toList();
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingSeller = null);
    }
  }

  bool _sellerValue(Employee seller, String key) => switch (key) {
        'canVoidReturn' => seller.canVoidReturn,
        'canEditPrice' => seller.canEditPrice,
        'canAddProduct' => seller.canAddProduct,
        'canManageStock' => seller.canManageStock,
        'canManageSuppliers' => seller.canManageSuppliers,
        _ => seller.canManagePurchases,
      };

  String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    final a = parts.isNotEmpty && parts[0].isNotEmpty ? parts[0][0] : '';
    final b = parts.length > 1 && parts[1].isNotEmpty ? parts[1][0] : '';
    return (a + b).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Autorisations des vendeurs', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        const SizedBox(height: 2),
                        Text(
                          'Choisissez ce que vos vendeurs peuvent faire sans vous demander à chaque fois.',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                        ),
                      ],
                    ),
                  ),
                  IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close)),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                      children: [
                        if (_error != null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 14),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                            child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
                          ),
                        for (var i = 0; i < _permissions.length; i++) ...[
                          if (i > 0) ...[const SizedBox(height: 20), Divider(color: Colors.grey.shade100), const SizedBox(height: 16)],
                          _buildPermissionBlock(_permissions[i]),
                        ],
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPermissionBlock(_PermissionDef permission) {
    final allOn = _allowAll[permission.key] ?? false;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: permission.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(permission.icon, size: 18, color: permission.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(permission.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  const SizedBox(height: 2),
                  Text(permission.description, style: TextStyle(fontSize: 12, color: Colors.grey.shade500, height: 1.35)),
                ],
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(left: 50, top: 10),
          child: Row(
            children: [
              const Expanded(child: Text('Autoriser tous les vendeurs', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600))),
              Switch(
                value: allOn,
                activeThumbColor: permission.color,
                onChanged: _savingAllKey == permission.key ? null : (value) => _toggleAll(permission, value),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(left: 50, top: 4),
          child: _sellers.isEmpty
              ? Text("Aucun vendeur dans l'équipe pour l'instant.", style: TextStyle(fontSize: 12, color: Colors.grey.shade400))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      allOn ? 'Déjà autorisés (tous les vendeurs ci-dessus) :' : 'Ou choisissez qui, individuellement :',
                      style: TextStyle(fontSize: 11.5, color: Colors.grey.shade400),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      child: Column(
                        children: [
                          for (final seller in _sellers)
                            Row(
                              children: [
                                Container(
                                  width: 24,
                                  height: 24,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: Colors.grey.shade200, shape: BoxShape.circle),
                                  child: Text(_initials(seller.fullName), style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Colors.grey.shade600)),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    seller.fullName,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 13, color: allOn ? Colors.grey.shade400 : Colors.black87),
                                  ),
                                ),
                                Switch(
                                  value: allOn || _sellerValue(seller, permission.key),
                                  activeThumbColor: permission.color,
                                  onChanged: (allOn || _savingSeller == '${seller.userId}:${permission.key}')
                                      ? null
                                      : (value) => _toggleSeller(permission, seller, value),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ],
    );
  }
}
