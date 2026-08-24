import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/customer_models.dart';
import '../../data/customers_api.dart';

const _kPaymentStatusLabels = {'PAID': 'Total', 'PARTIALLY_PAID': 'Partiel', 'PENDING': 'Non payé'};

/// Miroir de CustomerHistoryModal.jsx — historique complet des achats d'un
/// client, plus la traçabilité de chaque paiement encaissé.
void showCustomerHistorySheet(BuildContext context, int customerId) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (context) => _CustomerHistorySheet(customerId: customerId),
  );
}

class _CustomerHistorySheet extends StatefulWidget {
  const _CustomerHistorySheet({required this.customerId});

  final int customerId;

  @override
  State<_CustomerHistorySheet> createState() => _CustomerHistorySheetState();
}

class _CustomerHistorySheetState extends State<_CustomerHistorySheet> {
  CustomerOrderHistory? _history;
  List<CustomerPayment>? _payments;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final customersApi = context.read<CustomersApi>();
      final results = await Future.wait([
        customersApi.getOrderHistory(widget.customerId),
        customersApi.getPayments(widget.customerId),
      ]);
      if (!mounted) return;
      setState(() {
        _history = results[0] as CustomerOrderHistory;
        _payments = results[1] as List<CustomerPayment>;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = _history;
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))
          else if (history == null)
            const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
          else ...[
            Text(history.customer.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Text.rich(
              TextSpan(
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                children: [
                  TextSpan(text: '${history.customer.phone ?? 'Sans téléphone'} · Total dépensé : ${formatGNF(history.customer.totalSpent)}'),
                  if (history.customer.balanceDue > 0)
                    TextSpan(text: ' · Doit ${formatGNF(history.customer.balanceDue)}', style: TextStyle(color: Colors.red.shade600, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_payments != null && _payments!.isNotEmpty) ...[
              Text('PAIEMENTS REÇUS', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.4)),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
                child: Column(
                  children: [
                    for (var i = 0; i < _payments!.length; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: Colors.grey.shade100))),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(_payments![i].sellerName ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
                                  Text(formatDateTime(_payments![i].createdAt), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade400)),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(formatGNF(_payments![i].amount), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            if (history.orders.isEmpty)
              Text('Aucun achat enregistré pour ce client.', style: TextStyle(color: Colors.grey.shade500, fontSize: 13))
            else
              for (final order in history.orders)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(12)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(text: order.orderNumber, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Theme.of(context).colorScheme.primary)),
                                    TextSpan(text: '  ${formatDateTime(order.createdAt)}', style: TextStyle(fontSize: 10.5, color: Colors.grey.shade400)),
                                  ],
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: order.paymentStatus == 'PAID' ? Colors.green.shade50 : (order.paymentStatus == 'PARTIALLY_PAID' ? Colors.amber.shade50 : Colors.red.shade50),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                _kPaymentStatusLabels[order.paymentStatus] ?? order.paymentStatus,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  color: order.paymentStatus == 'PAID' ? Colors.green.shade700 : (order.paymentStatus == 'PARTIALLY_PAID' ? Colors.amber.shade800 : Colors.red.shade700),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      for (final item in order.items)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text.rich(
                                  TextSpan(children: [
                                    TextSpan(text: item.productName, style: const TextStyle(fontSize: 12.5)),
                                    TextSpan(text: ' × ${item.quantity}', style: TextStyle(color: Colors.grey.shade400, fontSize: 11.5)),
                                  ]),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Text(formatGNF(item.quantity * item.unitPrice), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                            ],
                          ),
                        ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text('Payé : ${formatGNF(order.amountPaid)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                            ),
                            const SizedBox(width: 8),
                            Text('Total : ${formatGNF(order.totalAmount)}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
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
