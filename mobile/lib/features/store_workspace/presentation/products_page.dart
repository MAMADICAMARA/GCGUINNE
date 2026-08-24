import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import 'products/product_detail_sheet.dart';
import 'products/product_form_page.dart';
import '../data/catalog_api.dart';
import '../data/pos_models.dart';
import '../data/product_detail_models.dart';
import '../data/products_api.dart';

const _kPageLimit = 20;

/// Miroir de ProductsPage.jsx — catalogue avec recherche, filtres, pagination,
/// et accès à la création/édition (§4.4 du cahier des charges). Toujours en
/// cartes sur mobile (jamais de tableau, qui n'a pas de sens sur cet
/// écran) — image en vignette pour que le produit se reconnaisse d'un
/// coup d'œil, pas seulement par son nom.
class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key});

  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  ProductListResult? _result;
  bool _loading = true;
  String? _error;

  int _page = 1;
  String _search = '';
  String _statusFilter = 'ACTIVE';
  bool _lowStockOnly = false;
  int? _categoryId;
  List<ProductCategory> _categories = [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await context.read<CatalogApi>().listCategories();
      if (mounted) setState(() => _categories = categories);
    } on ApiException {
      // Non bloquant : le filtre catégorie reste juste vide.
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<ProductsApi>().list(
            page: _page,
            limit: _kPageLimit,
            search: _search,
            status: _statusFilter,
            lowStockOnly: _lowStockOnly,
            categoryId: _categoryId,
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

  void _applyFilterChange(VoidCallback change) {
    setState(() {
      change();
      _page = 1;
    });
    _load();
  }

  void _goToPage(int page) {
    setState(() => _page = page);
    _load();
  }

  Future<void> _openCreateForm() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ProductFormPage()),
    );
    if (created == true) _load();
  }

  Future<void> _openEditForm(Product product) async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ProductFormPage(product: product)),
    );
    if (updated == true) _load();
  }

  Future<void> _openDetail(Product product) async {
    final result = await showProductDetailSheet(context, product);
    if (!mounted) return;
    if (result == true) {
      // Statut changé (désactivé/réactivé) — recharge la liste.
      _load();
    } else if (result == false) {
      // "Modifier" a été tapé depuis la feuille détail.
      await _openEditForm(product);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateForm,
        icon: const Icon(Icons.add),
        label: const Text('Ajouter'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            TextField(
              onChanged: (value) => _applyFilterChange(() => _search = value),
              decoration: const InputDecoration(
                hintText: 'Rechercher par nom ou référence...',
                prefixIcon: Icon(Icons.search, size: 20),
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 34,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _FilterChip(label: 'Actifs', selected: _statusFilter == 'ACTIVE', onTap: () => _applyFilterChange(() => _statusFilter = 'ACTIVE')),
                  const SizedBox(width: 6),
                  _FilterChip(label: 'Inactifs', selected: _statusFilter == 'INACTIVE', onTap: () => _applyFilterChange(() => _statusFilter = 'INACTIVE')),
                  const SizedBox(width: 6),
                  _FilterChip(label: 'Tous', selected: _statusFilter == 'ALL', onTap: () => _applyFilterChange(() => _statusFilter = 'ALL')),
                  const SizedBox(width: 10),
                  Container(width: 1, color: Colors.grey.shade300),
                  const SizedBox(width: 10),
                  _FilterChip(
                    label: 'Stock faible',
                    icon: Icons.warning_amber_rounded,
                    selected: _lowStockOnly,
                    onTap: () => _applyFilterChange(() => _lowStockOnly = !_lowStockOnly),
                  ),
                  if (_categories.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    for (final category in _categories) ...[
                      _FilterChip(label: category.name, selected: _categoryId == category.id, onTap: () => _applyFilterChange(() => _categoryId = _categoryId == category.id ? null : category.id)),
                      const SizedBox(width: 6),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (_loading)
              const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              Padding(padding: const EdgeInsets.only(top: 24), child: Text(_error!, style: const TextStyle(color: Colors.red)))
            else if (_result == null || _result!.products.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 48),
                child: Column(
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 40, color: Colors.grey.shade300),
                    const SizedBox(height: 10),
                    Text('Aucun produit trouvé.', style: TextStyle(color: Colors.grey.shade500)),
                  ],
                ),
              )
            else ...[
              for (final product in _result!.products)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ProductListTile(product: product, onTap: () => _openDetail(product)),
                ),
              const SizedBox(height: 8),
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
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap, this.icon});

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      avatar: icon != null ? Icon(icon, size: 15) : null,
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}

class _ProductListTile extends StatelessWidget {
  const _ProductListTile({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isOutOfStock = product.quantity == 0;
    final isLow = !isOutOfStock && product.quantity <= product.lowStockThreshold;
    final stockColor = isOutOfStock ? Colors.red.shade600 : (isLow ? Colors.amber.shade800 : Colors.green.shade700);
    final isActive = product.status == 'ACTIVE';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10)),
              child: product.imageUrl != null
                  ? Image.network(product.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Icon(Icons.inventory_2_outlined, color: Colors.grey.shade300))
                  : Icon(Icons.inventory_2_outlined, color: Colors.grey.shade300),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                      ),
                      if (!isActive)
                        Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(20)),
                          child: const Text('Inactif', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(formatGNF(product.sellingPrice), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Theme.of(context).colorScheme.primary)),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(width: 6, height: 6, decoration: BoxDecoration(color: stockColor, shape: BoxShape.circle)),
                      const SizedBox(width: 5),
                      Text('Stock : ${product.quantity}', style: TextStyle(fontSize: 11, color: stockColor, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: Colors.grey.shade400),
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
            'Page $page / $pages ($total produits)',
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
