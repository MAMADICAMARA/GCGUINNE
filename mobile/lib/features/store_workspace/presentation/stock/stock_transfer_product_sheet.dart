import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/pos_models.dart';
import '../../data/products_api.dart';

/// Étape 1 du transfert de stock (§45_transfert_de_stock.sql) — choix du
/// produit à envoyer. Miroir de StockTransferProductModal.jsx.
///
/// Retourne le produit choisi, ou `null` si annulé.
Future<Product?> showStockTransferProductSheet(BuildContext context) {
  return showModalBottomSheet<Product>(
    context: context,
    isScrollControlled: true,
    builder: (context) => const _StockTransferProductSheet(),
  );
}

class _StockTransferProductSheet extends StatefulWidget {
  const _StockTransferProductSheet();

  @override
  State<_StockTransferProductSheet> createState() => _StockTransferProductSheetState();
}

class _StockTransferProductSheetState extends State<_StockTransferProductSheet> {
  final _searchController = TextEditingController();
  List<Product> _products = [];
  bool _loading = true;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<ProductsApi>().list(
            search: _searchController.text,
            status: 'ACTIVE',
            limit: 50,
          );
      if (!mounted) return;
      setState(() {
        _products = result.products;
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

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), _load);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Transférer le stock — choisir un produit',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: _onSearchChanged,
                  decoration: const InputDecoration(
                    hintText: 'Rechercher un produit par nom ou référence...',
                    prefixIcon: Icon(Icons.search, size: 20),
                    border: OutlineInputBorder(),
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))
                else if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_products.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Text(
                      'Aucun produit trouvé.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      controller: scrollController,
                      itemCount: _products.length,
                      separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.shade100),
                      itemBuilder: (context, index) {
                        final product = _products[index];
                        final outOfStock = product.quantity <= 0;
                        return ListTile(
                          enabled: !outOfStock,
                          contentPadding: EdgeInsets.zero,
                          title: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: product.reference != null ? Text('Réf. ${product.reference}') : null,
                          trailing: Text(
                            '${product.quantity} en stock',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Colors.grey.shade600),
                          ),
                          onTap: outOfStock ? null : () => Navigator.of(context).pop(product),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
