import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../store_workspace/data/dashboard_models.dart';
import '../../store_workspace/data/order_models.dart';
import '../../store_workspace/data/pos_models.dart';
import '../../store_workspace/data/product_detail_models.dart';
import '../../store_workspace/data/sales_report_models.dart';
import '../data/supervision_api.dart';
import 'audit_log_panel.dart';

/// Miroir de SupervisedStoreDetailPage.jsx — détail en lecture stricte
/// d'une boutique supervisée. Aucune action possible nulle part sur cette
/// page (décidé en conversation, règle absolue) : uniquement des données
/// déjà exposées en lecture par /supervision/stores/:storeId/*.
class SupervisedStoreDetailPage extends StatefulWidget {
  const SupervisedStoreDetailPage({super.key, required this.storeId});

  final int storeId;

  @override
  State<SupervisedStoreDetailPage> createState() => _SupervisedStoreDetailPageState();
}

class _SupervisedStoreDetailPageState extends State<SupervisedStoreDetailPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  String? _storeName;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadStoreName();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadStoreName() async {
    try {
      final result = await context.read<SupervisionApi>().getStats(widget.storeId);
      if (mounted) setState(() => _storeName = result.storeName);
    } on ApiException catch (_) {
      // Le titre reste générique si la requête échoue — chaque onglet
      // affiche de toute façon sa propre erreur d'accès le cas échéant.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_storeName ?? 'Boutique supervisée'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Aperçu'),
            Tab(text: 'Recette'),
            Tab(text: 'Produits & Stock'),
            Tab(text: 'Historique des ventes'),
            Tab(text: 'Journal'),
          ],
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.amber.shade50,
            child: Text(
              'Vue en lecture seule stricte — aucune action possible depuis cette page.',
              style: TextStyle(fontSize: 11.5, color: Colors.amber.shade900),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _OverviewTab(storeId: widget.storeId),
                _RecetteTab(storeId: widget.storeId),
                _ProductsStockTab(storeId: widget.storeId),
                _SalesTab(storeId: widget.storeId),
                AuditLogPanel(
                  fetchPage: ({required page, action, required includeLogins}) =>
                      context.read<SupervisionApi>().getAuditLog(
                            widget.storeId,
                            page: page,
                            action: action,
                            includeLogins: includeLogins,
                          ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OverviewTab extends StatefulWidget {
  const _OverviewTab({required this.storeId});
  final int storeId;

  @override
  State<_OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends State<_OverviewTab> {
  DateTime _date = DateTime.now();
  DashboardStats? _stats;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _isoDate =>
      '${_date.year.toString().padLeft(4, '0')}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      _stats = null;
      _error = null;
    });
    try {
      final result = await context.read<SupervisionApi>().getStats(widget.storeId, date: _isoDate);
      if (mounted) setState(() => _stats = result.stats);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _date = picked);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final stats = _stats;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Text('Date : ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.calendar_today_outlined, size: 15),
              label: Text(formatDate(_date), style: const TextStyle(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_error != null)
          Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: Colors.red)))
        else if (stats == null)
          const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
        else
          _buildOverviewContent(context, stats),
      ],
    );
  }

  Widget _buildOverviewContent(BuildContext context, DashboardStats stats) {
    final maxTrend = stats.revenueTrend.fold<num>(1, (max, p) => p.revenue > max ? p.revenue : max);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 2.2,
          children: [
            _StatCard(label: 'Ventes du jour', value: formatGNF(stats.todayRevenue)),
            _StatCard(label: 'Bénéfice du jour', value: formatGNF(stats.todayProfit), color: Colors.green.shade700),
            _StatCard(label: 'Commandes', value: '${stats.todayOrdersCount}'),
            _StatCard(
              label: 'Produits en rupture',
              value: '${stats.lowStockCount}',
              color: stats.lowStockCount > 0 ? Colors.red.shade600 : null,
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text('Évolution des ventes (7 derniers jours)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        const SizedBox(height: 12),
        if (stats.revenueTrend.isEmpty)
          Padding(padding: const EdgeInsets.only(bottom: 16), child: Text('Aucune vente sur cette période.', style: TextStyle(color: Colors.grey.shade400)))
        else
          SizedBox(
            height: 110,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final point in stats.revenueTrend)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Tooltip(
                            message: formatGNF(point.revenue),
                            child: FractionallySizedBox(
                              heightFactor: (point.revenue / maxTrend).clamp(0.04, 1).toDouble(),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.75),
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Builder(builder: (context) {
                            final label = formatDate(point.day);
                            return Text(
                              label.length >= 5 ? label.substring(0, 5) : label,
                              style: TextStyle(fontSize: 9, color: Colors.grey.shade400),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 20),
        const Text('Produits les plus vendus (30 derniers jours)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        const SizedBox(height: 10),
        if (stats.topProducts.isEmpty)
          Text('Aucune vente sur cette période.', style: TextStyle(color: Colors.grey.shade400))
        else
          for (var i = 0; i < stats.topProducts.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Text('#${i + 1}', style: TextStyle(color: Colors.grey.shade400, fontSize: 12.5)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(stats.topProducts[i].name, style: const TextStyle(fontSize: 13))),
                  Text('${stats.topProducts[i].totalSold} vendus', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                ],
              ),
            ),
      ],
    );
  }
}

/// Onglet RECETTE (§ décidé en conversation, ajouté en plus de l'historique
/// des ventes, jamais à sa place) — miroir de SalesReportPage.jsx /
/// sales_report_page.dart : recette totale + détail par produit sur une
/// période choisie (plage de dates, pas un jour unique comme l'onglet
/// Historique des ventes juste à côté).
class _RecetteTab extends StatefulWidget {
  const _RecetteTab({required this.storeId});
  final int storeId;

  @override
  State<_RecetteTab> createState() => _RecetteTabState();
}

class _RecetteTabState extends State<_RecetteTab> {
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  SalesReport? _report;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final report = await context.read<SupervisionApi>().getSalesReport(
            widget.storeId,
            startDate: _isoDate(_startDate),
            endDate: _isoDate(_endDate),
          );
      if (!mounted) return;
      setState(() {
        _report = report;
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

  void _setQuickRange(int days) {
    final end = DateTime.now();
    final start = end.subtract(Duration(days: days - 1));
    setState(() {
      _startDate = start;
      _endDate = end;
    });
    _load();
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime(2020),
      lastDate: _endDate,
    );
    if (picked == null) return;
    setState(() => _startDate = picked);
    _load();
  }

  Future<void> _pickEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate,
      firstDate: _startDate,
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _endDate = picked);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          "Chiffre d'affaires total de la boutique, produit par produit, sur la période choisie.",
          style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _pickStartDate,
                icon: const Icon(Icons.calendar_today_outlined, size: 15),
                label: Text(formatDate(_startDate), style: const TextStyle(fontSize: 12)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _pickEndDate,
                icon: const Icon(Icons.calendar_today_outlined, size: 15),
                label: Text(formatDate(_endDate), style: const TextStyle(fontSize: 12)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _QuickRangeChip(label: "Aujourd'hui", onTap: () => _setQuickRange(1)),
            const SizedBox(width: 6),
            _QuickRangeChip(label: '7 jours', onTap: () => _setQuickRange(7)),
            const SizedBox(width: 6),
            _QuickRangeChip(label: '30 jours', onTap: () => _setQuickRange(30)),
          ],
        ),
        const SizedBox(height: 16),
        if (_error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
            child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            color: primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: primary.withValues(alpha: 0.15)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                child: Icon(Icons.trending_up, color: primary, size: 22),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('RECETTE TOTALE', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: primary)),
                  const SizedBox(height: 2),
                  Text(
                    _loading ? '...' : formatGNF(_report?.totalRevenue ?? 0),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('Détail par produit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        const SizedBox(height: 10),
        if (_loading)
          const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
        else if (_report == null || _report!.products.isEmpty)
          const _EmptyBox(text: 'Aucune vente sur cette période.')
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _report!.products.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_report!.products[i].productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(
                                '${_report!.products[i].quantitySold} vendu${_report!.products[i].quantitySold > 1 ? 's' : ''}',
                                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                              ),
                            ],
                          ),
                        ),
                        Text(formatGNF(_report!.products[i].revenue), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _QuickRangeChip extends StatelessWidget {
  const _QuickRangeChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
      child: Text(label, style: const TextStyle(fontSize: 11.5)),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 9.5, color: Colors.grey.shade400)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color ?? Colors.grey.shade800)),
        ],
      ),
    );
  }
}

