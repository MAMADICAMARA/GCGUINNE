import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/pos_models.dart';
import '../sales/invoice_pdf_share.dart';

/// Miroir de ReceiptModal.jsx — affiche le reçu texte renvoyé par le
/// serveur et propose de le partager (miroir du bouton "Partager", Web
/// Share API côté web — usage visé : envoyer le reçu par WhatsApp
/// directement depuis la caisse), ainsi que la Facture PDF formelle (§
/// cahier des charges "Facture PDF") via [shareInvoicePdf].
Future<void> showReceiptSheet(BuildContext context, OrderResult order) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    builder: (context) => _ReceiptSheet(order: order),
  );
}

class _ReceiptSheet extends StatefulWidget {
  const _ReceiptSheet({required this.order});

  final OrderResult order;

  @override
  State<_ReceiptSheet> createState() => _ReceiptSheetState();
}

class _ReceiptSheetState extends State<_ReceiptSheet> {
  bool _downloadingInvoice = false;

  OrderResult get order => widget.order;

  Future<void> _handleDownloadInvoice() async {
    setState(() => _downloadingInvoice = true);
    await shareInvoicePdf(context,
        orderId: order.orderId, orderNumber: order.orderNumber);
    if (mounted) setState(() => _downloadingInvoice = false);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      // SafeArea(top: false) — § décidé en conversation, même correctif que
      // pos_page.dart#_showCartSheet : particulièrement important ici, la
      // feuille est non-fermable au balayage/tap extérieur (isDismissible:
      // false), donc un bouton "Fermer" masqué piégerait l'utilisateur.
      builder: (context, scrollController) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const Text('Vente validée',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(8)),
                    child: Text(order.receiptText,
                        style: const TextStyle(
                            fontFamily: 'monospace', fontSize: 12)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed:
                      _downloadingInvoice ? null : _handleDownloadInvoice,
                  child: Text(_downloadingInvoice
                      ? 'Génération...'
                      : 'Télécharger la facture (PDF)'),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Share.share(order.receiptText,
                          subject: 'Reçu ${order.orderNumber}'),
                      child: const Text('Partager'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Fermer'),
                    ),
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
