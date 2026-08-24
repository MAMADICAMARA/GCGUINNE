import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/cash_drawer_history_models.dart';
import '../../data/cash_drawers_api.dart';

/// Miroir de CashDrawerDetailModal.jsx — liste les ventes en espèces
/// rattachées à la session, pour aider à comprendre un écart précis plutôt
/// que de le constater sans explication.
void showCashDrawerDetailSheet(BuildContext context, int drawerId) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (context) => _CashDrawerDetailSheet(drawerId: drawerId),
  );
}

class _CashDrawerDetailSheet extends StatefulWidget {
  const _CashDrawerDetailSheet({required this.drawerId});

  final int drawerId;

  @override
  State<_CashDrawerDetailSheet> createState() => _CashDrawerDetailSheetState();
}

class _CashDrawerDetailSheetState extends State<_CashDrawerDetailSheet> {
  CashDrawerDetail? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await context.read<CashDrawersApi>().getById(widget.drawerId);
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
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          const Text('Détail de la session de caisse', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
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
                _Info(label: 'Vendeur', value: detail.drawer.userFullName ?? '—'),
                _Info(label: 'Statut', value: detail.drawer.status == 'OPEN' ? 'Ouverte' : 'Fermée'),
                _Info(label: 'Ouverte le', value: formatDateTime(detail.drawer.openingTime)),
                if (detail.drawer.closingTime != null) _Info(label: 'Fermée le', value: formatDateTime(detail.drawer.closingTime)),
                _Info(label: 'Fond de départ', value: formatGNF(detail.drawer.openingBalance)),
                _Info(label: 'Solde théorique', value: formatGNF(detail.drawer.expectedBalance)),
                if (detail.drawer.closingBalance != null) _Info(label: 'Solde compté', value: formatGNF(detail.drawer.closingBalance)),
                if (detail.drawer.discrepancy != null)
                  _Info(
                    label: 'Écart',
                    value: detail.drawer.discrepancy == 0
                        ? 'Aucun'
                        : '${formatGNF(detail.drawer.discrepancy!.abs())} (${detail.drawer.discrepancy! > 0 ? 'excédent' : 'manque'})',
                  ),
              ],
            ),
            if (detail.drawer.note != null && detail.drawer.note!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
                child: Text('Note : ${detail.drawer.note}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ),
            ],
            const SizedBox(height: 16),
            Text('Ventes en espèces de cette session (${detail.orders.length})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 8),
            if (detail.orders.isEmpty)
              Text('Aucune vente en espèces enregistrée durant cette session.', style: TextStyle(fontSize: 13, color: Colors.grey.shade500))
            else
              Container(
                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
                child: Column(
                  children: [
                    for (var i = 0; i < detail.orders.length; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: Colors.grey.shade100))),
                        child: Row(
                          children: [
                            Expanded(child: Text(detail.orders[i].orderNumber, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
                            const SizedBox(width: 8),
                            Text(formatGNF(detail.orders[i].amountPaid), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
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
