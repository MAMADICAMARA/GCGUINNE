import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/marketplace_api.dart';
import '../data/marketplace_models.dart';
import 'marketplace_product_detail_sheet.dart';

/// Miroir de MarketplaceGrid.jsx — grille de produits MARCHÉ, PARTAGÉE
/// entre la page publique (visiteur non connecté) et AccountHomePage
/// (utilisateur connecté). Détail toujours ouvrable, connecté ou non (§
/// partage sur les réseaux sociaux, décidé en conversation) — MARCHÉ est
/// une vitrine publique, le backend ne l'exige plus non plus.
class MarketplaceGrid extends StatefulWidget {
  const MarketplaceGrid({super.key});

  @override
  State<MarketplaceGrid> createState() => _MarketplaceGridState();
}

class _MarketplaceGridState extends State<MarketplaceGrid> {
  List<MarketplaceProduct>? _products;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final products = await context.read<MarketplaceApi>().listProducts();
      if (mounted) setState(() => _products = products);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  void _handleTap(MarketplaceProduct product) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => MarketplaceProductDetailSheet(productId: product.id),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Text(_error!, style: const TextStyle(color: Colors.red)),
      );
    }
    final products = _products;
    if (products == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (products.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Column(
          children: [
            Icon(Icons.auto_awesome_outlined, size: 40, color: Colors.grey.shade300),
            const SizedBox(height: 10),
            Text("Aucun produit pour l'instant.", style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(
              'Revenez bientôt — de nouvelles boutiques arrivent régulièrement.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade400, fontSize: 12.5),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: products.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      itemBuilder: (context, index) {
        final product = products[index];
        return _ProductCard(product: product, onTap: () => _handleTap(product));
      },
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});

  final MarketplaceProduct product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Container(
                color: Colors.grey.shade100,
                child: product.imageUrl != null
                    ? Image.network(product.imageUrl!, fit: BoxFit.cover)
                    : Icon(Icons.inventory_2_outlined, size: 36, color: Colors.grey.shade300),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(
                    formatGNF(product.sellingPrice),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.primary),
                  ),
                  const SizedBox(height: 2),
                  Text(product.storeName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
