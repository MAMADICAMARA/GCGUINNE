import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/purchases_api.dart';
import '../../data/supplier_models.dart';

/// Miroir de ReceivedOrderDetailModal.jsx — lecture seule stricte, aucune
/// action possible : c'est toujours la boutique cliente (acheteuse) qui
/// contrôle le cycle de vie de sa commande.
void showReceivedOrderDetailSheet(BuildContext context, int orderId) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ReceivedOrderDetailSheet(orderId: orderId),
  );
}

class _ReceivedOrderDetailSheet extends StatefulWidget {
  const _ReceivedOrderDetailSheet({required this.orderId});

  final int orderId;

  @override
  State<_ReceivedOrderDetailSheet> createState() => _ReceivedOrderDetailSheetState();
}

class _ReceivedOrderDetailSheetState extends State<_ReceivedOrderDetailSheet> {
  ReceivedOrderDetail? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await context.read<PurchasesApi>().getReceivedOrder(widget.orderId);
      if (!mounted) return;
      setState(() => _detail = detail);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          const Text("Commande reçue d'un client", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 14),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))
          else if (detail == null)
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
                _Info(label: 'Boutique cliente', value: detail.order.buyerStoreName ?? '—'),
                _Info(label: 'Référence', value: detail.order.reference ?? '—'),
                _Info(label: 'Date de la commande', value: formatDateTime(detail.order.createdAt)),
                _Info(label: 'Statut', value: kReceivedOrderStatusLabels[detail.order.status] ?? detail.order.status),
                if (detail.order.receivedAt != null) _Info(label: 'Stock diminué le', value: formatDateTime(detail.order.receivedAt)),
              ],
            ),
            if (detail.order.status == 'PENDING') ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.amber.shade100)),
                child: Text(
                  'En attente — votre stock ne sera diminué que lorsque la boutique cliente confirmera avoir reçu la livraison.',
                  style: TextStyle(fontSize: 12, color: Colors.amber.shade800),
                ),
              ),
            ],
            const SizedBox(height: 16),
            const Text('Articles commandés', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
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
                          Expanded(child: Text(detail.items[i].productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
                          const SizedBox(width: 8),
                          Text('${detail.items[i].quantity}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
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
