import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../account/data/stores_api.dart';
import '../data/purchase_models.dart';
import '../data/purchases_api.dart';
import 'purchases/create_purchase_order_sheet.dart';
import 'purchases/purchase_order_detail_sheet.dart';
import 'purchases/supplier_contact_sheet.dart';

enum _PurchasesTab { orders, suppliers }

/// Miroir de PurchasesPage.jsx — avantage exclusif du plan PREMIUM face à
/// STANDARD (§28_commandes_achat_premium.sql). Consulter fournisseurs/
/// commandes déjà créés reste toujours possible quel que soit le plan
/// actuel — seule la création d'un nouveau fournisseur ou d'une nouvelle
/// commande est verrouillée, avec un message clair plutôt qu'un bouton
/// silencieusement absent.
class PurchasesPage extends StatefulWidget {
  const PurchasesPage({super.key});

  @override
  State<PurchasesPage> createState() => _PurchasesPageState();
}

class _PurchasesPageState extends State<PurchasesPage> {
  _PurchasesTab _tab = _PurchasesTab.orders;
  PlanStatus? _planStatus;

  List<PurchaseOrderSummary> _orders = [];
  List<SupplierContact> _suppliers = [];
  bool _loading = true;
  String? _error;
  int? _busySupplierId;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final purchasesApi = context.read<PurchasesApi>();
      final storesApi = context.read<StoresApi>();
      final results = await Future.wait([
        purchasesApi.listPurchaseOrders(),
        purchasesApi.listSupplierContacts(),
        storesApi.getPlanStatus(),
      ]);
      if (!mounted) return;
      setState(() {
        _orders = results[0] as List<PurchaseOrderSummary>;
        _suppliers = results[1] as List<SupplierContact>;
        _planStatus = results[2] as PlanStatus;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loading = false;
      });
    }
  }

  bool get _canCreate => _planStatus?.allowsPurchaseOrders ?? false;

  Future<void> _openCreateOrder() async {
    final created = await showCreatePurchaseOrderSheet(context, _suppliers);
    if (created == true) _loadAll();
  }

  Future<void> _openAddSupplier() async {
    final saved = await showSupplierContactSheet(context);
    if (saved == true) _loadAll();
  }

  Future<void> _openEditSupplier(SupplierContact supplier) async {
    final saved = await showSupplierContactSheet(context, supplier: supplier);
    if (saved == true) _loadAll();
  }

  Future<void> _openOrderDetail(int orderId) async {
    final changed = await showPurchaseOrderDetailSheet(context, orderId);
    if (changed == true) _loadAll();
  }

  Future<void> _removeSupplier(SupplierContact supplier) async {
    final purchasesApi = context.read<PurchasesApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Retirer ce fournisseur ?'),
        content: Text('Retirer "${supplier.name}" de vos fournisseurs ?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Retirer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busySupplierId = supplier.id);
    try {
      await purchasesApi.deleteSupplierContact(supplier.id);
      await _loadAll();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busySupplierId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: _loading
          ? null
          : FloatingActionButton.extended(
              onPressed: _canCreate ? (_tab == _PurchasesTab.orders ? _openCreateOrder : _openAddSupplier) : null,
              backgroundColor: _canCreate ? null : Colors.grey.shade400,
              icon: const Icon(Icons.add),
              label: Text(_tab == _PurchasesTab.orders ? 'Nouvelle commande' : 'Ajouter un fournisseur'),
            ),
      body: RefreshIndicator(
        onRefresh: _loadAll,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            Text(
              "Fournisseurs et commandes d'achat — la réception met à jour le stock automatiquement.",
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
            ),
            const SizedBox(height: 12),
            if (!_loading && !_canCreate)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(
                  'Les commandes d\'achat sont réservées au plan PREMIUM — passez à ce plan pour en créer. La consultation de ce qui existe déjà reste possible.',
                  style: TextStyle(fontSize: 12, color: Colors.amber.shade800),
                ),
              ),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            Row(
              children: [
                _TabChip(label: 'Commandes', selected: _tab == _PurchasesTab.orders, onTap: () => setState(() => _tab = _PurchasesTab.orders)),
                const SizedBox(width: 8),
                _TabChip(label: 'Fournisseurs', selected: _tab == _PurchasesTab.suppliers, onTap: () => setState(() => _tab = _PurchasesTab.suppliers)),
              ],
            ),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
            else if (_tab == _PurchasesTab.orders)
              _buildOrdersTab()
            else
              _buildSuppliersTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildOrdersTab() {
    if (_orders.isEmpty) {
      return const _EmptyState(icon: Icons.assignment_outlined, message: "Aucune commande d'achat pour l'instant.");
    }
    return Column(
      children: [
        for (final order in _orders)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _OrderCard(order: order, onTap: () => _openOrderDetail(order.id)),
          ),
      ],
    );
  }

  Widget _buildSuppliersTab() {
    if (_suppliers.isEmpty) {
      return const _EmptyState(icon: Icons.shopping_bag_outlined, message: 'Aucun fournisseur enregistré pour l\'instant.');
    }
    return Column(
      children: [
        for (final supplier in _suppliers)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _SupplierCard(
              supplier: supplier,
              busy: _busySupplierId == supplier.id,
              onEdit: () => _openEditSupplier(supplier),
              onRemove: () => _removeSupplier(supplier),
            ),
          ),
      ],
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(label: Text(label, style: const TextStyle(fontSize: 12)), selected: selected, onSelected: (_) => onTap());
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 48),
      child: Column(
        children: [
          Icon(icon, size: 40, color: Colors.grey.shade300),
          const SizedBox(height: 10),
          Text(message, style: TextStyle(color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onTap});

  final PurchaseOrderSummary order;
  final VoidCallback onTap;

  Color _statusColor() {
    switch (order.status) {
      case 'RECEIVED':
        return Colors.green.shade700;
      case 'CANCELLED':
        return Colors.red.shade700;
      default:
        return Colors.amber.shade800;
    }
  }

  Color _statusBg() {
    switch (order.status) {
      case 'RECEIVED':
        return Colors.green.shade50;
      case 'CANCELLED':
        return Colors.red.shade50;
      default:
        return Colors.amber.shade50;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(order.supplierName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Theme.of(context).colorScheme.primary)),
                      if (order.supplierType == 'PLATFORM')
                        Text('fournisseur plateforme', style: TextStyle(fontSize: 10.5, color: Colors.grey.shade400)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: _statusBg(), borderRadius: BorderRadius.circular(20)),
                  child: Text(kPurchaseOrderStatusLabels[order.status] ?? order.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor())),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('${order.reference ?? '—'} · ${formatDateTime(order.createdAt)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: Text(order.createdByName ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
                const SizedBox(width: 8),
                Text(formatGNF(order.totalAmount), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SupplierCard extends StatelessWidget {
  const _SupplierCard({required this.supplier, required this.busy, required this.onEdit, required this.onRemove});

  final SupplierContact supplier;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(supplier.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 2),
          Text(supplier.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          const SizedBox(height: 10),
          Row(
            children: [
              InkWell(
                onTap: busy ? null : onEdit,
                child: Text('Modifier', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.primary)),
              ),
              const SizedBox(width: 16),
              InkWell(
                onTap: busy ? null : onRemove,
                child: Text('Retirer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade500)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
