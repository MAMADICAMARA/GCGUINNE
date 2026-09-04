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
  State<_PurchaseOrderDetailSheet> createState() =>
      _PurchaseOrderDetailSheetState();
}

class _PurchaseOrderDetailSheetState extends State<_PurchaseOrderDetailSheet> {
  PurchaseOrderDetail? _detail;
  String? _error;
  bool _busy = false;
  bool _changed = false;
  // Prix de vente modifiable par ligne, uniquement pour un fournisseur DE LA
  // PLATEFORME (§ décidé en conversation) — le prix d'achat, lui, n'est
  // jamais éditable ici, toujours celui négocié à la création de la
  // commande. Un seul contrôleur par ligne, jamais réinitialisé après le
  // premier chargement, pour ne pas effacer une saisie en cours au moindre
  // rechargement.
  final Map<int, TextEditingController> _sellingPriceControllers = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _sellingPriceControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final detail =
          await context.read<PurchasesApi>().getPurchaseOrder(widget.orderId);
      if (!mounted) return;
      for (final item in detail.items) {
        _sellingPriceControllers.putIfAbsent(
          item.id,
          () =>
              TextEditingController(text: item.currentSellingPrice.toString()),
        );
      }
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
        content: const Text(
            'Le stock de chaque article sera immédiatement augmenté de la quantité commandée. Cette action est irréversible.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Retour')),
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
      final detail = _detail;
      Map<int, num>? sellingPriceByItemId;
      if (detail != null && detail.order.supplierType == 'PLATFORM') {
        sellingPriceByItemId = {
          for (final item in detail.items)
            if (num.tryParse(_sellingPriceControllers[item.id]?.text ?? '') !=
                null)
              item.id: num.parse(_sellingPriceControllers[item.id]!.text),
        };
      }
      await purchasesApi.receivePurchaseOrder(widget.orderId,
          sellingPriceByItemId: sellingPriceByItemId);
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
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Retour')),
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
    // §49_confirmation_livraison_fournisseur.sql, décidé en conversation —
    // pour une commande créée après ce correctif auprès d'un fournisseur DE
    // LA PLATEFORME, "Marquer reçue" n'est disponible qu'une fois le
    // fournisseur passé par DELIVERED ; une commande antérieure ou d'un
    // fournisseur externe garde l'ancien comportement (directe depuis
    // PENDING).
    final needsDeliveryFirst = detail != null &&
        detail.order.supplierType == 'PLATFORM' &&
        detail.order.requiresDeliveryConfirmation;
    final canReceive = detail != null &&
        (needsDeliveryFirst
            ? detail.order.status == 'DELIVERED'
            : detail.order.status == 'PENDING');
    final canCancel = detail != null && detail.order.status == 'PENDING';
    final waitingOnSupplier =
        needsDeliveryFirst && detail.order.status == 'PENDING';

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
            const Text('Détail de la commande',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 14),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!,
                    style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            if (detail == null)
              const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator()))
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
                  _Info(
                      label: 'Référence', value: detail.order.reference ?? '—'),
                  _Info(
                      label: 'Créée par',
                      value: detail.order.createdByName ?? '—'),
                  _Info(
                      label: 'Date',
                      value: formatDateTime(detail.order.createdAt)),
                  _Info(
                      label: 'Statut',
                      value: kPurchaseOrderStatusLabels[detail.order.status] ??
                          detail.order.status),
                  if (detail.order.deliveredAt != null)
                    _Info(
                        label: 'Livrée le',
                        value: formatDateTime(detail.order.deliveredAt)),
                  if (detail.order.receivedAt != null)
                    _Info(
                        label: 'Reçue le',
                        value: formatDateTime(detail.order.receivedAt)),
                  if (detail.order.receivedByName != null)
                    _Info(
                        label: 'Reçue par',
                        value: detail.order.receivedByName!),
                ],
              ),
              const SizedBox(height: 16),
              const Text('Articles',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade200),
                    borderRadius: BorderRadius.circular(10)),
                child: Column(
                  children: [
                    for (var i = 0; i < detail.items.length; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 9),
                        decoration: BoxDecoration(
                            border: i == 0
                                ? null
                                : Border(
                                    top: BorderSide(
                                        color: Colors.grey.shade100))),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (detail.items[i].productImageUrl != null) ...[
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: Image.network(
                                  detail.items[i].productImageUrl!,
                                  width: 36,
                                  height: 36,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      const SizedBox(width: 36, height: 36),
                                ),
                              ),
                              const SizedBox(width: 10),
                            ],
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(detail.items[i].productName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 13)),
                                  if (detail.items[i].reference != null)
                                    Text('Réf. ${detail.items[i].reference}',
                                        style: TextStyle(
                                            fontSize: 10.5,
                                            color: Colors.grey.shade400)),
                                  Text(
                                    '${detail.items[i].quantity} × ${formatGNF(detail.items[i].purchasePrice)} (achat)',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade500),
                                  ),
                                  if (canReceive &&
                                      detail.order.supplierType == 'PLATFORM')
                                    Padding(
                                      padding: const EdgeInsets.only(top: 6),
                                      child: Row(
                                        children: [
                                          Text('Prix de vente',
                                              style: TextStyle(
                                                  fontSize: 11,
                                                  color: Colors.grey.shade500)),
                                          const SizedBox(width: 8),
                                          SizedBox(
                                            width: 90,
                                            height: 32,
                                            child: TextField(
                                              controller:
                                                  _sellingPriceControllers[
                                                      detail.items[i].id],
                                              keyboardType: const TextInputType
                                                  .numberWithOptions(
                                                  decimal: false),
                                              style:
                                                  const TextStyle(fontSize: 12),
                                              decoration: const InputDecoration(
                                                isDense: true,
                                                contentPadding:
                                                    EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 6),
                                                border: OutlineInputBorder(),
                                                suffixText: 'GNF',
                                                suffixStyle:
                                                    TextStyle(fontSize: 10),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                                formatGNF(detail.items[i].quantity *
                                    detail.items[i].purchasePrice),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('Total',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const Spacer(),
                  Text(formatGNF(detail.order.totalAmount),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                ],
              ),
              if (waitingOnSupplier) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(10)),
                  child: Text(
                    "En attente que le fournisseur confirme l'expédition de cette commande.",
                    style:
                        TextStyle(fontSize: 12.5, color: Colors.amber.shade900),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  if (canReceive)
                    OutlinedButton(
                      onPressed: _busy ? null : _handleReceive,
                      style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.green.shade700,
                          side: BorderSide(color: Colors.green.shade200)),
                      child: Text(_busy ? 'Traitement...' : 'Marquer reçue'),
                    ),
                  if (canCancel)
                    OutlinedButton(
                      onPressed: _busy ? null : _handleCancel,
                      style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red.shade700,
                          side: BorderSide(color: Colors.red.shade200)),
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
      decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 9,
                  color: Colors.grey.shade500,
                  letterSpacing: 0.3)),
          const SizedBox(height: 2),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
