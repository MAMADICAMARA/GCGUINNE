import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/marketplace_api.dart';
import '../data/marketplace_models.dart';

/// Miroir de MarketplaceProductModal.jsx — détail complet d'un produit
/// MARCHÉ, accessible uniquement à un utilisateur déjà authentifié
/// (MarketplaceGrid ne l'ouvre jamais sans session, et le backend
/// revérifie de toute façon). Seul endroit où les coordonnées de la
/// boutique (propriétaire, adresse, téléphone) apparaissent.
class MarketplaceProductDetailSheet extends StatefulWidget {
  const MarketplaceProductDetailSheet({super.key, required this.productId});

  final int productId;

  @override
  State<MarketplaceProductDetailSheet> createState() => _MarketplaceProductDetailSheetState();
}

class _MarketplaceProductDetailSheetState extends State<MarketplaceProductDetailSheet> {
  MarketplaceProductDetail? _product;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final product = await context.read<MarketplaceApi>().getProductDetail(widget.productId);
      if (mounted) setState(() => _product = product);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 8, 8),
            child: Row(
              children: [
                const Expanded(child: Text('Détail du produit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: Colors.red))
                else if (_product == null)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: CircularProgressIndicator()))
                else ...[
                  AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Container(
                      decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(12)),
                      clipBehavior: Clip.antiAlias,
                      child: _product!.imageUrl != null
                          ? Image.network(_product!.imageUrl!, fit: BoxFit.cover)
                          : Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey.shade300),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(_product!.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                    formatGNF(_product!.sellingPrice),
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary),
                  ),
                  if (_product!.priceTiers.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text('PRIX PAR QUANTITÉ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500)),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
                      child: Column(
                        children: [
                          for (var i = 0; i < _product!.priceTiers.length; i++) ...[
                            if (i > 0) const Divider(height: 1),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text('À partir de ${_product!.priceTiers[i].minQuantity} unités', style: const TextStyle(fontSize: 12.5)),
                                  Text('${formatGNF(_product!.priceTiers[i].unitPrice)} / unité', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Text('VENDU PAR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500)),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 30,
                              height: 30,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
                              child: Icon(Icons.storefront_outlined, size: 15, color: Theme.of(context).colorScheme.primary),
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_product!.store.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                          ],
                        ),
                        if (_product!.store.ownerName != null) ...[
                          const SizedBox(height: 10),
                          _InfoRow(icon: Icons.person_outline, text: _product!.store.ownerName!),
                        ],
                        if (_product!.store.address != null) ...[
                          const SizedBox(height: 8),
                          _InfoRow(icon: Icons.location_on_outlined, text: _product!.store.address!),
                        ],
                        if (_product!.store.phone != null) ...[
                          const SizedBox(height: 8),
                          _InfoRow(icon: Icons.phone_outlined, text: _product!.store.phone!),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: Colors.grey.shade400),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade700))),
      ],
    );
  }
}