class _ProductsStockTab extends StatefulWidget {
  const _ProductsStockTab({required this.storeId});
  final int storeId;

  @override
  State<_ProductsStockTab> createState() => _ProductsStockTabState();
}

class _ProductsStockTabState extends State<_ProductsStockTab> {
  List<Product>? _products;
  List<StockMovement>? _movements;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<SupervisionApi>();
      final results = await Future.wait([
        api.getProducts(widget.storeId, limit: 100),
        api.getStockMovements(widget.storeId, limit: 50),
      ]);
      if (!mounted) return;
      setState(() {
        _products = results[0] as List<Product>;
        _movements = results[1] as List<StockMovement>;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Padding(padding: const EdgeInsets.all(16), child: Text(_error!, style: const TextStyle(color: Colors.red)));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Catalogue produits', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        const SizedBox(height: 10),
        if (_products == null)
          const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
        else if (_products!.isEmpty)
          const _EmptyBox(text: "Aucun produit pour l'instant.")
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _products!.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _ProductRow(product: _products![i]),
                ],
              ],
            ),
          ),
        const SizedBox(height: 24),
        const Text('Mouvements de stock récents', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        const SizedBox(height: 10),
        if (_movements == null)
          const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
        else if (_movements!.isEmpty)
          const _EmptyBox(text: "Aucun mouvement pour l'instant.")
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _movements!.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _MovementRow(movement: _movements![i]),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade300)),
      child: Center(child: Text(text, style: TextStyle(color: Colors.grey.shade400, fontSize: 12.5))),
    );
  }
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final lowStock = product.quantity <= product.lowStockThreshold;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 2),
                Text(
                  'Achat ${formatGNF(product.purchasePrice)} · Vente ${formatGNF(product.sellingPrice)}',
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                ),
              ],
            ),
          ),
          Text(
            'Stock : ${product.quantity}',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: lowStock ? Colors.red.shade600 : Colors.grey.shade700),
          ),
        ],
      ),
    );
  }
}

