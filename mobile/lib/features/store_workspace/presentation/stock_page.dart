import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../data/pos_models.dart';
import '../data/products_api.dart';
import 'stock/adjust_stock_sheet.dart';

/// Miroir de StockPage.jsx — vue transversale distincte du catalogue :
/// 1. Alertes de rupture/stock faible, à surveiller.
/// 2. Recherche + ajustement de stock de n'importe quel produit.
/// L'historique détaillé par produit reste sur la fiche Produit.
class StockPage extends StatefulWidget {
  const StockPage({super.key});

  @override
  State<StockPage> createState() => _StockPageState();
}

class _StockPageState extends State<StockPage> {
  List<Product> _alerts = [];
  bool _loadingAlerts = true;
  String? _alertsError;

  final _searchController = TextEditingController();
  List<Product> _searchResults = [];
  bool _searching = false;
  Timer? _debounce;

  String? _successMessage;

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _loadingAlerts = true;
      _alertsError = null;
    });
    try {
      final result = await context.read<ProductsApi>().list(limit: 100, status: 'ACTIVE', lowStockOnly: true);
      if (!mounted) return;
      setState(() {
        _alerts = result.products;
        _loadingAlerts = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _alertsError = err.message;
        _loadingAlerts = false;
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final result = await context.read<ProductsApi>().list(search: value, status: 'ACTIVE', limit: 10);
        if (!mounted) return;
        setState(() {
          _searchResults = result.products;
          _searching = false;
        });
      } on ApiException {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  Future<void> _openAdjust(Product product) async {
    final newQuantity = await showAdjustStockSheet(context, product);
    if (newQuantity == null || !mounted) return;
    setState(() {
      _successMessage = 'Stock de "${product.name}" mis à jour : $newQuantity.';
      _searchResults = _searchResults
          .map((p) => p.id == product.id
              ? Product(
                  id: p.id,
                  categoryId: p.categoryId,
                  name: p.name,
                  reference: p.reference,
                  sellingPrice: p.sellingPrice,
                  quantity: newQuantity,
                  lowStockThreshold: p.lowStockThreshold,
                  imageUrl: p.imageUrl,
                  priceTiers: p.priceTiers,
                  purchasePrice: p.purchasePrice,
                  description: p.description,
                  status: p.status,
                  attributes: p.attributes,
                )
              : p)
          .toList();
    });
    _loadAlerts();
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) setState(() => _successMessage = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadAlerts,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_successMessage != null)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_successMessage!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 16, color: Colors.amber.shade600),
              const SizedBox(width: 6),
              const Expanded(
                child: Text('Produits en stock faible ou en rupture', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_alertsError != null)
            Text(_alertsError!, style: const TextStyle(color: Colors.red, fontSize: 13))
          else if (_loadingAlerts)
            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator()))
          else if (_alerts.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.grey.shade200, style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                children: [
                  Icon(Icons.check_circle_outline, size: 28, color: Colors.green.shade300),
                  const SizedBox(height: 8),
                  Text(
                    'Aucune alerte — tous les stocks sont au-dessus de leur seuil.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
                  ),
                ],
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  for (var i = 0; i < _alerts.length; i++)
                    _StockRow(
                      product: _alerts[i],
                      showTopBorder: i > 0,
                      onAdjust: () => _openAdjust(_alerts[i]),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 26),
          const Text("Ajuster le stock d'un autre produit", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
          const SizedBox(height: 10),
          TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            decoration: const InputDecoration(
              hintText: 'Rechercher un produit par nom ou référence...',
              prefixIcon: Icon(Icons.search, size: 20),
              border: OutlineInputBorder(),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          if (_searching)
            const Padding(padding: EdgeInsets.only(top: 10), child: Text('Recherche...', style: TextStyle(color: Colors.grey))),
          if (_searchResults.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  for (var i = 0; i < _searchResults.length; i++)
                    _StockRow(
                      product: _searchResults[i],
                      showTopBorder: i > 0,
                      onAdjust: () => _openAdjust(_searchResults[i]),
                      showThreshold: false,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StockRow extends StatelessWidget {
  const _StockRow({required this.product, required this.showTopBorder, required this.onAdjust, this.showThreshold = true});

  final Product product;
  final bool showTopBorder;
  final VoidCallback onAdjust;
  final bool showThreshold;

  @override
  Widget build(BuildContext context) {
    final isOutOfStock = product.quantity == 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(border: showTopBorder ? Border(top: BorderSide(color: Colors.grey.shade100)) : null),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                if (showThreshold)
                  Text("Seuil d'alerte : ${product.lowStockThreshold}", style: TextStyle(fontSize: 11, color: Colors.grey.shade500))
                else
                  Text('Stock : ${product.quantity}', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ],
            ),
          ),
          if (showThreshold)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Text(
                '${product.quantity}',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: isOutOfStock ? Colors.red.shade600 : Colors.amber.shade800),
              ),
            ),
          TextButton(onPressed: onAdjust, child: const Text('Ajuster', style: TextStyle(fontSize: 12.5))),
        ],
      ),
    );
  }
}
