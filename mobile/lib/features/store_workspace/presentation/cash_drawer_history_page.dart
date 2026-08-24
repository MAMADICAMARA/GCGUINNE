import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/auth_state.dart';
import '../data/cash_drawer_history_models.dart';
import '../data/cash_drawers_api.dart';
import '../data/pos_models.dart';
import 'cash_drawers/cash_drawer_detail_sheet.dart';

const _kPageLimit = 20;

/// Miroir de CashDrawerHistoryPage.jsx — le Owner voit toute l'équipe
/// (supervision des écarts) ; un Vendeur ne voit que ses propres sessions
/// (scoping fait côté serveur, même principe que l'historique des ventes).
class CashDrawerHistoryPage extends StatefulWidget {
  const CashDrawerHistoryPage({super.key});

  @override
  State<CashDrawerHistoryPage> createState() => _CashDrawerHistoryPageState();
}

class _CashDrawerHistoryPageState extends State<CashDrawerHistoryPage> {
  CashDrawerListResult? _result;
  bool _loading = true;
  String? _error;
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<CashDrawersApi>().list(page: _page, limit: _kPageLimit);
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

  void _goToPage(int page) {
    setState(() => _page = page);
    _load();
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
            isOwner ? "Sessions de caisse de toute l'équipe." : 'Vos sessions de caisse.',
            style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 14),
          if (_loading)
            const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Padding(padding: const EdgeInsets.only(top: 24), child: Text(_error!, style: const TextStyle(color: Colors.red)))
          else if (_result == null || _result!.drawers.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Column(
                children: [
                  Icon(Icons.account_balance_wallet_outlined, size: 40, color: Colors.grey.shade300),
                  const SizedBox(height: 10),
                  Text('Aucune session de caisse pour l\'instant.', style: TextStyle(color: Colors.grey.shade500)),
                ],
              ),
            )
          else ...[
            for (final drawer in _result!.drawers)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _DrawerCard(drawer: drawer, onTap: () => showCashDrawerDetailSheet(context, drawer.id)),
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
}

class _DrawerCard extends StatelessWidget {
  const _DrawerCard({required this.drawer, required this.onTap});

  final CashDrawer drawer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isOpen = drawer.status == 'OPEN';
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
                Expanded(child: Text(drawer.userFullName ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: isOpen ? Colors.blue.shade50 : Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
                  child: Text(isOpen ? 'Ouverte' : 'Fermée', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: isOpen ? Colors.blue.shade700 : Colors.grey.shade600)),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(formatDateTime(drawer.openingTime), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                      children: [
                        const TextSpan(text: 'Théorique : '),
                        TextSpan(text: formatGNF(drawer.expectedBalance), style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87)),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (drawer.discrepancy != null)
                  Text(
                    'Écart : ${drawer.discrepancy == 0 ? '0' : formatGNF(drawer.discrepancy)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: drawer.discrepancy == 0 ? Colors.green.shade700 : Colors.amber.shade800),
                  ),
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
            'Page $page / $pages ($total session(s))',
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
