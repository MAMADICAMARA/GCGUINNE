import 'package:flutter/material.dart';

import '../../../../core/utils/formatters.dart';
import '../../data/pos_models.dart';

const _paymentLabels = {
  'CASH': 'Espèces',
  'MOBILE_MONEY': 'Mobile Money',
  'CARD': 'Carte',
  'OTHER': 'Autre',
};

/// Miroir de OrderSummaryModal.jsx — dernière étape avant l'appel réel à
/// l'API : récapitulatif complet + choix du montant payé (total ou
/// partiel). Le paiement partiel exige un client identifié (revérifié
/// aussi côté serveur) — la différence devient une dette suivie sur sa
/// fiche.
///
/// Retourne le montant payé si l'utilisateur confirme, `null` s'il annule.
Future<num?> showOrderSummarySheet(
  BuildContext context, {
  required List<CartItem> cart,
  required num subtotal,
  required num discountAmount,
  required num taxAmount,
  required num total,
  required String paymentMethod,
  required SelectedCustomer? customer,
}) {
  return showModalBottomSheet<num>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _OrderSummarySheet(
      cart: cart,
      subtotal: subtotal,
      discountAmount: discountAmount,
      taxAmount: taxAmount,
      total: total,
      paymentMethod: paymentMethod,
      customer: customer,
    ),
  );
}

class _OrderSummarySheet extends StatefulWidget {
  const _OrderSummarySheet({
    required this.cart,
    required this.subtotal,
    required this.discountAmount,
    required this.taxAmount,
    required this.total,
    required this.paymentMethod,
    required this.customer,
  });

  final List<CartItem> cart;
  final num subtotal;
  final num discountAmount;
  final num taxAmount;
  final num total;
  final String paymentMethod;
  final SelectedCustomer? customer;

  @override
  State<_OrderSummarySheet> createState() => _OrderSummarySheetState();
}

class _OrderSummarySheetState extends State<_OrderSummarySheet> {
  String _paymentMode = 'TOTAL'; // 'TOTAL' | 'PARTIAL'
  late final TextEditingController _amountController =
      TextEditingController(text: widget.total.toStringAsFixed(0));

  num get _amountPaid {
    if (_paymentMode == 'TOTAL') return widget.total;
    final parsed = num.tryParse(_amountController.text) ?? 0;
    return parsed.clamp(0, widget.total);
  }

  num get _remaining => widget.total - _amountPaid;
  bool get _isPartial => _remaining > 0;
  bool get _hasIdentifiedCustomer => widget.customer?.isIdentified ?? false;
  bool get _canConfirm => !_isPartial || _hasIdentifiedCustomer;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _selectMode(String mode) {
    setState(() {
      _paymentMode = mode;
      if (mode == 'TOTAL') _amountController.text = widget.total.toStringAsFixed(0);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const Text('Récapitulatif de la vente', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const Text('Vérifiez avant de confirmer.', style: TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _LabeledValue(
                            label: 'Client',
                            value: widget.customer?.name ?? 'Client anonyme',
                          ),
                        ),
                        Expanded(
                          child: _LabeledValue(
                            label: 'Paiement',
                            value: _paymentLabels[widget.paymentMethod] ?? widget.paymentMethod,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Text('Articles', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 6),
                    Container(
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
                      child: Column(
                        children: [
                          for (final item in widget.cart)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.productName, style: const TextStyle(fontSize: 13)),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text('${item.quantity} × ${formatGNF(item.unitPrice)}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(formatGNF(item.lineTotal), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    _totalsRow('Sous-total', formatGNF(widget.subtotal)),
                    _totalsRow('Réduction', '-${formatGNF(widget.discountAmount)}'),
                    _totalsRow('Taxe', '+${formatGNF(widget.taxAmount)}'),
                    const Divider(),
                    _totalsRow('TOTAL', formatGNF(widget.total), bold: true),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Paiement', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: ChoiceChip(
                                  label: const Text('Total'),
                                  selected: _paymentMode == 'TOTAL',
                                  onSelected: (_) => _selectMode('TOTAL'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: ChoiceChip(
                                  label: const Text('Partiel'),
                                  selected: _paymentMode == 'PARTIAL',
                                  onSelected: (_) => _selectMode('PARTIAL'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _amountController,
                            enabled: _paymentMode == 'PARTIAL',
                            keyboardType: TextInputType.number,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(labelText: 'Montant donné', border: OutlineInputBorder()),
                          ),
                          if (_paymentMode == 'PARTIAL') ...[
                            const SizedBox(height: 8),
                            Text('Reste à payer : ${formatGNF(_remaining)}',
                                style: TextStyle(color: Colors.amber.shade800, fontWeight: FontWeight.w600, fontSize: 13)),
                            const SizedBox(height: 4),
                            if (!_hasIdentifiedCustomer)
                              const Text(
                                'Un paiement partiel nécessite un client identifié — revenez à l\'étape précédente pour en choisir ou en créer un.',
                                style: TextStyle(color: Colors.red, fontSize: 11),
                              )
                            else
                              Text(
                                'Cette dette sera enregistrée sur la fiche de ${widget.customer!.name}.',
                                style: const TextStyle(color: Colors.grey, fontSize: 11),
                              ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _canConfirm ? () => Navigator.of(context).pop(_amountPaid) : null,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: const Text('Confirmer la vente'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _totalsRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: bold ? 14 : 12.5, fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: bold ? Colors.black87 : Colors.grey.shade600)),
          const Spacer(),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: bold ? 14 : 12.5, fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: bold ? Colors.black87 : Colors.grey.shade600)),
        ],
      ),
    );
  }
}

class _LabeledValue extends StatelessWidget {
  const _LabeledValue({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: TextStyle(fontSize: 10, color: Colors.grey.shade500, letterSpacing: 0.5)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      ],
    );
  }
}
