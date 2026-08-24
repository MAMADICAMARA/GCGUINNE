import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/order_models.dart';
import '../../data/orders_api.dart';

/// Miroir de ReturnOrderModal.jsx — retour total ou partiel, article par
/// article. Chaque article est envoyé séquentiellement (une seule route
/// existante par article) — jamais en parallèle, le statut de la commande
/// est recalculé côté serveur à chaque appel à partir de l'état courant.
///
/// Retourne `true` si au moins un retour a été confirmé.
Future<bool?> showReturnOrderSheet(BuildContext context, {required int orderId, required List<OrderItemDetail> items}) {
  final returnable = items.where((item) => item.availableToReturn > 0).toList();
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ReturnOrderSheet(orderId: orderId, returnableItems: returnable),
  );
}

class _ReturnOrderSheet extends StatefulWidget {
  const _ReturnOrderSheet({required this.orderId, required this.returnableItems});

  final int orderId;
  final List<OrderItemDetail> returnableItems;

  @override
  State<_ReturnOrderSheet> createState() => _ReturnOrderSheetState();
}

class _ReturnOrderSheetState extends State<_ReturnOrderSheet> {
  String _mode = 'ALL'; // 'ALL' | 'PARTIAL'
  final Map<int, int> _partialQuantities = {};
  String? _error;
  bool _submitting = false;

  num get _allTotal => widget.returnableItems.fold(0, (sum, item) => sum + item.availableToReturn * item.unitPrice);

  num get _partialTotal => widget.returnableItems.fold(0, (sum, item) {
        final qty = (_partialQuantities[item.id] ?? 0).clamp(0, item.availableToReturn);
        return sum + qty * item.unitPrice;
      });

  Future<void> _submit() async {
    setState(() => _error = null);

    final toReturn = <MapEntry<int, int>>[];
    if (_mode == 'ALL') {
      for (final item in widget.returnableItems) {
        toReturn.add(MapEntry(item.id, item.availableToReturn));
      }
    } else {
      for (final item in widget.returnableItems) {
        final qty = (_partialQuantities[item.id] ?? 0).clamp(0, item.availableToReturn);
        if (qty > 0) toReturn.add(MapEntry(item.id, qty));
      }
    }

    if (toReturn.isEmpty) {
      setState(() => _error = 'Choisissez au moins une quantité à retourner.');
      return;
    }

    final ordersApi = context.read<OrdersApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirmer le retour ?'),
        content: Text(
          'Retourner ${toReturn.length} article(s) ? Le stock sera remis, et la dette éventuelle du client sera réduite en conséquence. Cette action est irréversible.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Confirmer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      for (final entry in toReturn) {
        // Séquentiel et volontaire — voir le commentaire en tête de fichier.
        // ignore: avoid_slow_async_io
        await ordersApi.returnItem(orderId: widget.orderId, itemId: entry.key, returnedQty: entry.value);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (err) {
      setState(() => _error = "${err.message} — certains articles ont peut-être déjà été retournés avant l'erreur.");
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(
            children: [
              const Text('Retourner des articles', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: [
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                        child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: _ModeButton(label: 'Tout retourner', selected: _mode == 'ALL', onTap: () => setState(() => _mode = 'ALL')),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _ModeButton(label: 'Retour partiel', selected: _mode == 'PARTIAL', onTap: () => setState(() => _mode = 'PARTIAL')),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
                      child: Column(
                        children: [
                          for (var i = 0; i < widget.returnableItems.length; i++)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: Colors.grey.shade100))),
                              child: _mode == 'ALL'
                                  ? Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(child: Text(widget.returnableItems[i].productName, style: const TextStyle(fontSize: 13))),
                                        Text(
                                          '${widget.returnableItems[i].availableToReturn} × ${formatGNF(widget.returnableItems[i].unitPrice)}',
                                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                        ),
                                      ],
                                    )
                                  : Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(child: Text(widget.returnableItems[i].productName, style: const TextStyle(fontSize: 13))),
                                            Text('Disponible : ${widget.returnableItems[i].availableToReturn}', style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500)),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        TextField(
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(hintText: '0', isDense: true, border: OutlineInputBorder()),
                                          onChanged: (value) => setState(() => _partialQuantities[widget.returnableItems[i].id] = int.tryParse(value) ?? 0),
                                        ),
                                      ],
                                    ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        const Text('Valeur retournée', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        const Spacer(),
                        Text(formatGNF(_mode == 'ALL' ? _allTotal : _partialTotal), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(backgroundColor: Colors.amber.shade700, minimumSize: const Size.fromHeight(46)),
                      child: Text(_submitting ? 'Traitement...' : 'Confirmer le retour'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton(
                    onPressed: _submitting ? null : () => Navigator.of(context).pop(false),
                    child: const Text('Annuler'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? Colors.amber.shade50 : Colors.white,
          border: Border.all(color: selected ? Colors.amber.shade400 : Colors.grey.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: selected ? Colors.amber.shade800 : Colors.grey.shade600)),
      ),
    );
  }
}