class _MovementRow extends StatelessWidget {
  const _MovementRow({required this.movement});
  final StockMovement movement;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(movement.productName ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                const SizedBox(height: 2),
                Text('${movement.label} · ${formatDateTime(movement.createdAt)}', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
              ],
            ),
          ),
          Text('${movement.quantity}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        ],
      ),
    );
  }
}

class _SalesTab extends StatefulWidget {
  const _SalesTab({required this.storeId});
  final int storeId;

  @override
  State<_SalesTab> createState() => _SalesTabState();
}

class _SalesTabState extends State<_SalesTab> {
  DateTime _date = DateTime.now();
  List<OrderSummary>? _orders;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _isoDate =>
      '${_date.year.toString().padLeft(4, '0')}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      _orders = null;
      _error = null;
    });
    try {
      final orders = await context.read<SupervisionApi>().getOrders(widget.storeId, date: _isoDate);
      if (!mounted) return;
      setState(() => _orders = orders);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _date = picked);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Text('Date : ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.calendar_today_outlined, size: 15),
              label: Text(formatDate(_date), style: const TextStyle(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (_error != null)
          Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: Colors.red)))
        else if (_orders == null)
          const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
        else if (_orders!.isEmpty)
          const _EmptyBox(text: 'Aucune vente ce jour-là.')
        else
          for (final order in _orders!)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _SupervisedOrderCard(
                order: order,
                onTap: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => _SupervisedOrderDetailSheet(storeId: widget.storeId, orderId: order.id),
                ),
              ),
            ),
      ],
    );
  }
}

class _SupervisedOrderCard extends StatelessWidget {
  const _SupervisedOrderCard({required this.order, required this.onTap});
  final OrderSummary order;
  final VoidCallback onTap;

  Color _paymentColor() {
    switch (order.paymentStatus) {
      case 'PAID':
        return Colors.green.shade700;
      case 'PARTIALLY_PAID':
        return Colors.amber.shade800;
      default:
        return Colors.red.shade700;
    }
  }

  Color _paymentBg() {
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
                  decoration: BoxDecoration(color: _paymentBg(), borderRadius: BorderRadius.circular(20)),
                  child: Text(kPaymentStatusLabels[order.paymentStatus] ?? order.paymentStatus, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _paymentColor())),
                ),
              ],
            ),
            Text('${order.customerName ?? 'Anonyme'} · ${formatDateTime(order.createdAt)}', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(height: 8),
            Row(
              children: [
                if (order.remaining > 0)
                  Text('Reste : ${formatGNF(order.remaining)}', style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                const Spacer(),
                Text(formatGNF(order.totalAmount), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SupervisedOrderDetailSheet extends StatefulWidget {
  const _SupervisedOrderDetailSheet({required this.storeId, required this.orderId});
  final int storeId;
  final int orderId;

  @override
  State<_SupervisedOrderDetailSheet> createState() => _SupervisedOrderDetailSheetState();
}

class _SupervisedOrderDetailSheetState extends State<_SupervisedOrderDetailSheet> {
  OrderDetail? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await context.read<SupervisionApi>().getOrder(widget.storeId, widget.orderId);
      if (mounted) setState(() => _detail = detail);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          const Text('Détail de la vente', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 16),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red))
          else if (_detail == null)
            const Padding(padding: EdgeInsets.symmetric(vertical: 30), child: Center(child: CircularProgressIndicator()))
          else ...[
            Text('Client', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            Text(_detail!.customerName ?? 'Anonyme', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 14),
            for (final item in _detail!.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(child: Text('${item.productName} × ${item.quantity}', style: const TextStyle(fontSize: 13))),
                    Text(formatGNF(item.unitPrice * item.quantity), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  ],
                ),
              ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total', style: TextStyle(color: Colors.grey.shade500)),
                Text(formatGNF(_detail!.totalAmount), style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Payé', style: TextStyle(color: Colors.grey.shade500)),
                Text(formatGNF(_detail!.amountPaid)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
