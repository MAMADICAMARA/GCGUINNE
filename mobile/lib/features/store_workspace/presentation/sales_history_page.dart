import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/auth_state.dart';
import '../data/order_models.dart';
import '../data/orders_api.dart';
import 'sales/order_detail_sheet.dart';

const _kPageLimit = 20;

/// Miroir de SalesHistoryPage.jsx — visible en permanence pour l'Owner ;
/// pour un Vendeur, visible seulement si autorisé à annuler/retourner
/// (AuthState.canVoidReturn, filtré dans store_nav_items.dart#navForRole).
class SalesHistoryPage extends StatefulWidget {
  const SalesHistoryPage({super.key});

  @override
  State<SalesHistoryPage> createState() => _SalesHistoryPageState();
}

class _SalesHistoryPageState extends State<SalesHistoryPage> {
  OrderListResult? _result;
  bool _loading = true;
  String? _error;

  int _page = 1;
  String? _status;
  DateTime? _startDate;
  DateTime? _endDate;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _isoDate(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<OrdersApi>().list(
            page: _page,
            limit: _kPageLimit,
            status: _status,
            startDate: _startDate != null ? _isoDate(_startDate!) : null,
            endDate: _endDate != null ? _isoDate(_endDate!) : null,
          );
      if (!mounted) return;
      setState(() {
        _result = result;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loading = false;
      });
    }
  }

  void _applyChange(VoidCallback change) {
    setState(() {
      change();
      _page = 1;
    });
    _load();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _startDate : _endDate) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    _applyChange(() {
      if (isStart) {
        _startDate = picked;
      } else {
        _endDate = picked;
      }
    });
  }

  Future<void> _openDetail(int orderId) async {
    final changed = await showOrderDetailSheet(context, orderId);
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = context.watch<AuthState>().activeStore?.roleCode == 'OWNER';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text(
            isOwner ? 'Toutes les ventes enregistrées dans cette boutique.' : 'Vos ventes enregistrées dans cette boutique.',
            style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickDate(isStart: true),
                  icon: const Icon(Icons.calendar_today_outlined, size: 15),
                  label: Text(_startDate != null ? formatDate(_startDate) : 'Depuis', style: const TextStyle(fontSize: 12)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickDate(isStart: false),
                  icon: const Icon(Icons.calendar_today_outlined, size: 15),
                  label: Text(_endDate != null ? formatDate(_endDate) : "Jusqu'au", style: const TextStyle(fontSize: 12)),
                ),
              ),
              if (_startDate != null || _endDate != null)
                IconButton(
                  tooltip: 'Effacer les dates',
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => _applyChange(() {
                    _startDate = null;
                    _endDate = null;
                  }),
                ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _StatusChip(label: 'Tous', selected: _status == null, onTap: () => _applyChange(() => _status = null)),
                for (final entry in kOrderStatusLabels.entries) ...[
                  const SizedBox(width: 6),
                  _StatusChip(label: entry.value, selected: _status == entry.key, onTap: () => _applyChange(() => _status = entry.key)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Padding(padding: const EdgeInsets.only(top: 24), child: Text(_error!, style: const TextStyle(color: Colors.red)))
          else if (_result == null || _result!.orders.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Column(
                children: [
                  Icon(Icons.receipt_long_outlined, size: 40, color: Colors.grey.shade300),
                  const SizedBox(height: 10),
                  Text('Aucune vente trouvée pour ces filtres.', style: TextStyle(color: Colors.grey.shade500)),
                ],
              ),
            )
          else ...[
            for (final order in _result!.orders)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _OrderCard(order: order, onTap: () => _openDetail(order.id)),
              ),
            const SizedBox(height: 4),
            _Pagination(
              page: _result!.page,
              pages: _result!.pages,
              total: _result!.total,
              onPrevious: _result!.page > 1 ? () => _goToPage(_result!.page - 1) : null,
              onNext: _result!.page < _result!.pages ? () => _goToPage(_result!.page + 1) : null,
            ),
          ],
        ],
      ),
    );
  }

  void _goToPage(int page) {
    setState(() => _page = page);
    _load();
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(label: Text(label, style: const TextStyle(fontSize: 12)), selected: selected, onSelected: (_) => onTap());
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, required this.onTap});

  final OrderSummary order;
  final VoidCallback onTap;

  Color _statusColor() {
    switch (order.status) {
      case 'PAID':
        return Colors.green.shade700;
      case 'VOIDED':
        return Colors.red.shade700;
      default:
        return Colors.amber.shade800;
    }
  }

  Color _statusBg() {
    switch (order.status) {
      case 'PAID':
        return Colors.green.shade50;
      case 'VOIDED':
        return Colors.red.shade50;
      default:
        return Colors.amber.shade50;
    }
  }

  Color _paymentStatusColor() {
    switch (order.paymentStatus) {
      case 'PAID':
        return Colors.green.shade700;
      case 'PARTIALLY_PAID':
        return Colors.amber.shade800;
      default:
        return Colors.red.shade700;
    }
  }

  Color _paymentStatusBg() {
    switch (order.paymentStatus) {
      case 'PAID':
        return Colors.green.shade50;
      case 'PARTIALLY_PAID':
        return Colors.amber.shade50;
      default:
        return Colors.red.shade50;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(order.orderNumber, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Theme.of(context).colorScheme.primary)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: _statusBg(), borderRadius: BorderRadius.circular(20)),
                  child: Text(kOrderStatusLabels[order.status] ?? order.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor())),
                ),
              ],
            ),
            Text(formatDateTime(order.createdAt), style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(height: 6),
            Text(
              '${order.customerName ?? 'Anonyme'} · ${order.sellerName ?? '—'} · ${kPaymentMethodLabels[order.paymentMethod] ?? order.paymentMethod}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: _paymentStatusBg(), borderRadius: BorderRadius.circular(20)),
                    child: Text(
                      kPaymentStatusLabels[order.paymentStatus] ?? order.paymentStatus,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _paymentStatusColor()),
                    ),
                  ),
                ),
                const Spacer(),
                Text(formatGNF(order.totalAmount), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({required this.page, required this.pages, required this.total, required this.onPrevious, required this.onNext});

  final int page;
  final int pages;
  final int total;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        TextButton.icon(onPressed: onPrevious, icon: const Icon(Icons.chevron_left, size: 18), label: const Text('Précédent')),
        Expanded(
          child: Text(
            'Page $page / $pages ($total ventes)',
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
          ),
        ),
        TextButton.icon(onPressed: onNext, icon: const Icon(Icons.chevron_right, size: 18), label: const Text('Suivant'), iconAlignment: IconAlignment.end),
      ],
    );
  }
}
