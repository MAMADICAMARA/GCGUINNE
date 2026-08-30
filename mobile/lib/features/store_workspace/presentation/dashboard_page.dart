import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/auth_state.dart';
import '../data/dashboard_api.dart';
import '../data/dashboard_models.dart';

/// Miroir de frontend/src/pages/dashboard/DashboardPage.jsx — mêmes
/// données (GET /dashboard/stats), même sélecteur de date réservé à
/// l'Owner. La distinction desktop/mobile du web n'a pas de sens ici
/// (l'app EST le mobile) : le tableau "par vendeur" reprend directement
/// la mise en page en cartes que le web réserve à ses petits écrans.
class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  DashboardStats? _stats;
  String? _error;
  bool _loading = true;
  DateTime _selectedDate = DateTime.now();

  bool get _isToday => _isSameDay(_selectedDate, DateTime.now());

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
      final stats = await context.read<DashboardApi>().getStats(
            date: _isToday ? null : _isoDate(_selectedDate),
          );
      if (!mounted) return;
      setState(() {
        _stats = stats;
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

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _selectedDate = picked);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final activeStore = context.watch<AuthState>().activeStore;
    final isOwner = activeStore?.roleCode == 'OWNER';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HeaderCard(
            storeName: activeStore?.name ?? '',
            isOwner: isOwner,
            selectedDate: _selectedDate,
            isToday: _isToday,
            onPickDate: _pickDate,
            onResetToday: () {
              setState(() => _selectedDate = DateTime.now());
              _load();
            },
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            )
          else if (_stats != null)
            _DashboardContent(stats: _stats!, isOwner: isOwner, isToday: _isToday, selectedDate: _selectedDate),
        ],
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.storeName,
    required this.isOwner,
    required this.selectedDate,
    required this.isToday,
    required this.onPickDate,
    required this.onResetToday,
  });

  final String storeName;
  final bool isOwner;
  final DateTime selectedDate;
  final bool isToday;
  final VoidCallback onPickDate;
  final VoidCallback onResetToday;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            const Icon(Icons.storefront_outlined, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                storeName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            if (isOwner)
              TextButton.icon(
                onPressed: onPickDate,
                icon: const Icon(Icons.calendar_month_outlined, size: 18),
                label: Text(isToday ? "Aujourd'hui" : formatDate(selectedDate)),
              )
            else
              const Text("Aujourd'hui", style: TextStyle(color: Colors.grey)),
            if (isOwner && !isToday)
              IconButton(
                tooltip: "Revenir à aujourd'hui",
                icon: const Icon(Icons.today_outlined, size: 18),
                onPressed: onResetToday,
              ),
          ],
        ),
      ),
    );
  }
}

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({
    required this.stats,
    required this.isOwner,
    required this.isToday,
    required this.selectedDate,
  });

  final DashboardStats stats;
  final bool isOwner;
  final bool isToday;
  final DateTime selectedDate;

  @override
  Widget build(BuildContext context) {
    final dayLabel = isToday ? 'du jour' : 'du ${formatDate(selectedDate)}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Une carte par ligne, pleine largeur (§ décidé en conversation,
        // "même affichage horizontal que l'interface mobile côté web") —
        // miroir exact de DashboardPage.jsx sous son point de rupture `sm`
        // (flex flex-col), où chaque StatCard range son contenu à
        // l'horizontale (texte à gauche, badge d'icône à droite) plutôt
        // que la grille 2 colonnes avec icône au-dessus qu'on avait ici.
        Column(
          children: [
            _StatCard(
              label: isOwner ? 'Ventes $dayLabel' : 'Mes ventes du jour',
              value: formatGNF(stats.todayRevenue),
              icon: Icons.payments_outlined,
              iconColor: Colors.blue,
            ),
            if (stats.todayProfit != null) ...[
              const SizedBox(height: 12),
              _StatCard(
                label: 'Bénéfice $dayLabel',
                value: formatGNF(stats.todayProfit),
                icon: Icons.account_balance_wallet_outlined,
                iconColor: Colors.green,
                valueColor: Colors.green.shade800,
              ),
            ],
            const SizedBox(height: 12),
            _StatCard(
              label: isOwner ? 'Commandes' : 'Mes commandes',
              value: '${stats.todayOrdersCount}',
              icon: Icons.shopping_bag_outlined,
              iconColor: Colors.deepPurple,
            ),
            const SizedBox(height: 12),
            _StatCard(
              label: isOwner ? 'Articles vendus' : 'Mes articles vendus',
              value: '${stats.todayItemsSold}',
              icon: Icons.inventory_2_outlined,
              iconColor: Colors.amber.shade800,
            ),
            const SizedBox(height: 12),
            _StatCard(
              label: 'Produits en rupture',
              value: '${stats.lowStockCount}',
              icon: Icons.error_outline,
              iconColor: stats.lowStockCount > 0 ? Colors.red : Colors.grey,
              valueColor: stats.lowStockCount > 0 ? Colors.red.shade700 : null,
            ),
          ],
        ),
        const SizedBox(height: 20),
        _SectionCard(
          icon: Icons.bar_chart_outlined,
          title: isOwner ? 'Évolution des ventes' : 'Évolution de mes ventes',
          subtitle: '(7 derniers jours)',
          child: stats.revenueTrend.isEmpty
              ? const _EmptyPeriodText()
              : _RevenueTrendChart(points: stats.revenueTrend),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          icon: Icons.emoji_events_outlined,
          title: isOwner ? 'Produits les plus vendus' : 'Mes produits les plus vendus',
          subtitle: '(30 derniers jours)',
          child: stats.topProducts.isEmpty
              ? const _EmptyPeriodText()
              : Column(
                  children: [
                    for (var i = 0; i < stats.topProducts.length; i++)
                      _TopProductRow(rank: i + 1, product: stats.topProducts[i]),
                  ],
                ),
        ),
        if (stats.bySeller != null) ...[
          const SizedBox(height: 16),
          _SectionCard(
            icon: Icons.groups_outlined,
            title: 'Performance par vendeur',
            subtitle: '(30 derniers jours)',
            child: stats.bySeller!.isEmpty
                ? const _EmptyPeriodText()
                : Column(
                    children: [
                      for (final seller in stats.bySeller!) _SellerRow(seller: seller),
                    ],
                  ),
          ),
        ],
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
    this.valueColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500, letterSpacing: 0.3),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: valueColor ?? Colors.grey.shade900,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: iconColor),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 8),
                Flexible(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        TextSpan(text: ' $subtitle', style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _EmptyPeriodText extends StatelessWidget {
  const _EmptyPeriodText();

  @override
  Widget build(BuildContext context) {
    return Text('Aucune vente sur cette période.', style: TextStyle(color: Colors.grey.shade400, fontSize: 13));
  }
}

class _RevenueTrendChart extends StatelessWidget {
  const _RevenueTrendChart({required this.points});

  final List<RevenuePoint> points;

  @override
  Widget build(BuildContext context) {
    final maxRevenue = points.fold<num>(1, (max, p) => p.revenue > max ? p.revenue : max);
    final primary = Theme.of(context).colorScheme.primary;

    return SizedBox(
      height: 120,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final point in points)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    // Expanded est nécessaire ici : un FractionallySizedBox
                    // en enfant direct (non-flex) d'une Column reçoit une
                    // hauteur non bornée (Column mesure d'abord ses enfants
                    // non-flex avec des contraintes infinies), ce qui casse
                    // heightFactor. Expanded borne la hauteur disponible ;
                    // Align ancre la barre en bas de cet espace.
                    Expanded(
                      child: Align(
                        alignment: Alignment.bottomCenter,
                        child: Tooltip(
                          message: formatGNF(point.revenue),
                          child: FractionallySizedBox(
                            heightFactor: (point.revenue / maxRevenue).clamp(0.03, 1).toDouble(),
                            child: Container(
                              decoration: BoxDecoration(
                                color: primary,
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatDate(point.day).substring(0, 5),
                      style: TextStyle(fontSize: 9, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TopProductRow extends StatelessWidget {
  const _TopProductRow({required this.rank, required this.product});

  final int rank;
  final TopProduct product;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            child: Text('#$rank', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
          ),
          Expanded(child: Text(product.name, style: const TextStyle(fontSize: 13))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text('${product.totalSold} vendus', style: const TextStyle(fontSize: 11)),
          ),
        ],
      ),
    );
  }
}

class _SellerRow extends StatelessWidget {
  const _SellerRow({required this.seller});

  final SellerStat seller;

  @override
  Widget build(BuildContext context) {
    final initial = seller.sellerName.isNotEmpty ? seller.sellerName[0].toUpperCase() : '?';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: Colors.indigo.shade50,
            child: Text(initial, style: TextStyle(color: Colors.indigo.shade700, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(seller.sellerName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatGNF(seller.revenue), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              Text(
                '${seller.ordersCount} commande${seller.ordersCount > 1 ? 's' : ''}',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

bool _isSameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
