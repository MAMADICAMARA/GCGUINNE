import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/purchases_api.dart';
import '../data/supplier_models.dart';
import '../data/suppliers_api.dart';
import 'suppliers/received_order_detail_sheet.dart';

/// Miroir de SuppliersPage.jsx (§18_fournisseurs_inter_boutiques.sql) —
/// réservé à l'Owner (déjà appliqué côté serveur). Trois blocs : mes
/// fournisseurs, mes clients (boutiques qui m'ont ajoutée), commandes
/// reçues de mes clients (lecture seule).
class SuppliersPage extends StatefulWidget {
  const SuppliersPage({super.key});

  @override
  State<SuppliersPage> createState() => _SuppliersPageState();
}

class _SuppliersPageState extends State<SuppliersPage> {
  List<StoreLink>? _suppliers;
  List<StoreLink>? _clients;
  List<ReceivedOrder>? _receivedOrders;
  String? _error;
  String? _successMessage;
  int? _busyLinkId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final suppliersApi = context.read<SuppliersApi>();
      final purchasesApi = context.read<PurchasesApi>();
      final results = await Future.wait([
        suppliersApi.listSuppliers(),
        suppliersApi.listClients(),
        purchasesApi.listReceivedOrders(),
      ]);
      if (!mounted) return;
      setState(() {
        _suppliers = results[0] as List<StoreLink>;
        _clients = results[1] as List<StoreLink>;
        _receivedOrders = results[2] as List<ReceivedOrder>;
        _error = null;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _openAddSheet() async {
    final added = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _AddSupplierSheet(),
    );
    if (added != null) {
      setState(
          () => _successMessage = '"$added" a été ajoutée à vos fournisseurs.');
      _load();
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _successMessage = null);
      });
    }
  }

  Future<void> _removeSupplier(StoreLink supplier) async {
    final suppliersApi = context.read<SuppliersApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Retirer ce fournisseur ?'),
        content: Text('Retirer "${supplier.name}" de vos fournisseurs ?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Annuler')),
          FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Retirer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyLinkId = supplier.linkId);
    try {
      await suppliersApi.removeSupplier(supplier.linkId);
      await _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busyLinkId = null);
    }
  }

  Future<void> _removeClient(StoreLink client) async {
    final suppliersApi = context.read<SuppliersApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Retirer ce client ?'),
        content: Text(
            'Retirer "${client.name}" de vos clients ? Elle perdra l\'accès à votre catalogue.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Annuler')),
          FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Retirer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyLinkId = client.linkId);
    try {
      await suppliersApi.removeClient(client.linkId);
      await _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busyLinkId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading =
        _suppliers == null || _clients == null || _receivedOrders == null;
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openAddSheet,
        icon: const Icon(Icons.add),
        label: const Text('Ajouter via un code'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            Text(
              'Boutiques de la plateforme dont vous consultez le catalogue, et boutiques qui vous ont ajouté.',
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
            ),
            const SizedBox(height: 12),
            if (_successMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(10)),
                child: Text(_successMessage!,
                    style: TextStyle(
                        color: Colors.green.shade800, fontSize: 12.5)),
              ),
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(10)),
                child: Text(_error!,
                    style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            if (loading)
              const Padding(
                  padding: EdgeInsets.only(top: 40),
                  child: Center(child: CircularProgressIndicator()))
            else ...[
              const _SectionHeader('Mes fournisseurs'),
              const SizedBox(height: 8),
              if (_suppliers!.isEmpty)
                const _EmptyState(
                    text: 'Aucun fournisseur ajouté pour l\'instant.')
              else
                for (final supplier in _suppliers!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _SupplierCard(
                      supplier: supplier,
                      busy: _busyLinkId == supplier.linkId,
                      onViewCatalog: () => context.push(
                          '/workspace/suppliers/${supplier.storeId}/order'),
                      onRemove: () => _removeSupplier(supplier),
                    ),
                  ),
              const SizedBox(height: 22),
              const _SectionHeader('Mes clients'),
              Text(
                'Boutiques qui vous ont ajoutée comme fournisseur — elles voient votre catalogue et votre prix de vente à titre de référence, mais jamais votre stock.',
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
              ),
              const SizedBox(height: 8),
              if (_clients!.isEmpty)
                const _EmptyState(
                    text:
                        'Aucune boutique ne vous a ajoutée comme fournisseur pour l\'instant.')
              else
                for (final client in _clients!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ClientCard(
                        client: client,
                        busy: _busyLinkId == client.linkId,
                        onRemove: () => _removeClient(client)),
                  ),
              const SizedBox(height: 22),
              const _SectionHeader('Commandes reçues de mes clients'),
              Text(
                'Ce que vos clients ont commandé chez vous — votre stock est diminué automatiquement dès qu\'ils confirment avoir reçu la livraison, jamais avant.',
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
              ),
              const SizedBox(height: 8),
              if (_receivedOrders!.isEmpty)
                const _EmptyState(
                    text: 'Aucune commande reçue pour l\'instant.')
              else
                for (final order in _receivedOrders!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReceivedOrderCard(
                      order: order,
                      onTap: () async {
                        final changed = await showReceivedOrderDetailSheet(
                            context, order.id);
                        if (changed == true) _load();
                      },
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14));
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(14)),
      child: Center(
          child: Text(text,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500))),
    );
  }
}

