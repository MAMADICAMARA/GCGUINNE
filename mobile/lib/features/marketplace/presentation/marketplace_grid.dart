import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/auth_state.dart';
import '../data/marketplace_api.dart';
import '../data/marketplace_models.dart';
import 'marketplace_product_detail_sheet.dart';

/// Miroir de MarketplaceGrid.jsx — grille de produits MARCHÉ, PARTAGÉE
/// entre la page publique (visiteur non connecté) et AccountHomePage
/// (utilisateur connecté). Un visiteur non connecté qui tape un produit est
/// renvoyé vers /login plutôt que d'ouvrir le détail (le backend l'exige
/// de toute façon).
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
    final authenticated = context.read<AuthState>().isAuthenticated;
    if (!authenticated) {
      context.push('/login');
      return;
    }
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

    final authenticated = context.watch<AuthState>().isAuthenticated;

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
        return _ProductCard(product: product, authenticated: authenticated, onTap: () => _handleTap(product));
      },
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.authenticated, required this.onTap});

  final MarketplaceProduct product;
  final bool authenticated;
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
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    color: Colors.grey.shade100,
                    child: product.imageUrl != null
                        ? Image.network(product.imageUrl!, fit: BoxFit.cover)
                        : Icon(Icons.inventory_2_outlined, size: 36, color: Colors.grey.shade300),
                  ),
                  if (!authenticated)
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.lock_outline, size: 11, color: Colors.white),
                            SizedBox(width: 4),
                            Text('Connexion pour voir plus', style: TextStyle(fontSize: 9.5, color: Colors.white, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                ],
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
