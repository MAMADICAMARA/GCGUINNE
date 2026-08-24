import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/purchase_models.dart';
import '../../data/purchases_api.dart';

/// Miroir de PurchaseOrderDetailModal.jsx — "Marquer reçue" met à jour le
/// stock de tous les articles en un seul geste ; "Annuler" reste possible
/// tant que rien n'a encore été reçu. Ces deux actions restent disponibles
/// même si la boutique a depuis perdu l'accès PREMIUM — seule la création
/// d'une nouvelle commande est verrouillée par le plan.
///
/// Retourne `true` si la commande a été modifiée (reçue/annulée).
Future<bool?> showPurchaseOrderDetailSheet(BuildContext context, int orderId) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _PurchaseOrderDetailSheet(orderId: orderId),
  );
}

class _PurchaseOrderDetailSheet extends StatefulWidget {
  const _PurchaseOrderDetailSheet({required this.orderId});

  final int orderId;

  @override
  State<_PurchaseOrderDetailSheet> createState() => _PurchaseOrderDetailSheetState();
}

class _PurchaseOrderDetailSheetState extends State<_PurchaseOrderDetailSheet> {
  PurchaseOrderDetail? _detail;
  String? _error;
  bool _busy = false;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await context.read<PurchasesApi>().getPurchaseOrder(widget.orderId);
      if (!mounted) return;
      setState(() => _detail = detail);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _handleReceive() async {
    final purchasesApi = context.read<PurchasesApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Marquer cette commande comme reçue ?'),
        content: const Text('Le stock de chaque article sera immédiatement augmenté de la quantité commandée. Cette action est irréversible.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Retour')),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Marquer reçue'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await purchasesApi.receivePurchaseOrder(widget.orderId);
      _changed = true;
      await _load();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _handleCancel() async {
    final purchasesApi = context.read<PurchasesApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Annuler cette commande ?'),
        content: const Text('Cette action est irréversible.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Retour')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Annuler la commande'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await purchasesApi.cancelPurchaseOrder(widget.orderId);
      _changed = true;
      await _load();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    final canAct = detail != null && detail.order.status == 'PENDING';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, __) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.8,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            const Text('Détail de la commande', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 14),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            if (detail == null)
              const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
            else ...[
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.4,
                children: [
                  _Info(label: 'Fournisseur', value: detail.order.supplierName),
                  _Info(label: 'Référence', value: detail.order.reference ?? '—'),
                  _Info(label: 'Créée par', value: detail.order.createdByName ?? '—'),
                  _Info(label: 'Date', value: formatDateTime(detail.order.createdAt)),
                  _Info(label: 'Statut', value: kPurchaseOrderStatusLabels[detail.order.status] ?? detail.order.status),
                  if (detail.order.receivedAt != null) _Info(label: 'Reçue le', value: formatDateTime(detail.order.receivedAt)),
                  if (detail.order.receivedByName != null) _Info(label: 'Reçue par', value: detail.order.receivedByName!),
                ],
              ),
              const SizedBox(height: 16),
              const Text('Articles', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
                child: Column(
                  children: [
                    for (var i = 0; i < detail.items.length; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                        decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: Colors.grey.shade100))),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(detail.items[i].productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                                  Text(
                                    '${detail.items[i].quantity} × ${formatGNF(detail.items[i].purchasePrice)}',
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(formatGNF(detail.items[i].quantity * detail.items[i].purchasePrice), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const Spacer(),
                  Text(formatGNF(detail.order.totalAmount), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  if (canAct)
                    OutlinedButton(
                      onPressed: _busy ? null : _handleReceive,
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.green.shade700, side: BorderSide(color: Colors.green.shade200)),
                      child: Text(_busy ? 'Traitement...' : 'Marquer reçue'),
                    ),
                  if (canAct)
                    OutlinedButton(
                      onPressed: _busy ? null : _handleCancel,
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700, side: BorderSide(color: Colors.red.shade200)),
                      child: const Text('Annuler la commande'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 9, color: Colors.grey.shade500, letterSpacing: 0.3)),
          const SizedBox(height: 2),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