class _SupplierCard extends StatelessWidget {
  const _SupplierCard(
      {required this.supplier,
      required this.busy,
      required this.onViewCatalog,
      required this.onRemove});

  final StoreLink supplier;
  final bool busy;
  final VoidCallback onViewCatalog;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(supplier.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          Text(supplier.subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
          const SizedBox(height: 10),
          Row(
            children: [
              TextButton(
                  onPressed: busy ? null : onViewCatalog,
                  child: const Text('Voir le catalogue',
                      style: TextStyle(fontSize: 12.5))),
              const SizedBox(width: 4),
              TextButton(
                onPressed: busy ? null : onRemove,
                style:
                    TextButton.styleFrom(foregroundColor: Colors.grey.shade500),
                child: const Text('Retirer', style: TextStyle(fontSize: 12.5)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ClientCard extends StatelessWidget {
  const _ClientCard(
      {required this.client, required this.busy, required this.onRemove});

  final StoreLink client;
  final bool busy;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(client.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13.5)),
                Text(client.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: busy ? null : onRemove,
            style: TextButton.styleFrom(foregroundColor: Colors.red.shade500),
            child: const Text('Retirer', style: TextStyle(fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}

class _ReceivedOrderCard extends StatelessWidget {
  const _ReceivedOrderCard({required this.order, required this.onTap});

  final ReceivedOrder order;
  final VoidCallback onTap;

  Color _statusColor() => order.status == 'RECEIVED'
      ? Colors.green.shade700
      : (order.status == 'CANCELLED'
          ? Colors.red.shade700
          : (order.status == 'DELIVERED'
              ? Colors.blue.shade700
              : Colors.amber.shade800));
  Color _statusBg() => order.status == 'RECEIVED'
      ? Colors.green.shade50
      : (order.status == 'CANCELLED'
          ? Colors.red.shade50
          : (order.status == 'DELIVERED'
              ? Colors.blue.shade50
              : Colors.amber.shade50));

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(order.buyerStoreName ?? '—',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: Theme.of(context).colorScheme.primary)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: _statusBg(),
                      borderRadius: BorderRadius.circular(20)),
                  child: Text(
                      kReceivedOrderStatusLabels[order.status] ?? order.status,
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _statusColor())),
                ),
              ],
            ),
            Text(
                '${order.reference ?? '—'} · ${formatDateTime(order.createdAt)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(height: 6),
            Align(
                alignment: Alignment.centerRight,
                child: Text(formatGNF(order.totalAmount),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13.5))),
          ],
        ),
      ),
    );
  }
}

class _AddSupplierSheet extends StatefulWidget {
  const _AddSupplierSheet();

  @override
  State<_AddSupplierSheet> createState() => _AddSupplierSheetState();
}

class _AddSupplierSheetState extends State<_AddSupplierSheet> {
  final _codeController = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_codeController.text.trim().isEmpty) {
      setState(() => _error = 'Le code fournisseur est requis.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final name = await context
          .read<SuppliersApi>()
          .addSupplier(_codeController.text.trim());
      if (!mounted) return;
      Navigator.of(context).pop(name);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Ajouter un fournisseur',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 6),
              Text(
                'Demandez ce code au propriétaire de la boutique fournisseur — il se trouve dans ses Paramètres. Sa quantité en stock reste toujours privée ; son prix de vente n\'est visible qu\'au moment de préparer une commande.',
                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
              ),
              const SizedBox(height: 14),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!,
                      style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              TextField(
                controller: _codeController,
                autofocus: true,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                    labelText: 'Code fournisseur',
                    hintText: 'Ex : F5Q8N3Z3SCHW',
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Vérification...' : 'Ajouter'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
