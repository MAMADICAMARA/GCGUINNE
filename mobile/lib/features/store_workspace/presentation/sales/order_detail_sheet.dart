import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../state/auth_state.dart';
import '../../data/order_models.dart';
import '../../data/orders_api.dart';
import 'invoice_pdf_share.dart';
import 'return_order_sheet.dart';

/// Miroir de OrderDetailModal.jsx — détail d'une vente, avec Annuler/
/// Retourner réservés à l'Owner ou à un Vendeur explicitement autorisé
/// (AuthState.canVoidReturn, cf. §25_autorisation_annulation_retour.sql) —
/// et dans ce dernier cas uniquement sur ses propres ventes, déjà garanti
/// côté backend (un Vendeur ne peut même pas charger la commande d'un
/// collègue).
///
/// Retourne `true` si la commande a été modifiée (annulée/retour), pour
/// que la liste appelante se recharge.
Future<bool?> showOrderDetailSheet(BuildContext context, int orderId) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _OrderDetailSheet(orderId: orderId),
  );
}

class _OrderDetailSheet extends StatefulWidget {
  const _OrderDetailSheet({required this.orderId});

  final int orderId;

  @override
  State<_OrderDetailSheet> createState() => _OrderDetailSheetState();
}

class _OrderDetailSheetState extends State<_OrderDetailSheet> {
  OrderDetail? _detail;
  String? _error;
  bool _voiding = false;
  bool _downloadingInvoice = false;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await context.read<OrdersApi>().getDetail(widget.orderId);
      if (!mounted) return;
      setState(() => _detail = detail);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _handleVoid() async {
    final ordersApi = context.read<OrdersApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Annuler cette vente ?'),
        content: const Text(
          'Le stock des articles sera remis, et la dette éventuelle du client sur cette vente sera annulée. Cette action est irréversible.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Retour')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Annuler la vente'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _voiding = true;
      _error = null;
    });
    try {
      await ordersApi.voidOrder(widget.orderId);
      _changed = true;
      await _load();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _voiding = false);
    }
  }

  Future<void> _handleDownloadInvoice() async {
    setState(() => _downloadingInvoice = true);
    await shareInvoicePdf(context, orderId: widget.orderId, orderNumber: _detail!.orderNumber);
    if (mounted) setState(() => _downloadingInvoice = false);
  }

  Future<void> _openReturn() async {
    if (_detail == null) return;
    final didReturn = await showReturnOrderSheet(context, orderId: widget.orderId, items: _detail!.items);
    if (didReturn == true) {
      _changed = true;
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final isOwner = authState.activeStore?.roleCode == 'OWNER';
    final isAuthorized = isOwner || authState.canVoidReturn;
    final detail = _detail;
    final canAct = isAuthorized && detail != null && detail.status != 'VOIDED' && detail.status != 'RETURNED';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, __) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            const Text('Détail de la vente', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
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
                childAspectRatio: 2.6,
                children: [
                  _Info(label: 'Numéro', value: detail.orderNumber),
                  _Info(label: 'Date', value: formatDateTime(detail.createdAt)),
                  _Info(label: 'Vendeur', value: detail.sellerName ?? '—'),
                  _Info(label: 'Client', value: detail.customerName ?? 'Anonyme'),
                  _Info(label: 'Paiement', value: kPaymentMethodLabels[detail.paymentMethod] ?? detail.paymentMethod),
                  _Info(label: 'Statut', value: kOrderStatusLabels[detail.status] ?? detail.status),
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
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: Colors.grey.shade100))),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(detail.items[i].productName, style: const TextStyle(fontSize: 13)),
                            if (detail.items[i].returnedQuantity > 0)
                              Text('${detail.items[i].returnedQuantity} retourné(s)', style: TextStyle(fontSize: 10.5, color: Colors.amber.shade700)),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '${detail.items[i].quantity} × ${formatGNF(detail.items[i].unitPrice)}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(formatGNF(detail.items[i].quantity * detail.items[i].unitPrice), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              ],
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _totalsLine('Réduction', '-${formatGNF(detail.discountAmount)}'),
              _totalsLine('Taxe', '+${formatGNF(detail.taxAmount)}'),
              const Divider(),
              _totalsLine('Total', formatGNF(detail.totalAmount), bold: true),
              if (detail.amountPaid < detail.totalAmount) ...[
                _totalsLine('Montant payé', formatGNF(detail.amountPaid)),
                _totalsLine('Reste à payer (cette vente)', formatGNF(detail.totalAmount - detail.amountPaid), bold: true, color: Colors.red.shade600),
              ],
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  OutlinedButton(
                    onPressed: _downloadingInvoice ? null : _handleDownloadInvoice,
                    child: Text(_downloadingInvoice ? 'Génération...' : 'Télécharger la facture (PDF)'),
                  ),
                  if (canAct)
                    OutlinedButton(
                      onPressed: _voiding ? null : _handleVoid,
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700, side: BorderSide(color: Colors.red.shade200)),
                      child: Text(_voiding ? 'Annulation...' : 'Annuler la vente'),
                    ),
                  if (canAct && detail.hasReturnableItems)
                    OutlinedButton(
                      onPressed: _openReturn,
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.amber.shade800, side: BorderSide(color: Colors.amber.shade300)),
                      child: const Text('Retourner'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _totalsLine(String label, String value, {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: bold ? 14 : 12.5, fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: color ?? (bold ? Colors.black87 : Colors.grey.shade600))),
          const Spacer(),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: bold ? 14 : 12.5, fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: color ?? (bold ? Colors.black87 : Colors.grey.shade600))),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 9, color: Colors.grey.shade500, letterSpacing: 0.3), maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
