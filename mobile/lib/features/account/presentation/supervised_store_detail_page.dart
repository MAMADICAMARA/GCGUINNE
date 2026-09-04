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
  State<SupervisedStoreDetailPage> createState() =>
      _SupervisedStoreDetailPageState();
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
      final result =
          await context.read<SupervisionApi>().getStats(widget.storeId);
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
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.dashboard_outlined, size: 18), text: 'Aperçu'),
            Tab(icon: Icon(Icons.payments_outlined, size: 18), text: 'Recette'),
            Tab(
                icon: Icon(Icons.inventory_2_outlined, size: 18),
                text: 'Produits & Stock'),
            Tab(
                icon: Icon(Icons.receipt_long_outlined, size: 18),
                text: 'Historique des ventes'),
            Tab(icon: Icon(Icons.history, size: 18), text: 'Journal'),
          ],
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              border: Border(bottom: BorderSide(color: Colors.amber.shade100)),
            ),
            child: Row(
              children: [
                Icon(Icons.visibility_outlined,
                    size: 14, color: Colors.amber.shade800),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Vue en lecture seule stricte — aucune action possible depuis cette page.',
                    style: TextStyle(
                        fontSize: 11.5,
                        color: Colors.amber.shade900,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
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
                  fetchPage: (
                          {required page, action, required includeLogins}) =>
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
      final result = await context
          .read<SupervisionApi>()
          .getStats(widget.storeId, date: _isoDate);
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
            const Text('Date : ',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            _DatePillButton(date: _date, onTap: _pickDate),
          ],
        ),
        const SizedBox(height: 18),
        if (_error != null)
          Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)))
        else if (stats == null)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()))
        else
          _buildOverviewContent(context, stats),
      ],
    );
  }

  Widget _buildOverviewContent(BuildContext context, DashboardStats stats) {
    final maxTrend = stats.revenueTrend
        .fold<num>(1, (max, p) => p.revenue > max ? p.revenue : max);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Cartes empilées, une par ligne en pleine largeur (§ décidé en
        // conversation) — même affichage que le tableau de bord principal
        // (dashboard_page.dart), plutôt que la ligne horizontale
        // défilable qu'on avait mise avant.
        Column(
          children: [
            _StatCard(
              label: 'Ventes du jour',
              value: formatGNF(stats.todayRevenue),
              icon: Icons.payments_outlined,
            ),
            const SizedBox(height: 10),
            _StatCard(
              label: 'Bénéfice du jour',
              value: formatGNF(stats.todayProfit),
              icon: Icons.trending_up,
              color: Colors.green.shade700,
            ),
            const SizedBox(height: 10),
            _StatCard(
              label: 'Commandes',
              value: '${stats.todayOrdersCount}',
              icon: Icons.receipt_long_outlined,
            ),
            const SizedBox(height: 10),
            _StatCard(
              label: 'Produits en rupture',
              value: '${stats.lowStockCount}',
              icon: Icons.warning_amber_rounded,
              color: stats.lowStockCount > 0 ? Colors.red.shade600 : null,
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text('ÉVOLUTION DES VENTES (7 DERNIERS JOURS)',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.3)),
        const SizedBox(height: 14),
        if (stats.revenueTrend.isEmpty)
          Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text('Aucune vente sur cette période.',
                  style: TextStyle(color: Colors.grey.shade400)))
        else
          Container(
            padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: SizedBox(
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
                                heightFactor: (point.revenue / maxTrend)
                                    .clamp(0.04, 1)
                                    .toDouble(),
                                child: Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.bottomCenter,
                                      end: Alignment.topCenter,
                                      colors: [
                                        Theme.of(context).colorScheme.primary,
                                        Theme.of(context)
                                            .colorScheme
                                            .primary
                                            .withValues(alpha: 0.55),
                                      ],
                                    ),
                                    borderRadius: const BorderRadius.vertical(
                                        top: Radius.circular(5)),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Builder(builder: (context) {
                              final label = formatDate(point.day);
                              return Text(
                                label.length >= 5
                                    ? label.substring(0, 5)
                                    : label,
                                style: TextStyle(
                                    fontSize: 9, color: Colors.grey.shade400),
                              );
                            }),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 24),
        Text('PRODUITS LES PLUS VENDUS (30 DERNIERS JOURS)',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.3)),
        const SizedBox(height: 10),
        if (stats.topProducts.isEmpty)
          Text('Aucune vente sur cette période.',
              style: TextStyle(color: Colors.grey.shade400))
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                for (var i = 0; i < stats.topProducts.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 11),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .primary
                                .withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Text('${i + 1}',
                              style: TextStyle(
                                  color: Theme.of(context).colorScheme.primary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Text(stats.topProducts[i].name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500))),
                        Text('${stats.topProducts[i].totalSold} vendus',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 12.5)),
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

/// Bouton de sélection de date, style pilule — réutilisé partout où cette
/// page propose un sélecteur (Aperçu, Historique des ventes), cohérent
/// avec les puces de plage rapide de l'onglet Recette juste à côté.
class _DatePillButton extends StatelessWidget {
  const _DatePillButton({required this.date, required this.onTap});
  final DateTime date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: primary.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.calendar_today_outlined, size: 14, color: primary),
            const SizedBox(width: 7),
            Text(formatDate(date),
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: primary)),
          ],
        ),
      ),
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
  int? _selectedRangeDays = 1;
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
      _selectedRangeDays = days;
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
    setState(() {
      _startDate = picked;
      _selectedRangeDays = null;
    });
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
    setState(() {
      _endDate = picked;
      _selectedRangeDays = null;
    });
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
                child:
                    _DatePillButton(date: _startDate, onTap: _pickStartDate)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Icon(Icons.arrow_forward,
                  size: 14, color: Colors.grey.shade400),
            ),
            Expanded(
                child: _DatePillButton(date: _endDate, onTap: _pickEndDate)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _QuickRangeChip(
                label: "Aujourd'hui",
                selected: _selectedRangeDays == 1,
                onTap: () => _setQuickRange(1)),
            const SizedBox(width: 6),
            _QuickRangeChip(
                label: '7 jours',
                selected: _selectedRangeDays == 7,
                onTap: () => _setQuickRange(7)),
            const SizedBox(width: 6),
            _QuickRangeChip(
                label: '30 jours',
                selected: _selectedRangeDays == 30,
                onTap: () => _setQuickRange(30)),
          ],
        ),
        const SizedBox(height: 18),
        if (_error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(10)),
            child: Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 13)),
          ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [primary, primary.withValues(alpha: 0.8)],
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                  color: primary.withValues(alpha: 0.25),
                  blurRadius: 14,
                  offset: const Offset(0, 6))
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(13)),
                child: const Icon(Icons.trending_up,
                    color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('RECETTE TOTALE',
                      style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.white.withValues(alpha: 0.85),
                          letterSpacing: 0.3)),
                  const SizedBox(height: 3),
                  Text(
                    _loading ? '...' : formatGNF(_report?.totalRevenue ?? 0),
                    style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                        color: Colors.white),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Text('DÉTAIL PAR PRODUIT',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.3)),
        const SizedBox(height: 10),
        if (_loading)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()))
        else if (_report == null || _report!.products.isEmpty)
          const _EmptyBox(text: 'Aucune vente sur cette période.')
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _report!.products.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 11),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                              color: primary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(9)),
                          child: Icon(Icons.inventory_2_outlined,
                              size: 15, color: primary),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_report!.products[i].productName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(
                                '${_report!.products[i].quantitySold} vendu${_report!.products[i].quantitySold > 1 ? 's' : ''}',
                                style: TextStyle(
                                    fontSize: 11, color: Colors.grey.shade500),
                              ),
                            ],
                          ),
                        ),
                        Text(formatGNF(_report!.products[i].revenue),
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13)),
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
  const _QuickRangeChip(
      {required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? primary : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? primary : Colors.grey.shade300),
        ),
        child: Text(
          label,
          style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : Colors.grey.shade700),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(
      {required this.label,
      required this.value,
      required this.icon,
      this.color});
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final accent = color ?? Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 3))
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 17, color: accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 9,
                        color: Colors.grey.shade400,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Colors.grey.shade800)),
              ],
            ),
          ),
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
      return Padding(
          padding: const EdgeInsets.all(16),
          child: Text(_error!, style: const TextStyle(color: Colors.red)));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('CATALOGUE PRODUITS',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.3)),
        const SizedBox(height: 10),
        if (_products == null)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()))
        else if (_products!.isEmpty)
          const _EmptyBox(text: "Aucun produit pour l'instant.")
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
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
        Text('MOUVEMENTS DE STOCK RÉCENTS',
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 11,
                color: Colors.grey.shade500,
                letterSpacing: 0.3)),
        const SizedBox(height: 10),
        if (_movements == null)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()))
        else if (_movements!.isEmpty)
          const _EmptyBox(text: "Aucun mouvement pour l'instant.")
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
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
      padding: const EdgeInsets.symmetric(vertical: 32),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: Colors.grey.shade200, style: BorderStyle.solid),
      ),
      child: Column(
        children: [
          Icon(Icons.inbox_outlined, size: 26, color: Colors.grey.shade300),
          const SizedBox(height: 8),
          Text(text,
              style: TextStyle(color: Colors.grey.shade400, fontSize: 12.5)),
        ],
      ),
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
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: (lowStock
                  ? Colors.red.shade50
                  : Theme.of(context)
                      .colorScheme
                      .primary
                      .withValues(alpha: 0.08)),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.inventory_2_outlined,
                size: 16,
                color: lowStock
                    ? Colors.red.shade400
                    : Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
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
            style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
                color: lowStock ? Colors.red.shade600 : Colors.grey.shade700),
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
    final isOut = movement.type.contains('OUT');
    final isIn = movement.type.contains('IN');
    final accent = isOut
        ? Colors.red.shade400
        : (isIn ? Colors.green.shade600 : Colors.grey.shade500);
    final icon =
        isOut ? Icons.arrow_upward : (isIn ? Icons.arrow_downward : Icons.tune);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 15, color: accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(movement.productName ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(
                    '${movement.label} · ${formatDateTime(movement.createdAt)}',
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade400)),
              ],
            ),
          ),
          Text('${movement.quantity}',
              style: TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 13, color: accent)),
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
      final orders = await context
          .read<SupervisionApi>()
          .getOrders(widget.storeId, date: _isoDate);
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
            const Text('Date : ',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            _DatePillButton(date: _date, onTap: _pickDate),
          ],
        ),
        const SizedBox(height: 16),
        if (_error != null)
          Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)))
        else if (_orders == null)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()))
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
                  builder: (_) => _SupervisedOrderDetailSheet(
                      storeId: widget.storeId, orderId: order.id),
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
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 3))
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(order.orderNumber,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: Theme.of(context).colorScheme.primary)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: _paymentBg(),
                      borderRadius: BorderRadius.circular(20)),
                  child: Text(
                      kPaymentStatusLabels[order.paymentStatus] ??
                          order.paymentStatus,
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _paymentColor())),
                ),
              ],
            ),
            Text(
                '${order.customerName ?? 'Anonyme'} · ${formatDateTime(order.createdAt)}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
            const SizedBox(height: 8),
            Row(
              children: [
                if (order.remaining > 0)
                  Text('Reste : ${formatGNF(order.remaining)}',
                      style: TextStyle(
                          fontSize: 11.5, color: Colors.grey.shade500)),
                const Spacer(),
                Text(formatGNF(order.totalAmount),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13.5)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SupervisedOrderDetailSheet extends StatefulWidget {
  const _SupervisedOrderDetailSheet(
      {required this.storeId, required this.orderId});
  final int storeId;
  final int orderId;

  @override
  State<_SupervisedOrderDetailSheet> createState() =>
      _SupervisedOrderDetailSheetState();
}

class _SupervisedOrderDetailSheetState
    extends State<_SupervisedOrderDetailSheet> {
  OrderDetail? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final detail = await context
          .read<SupervisionApi>()
          .getOrder(widget.storeId, widget.orderId);
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
          const Text('Détail de la vente',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 16),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red))
          else if (_detail == null)
            const Padding(
                padding: EdgeInsets.symmetric(vertical: 30),
                child: Center(child: CircularProgressIndicator()))
          else ...[
            Text('Client',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            Text(_detail!.customerName ?? 'Anonyme',
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 14),
            for (final item in _detail!.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                        child: Text('${item.productName} × ${item.quantity}',
                            style: const TextStyle(fontSize: 13))),
                    Text(formatGNF(item.unitPrice * item.quantity),
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                  ],
                ),
              ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total', style: TextStyle(color: Colors.grey.shade500)),
                Text(formatGNF(_detail!.totalAmount),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
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
