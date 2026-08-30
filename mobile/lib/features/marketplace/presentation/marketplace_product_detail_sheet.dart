import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/share_url.dart';
import '../data/marketplace_api.dart';
import '../data/marketplace_models.dart';

String? _normalizeGuineaPhone(String? rawPhone) {
  if (rawPhone == null) return null;
  final digits = rawPhone.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return null;
  return digits.startsWith('224') ? digits : '224$digits';
}

/// Miroir de MarketplaceProductPage.jsx — détail complet d'un produit
/// MARCHÉ, accessible connecté ou non (§ partage sur les réseaux sociaux,
/// décidé en conversation). Design aligné sur la version web : image en
/// grand, prix mis en avant, carte vendeur avec actions rapides Appeler/
/// WhatsApp. Le bouton "Partager" envoie le lien PUBLIC (backend, pas
/// l'app) — c'est lui qui affiche une vignette dans WhatsApp/Facebook/etc.
/// (marketplaceShare.routes.js côté backend).
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
    final primary = Theme.of(context).colorScheme.primary;
    final whatsappNumber = _normalizeGuineaPhone(_product?.store.phone);

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: Container(
          color: Colors.white,
          child: Stack(
            children: [
              ListView(
                controller: scrollController,
                padding: EdgeInsets.zero,
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_error!, style: const TextStyle(color: Colors.red)),
                    )
                  else if (_product == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 60),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else ...[
                    AspectRatio(
                      aspectRatio: 16 / 10,
                      child: Container(
                        color: Colors.grey.shade100,
                        child: _product!.imageUrl != null
                            ? Image.network(_product!.imageUrl!, fit: BoxFit.cover)
                            : Icon(Icons.inventory_2_outlined, size: 52, color: Colors.grey.shade300),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.storefront_outlined, size: 12, color: Colors.grey.shade500),
                                const SizedBox(width: 5),
                                Text(_product!.store.name, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(_product!.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text(
                            formatGNF(_product!.sellingPrice),
                            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: primary),
                          ),
                          if (_product!.priceTiers.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text('PRIX PAR QUANTITÉ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500)),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final tier in _product!.priceTiers)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: Colors.grey.shade200),
                                    ),
                                    child: Text.rich(
                                      TextSpan(
                                        children: [
                                          TextSpan(text: '≥${tier.minQuantity}u  ', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                                          TextSpan(text: formatGNF(tier.unitPrice), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                        ],
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                          if (_product!.attributes.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text('CARACTÉRISTIQUES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500)),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                for (final entry in _product!.attributes.entries)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: Colors.grey.shade200),
                                    ),
                                    child: Text.rich(
                                      TextSpan(
                                        children: [
                                          TextSpan(text: '${entry.key} :  ', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                                          TextSpan(text: entry.value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                        ],
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                          if (_product!.description != null && _product!.description!.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Text('DESCRIPTION', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500)),
                            const SizedBox(height: 8),
                            Text(
                              _product!.description!,
                              style: TextStyle(fontSize: 13, color: Colors.grey.shade700, height: 1.5),
                            ),
                          ],
                          const SizedBox(height: 20),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 38,
                                      height: 38,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(shape: BoxShape.circle, color: primary),
                                      child: Text(
                                        _product!.store.name.isNotEmpty ? _product!.store.name[0].toUpperCase() : '?',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(_product!.store.name, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
                                          if (_product!.store.ownerName != null)
                                            Text(_product!.store.ownerName!, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                if (_product!.store.address != null) ...[
                                  const SizedBox(height: 12),
                                  _InfoRow(icon: Icons.location_on_outlined, text: _product!.store.address!),
                                ],
                                if (_product!.store.phone != null) ...[
                                  const SizedBox(height: 8),
                                  _InfoRow(icon: Icons.phone_outlined, text: _product!.store.phone!),
                                ],
                                if (whatsappNumber != null) ...[
                                  const SizedBox(height: 14),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () => launchUrl(Uri.parse('tel:+$whatsappNumber')),
                                          icon: const Icon(Icons.call_outlined, size: 16),
                                          label: const Text('Appeler'),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: FilledButton.icon(
                                          onPressed: () => launchUrl(
                                            Uri.parse(
                                              'https://wa.me/$whatsappNumber?text=${Uri.encodeComponent('Bonjour, je suis intéressé(e) par "${_product!.name}" vu sur le Marché.')}',
                                            ),
                                            mode: LaunchMode.externalApplication,
                                          ),
                                          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                                          icon: const Icon(Icons.chat_bubble_outline, size: 16),
                                          label: const Text('WhatsApp'),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          if (_product!.relatedProducts.isNotEmpty) ...[
                            const SizedBox(height: 22),
                            Text('VOUS POURRIEZ AUSSI AIMER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500)),
                            const SizedBox(height: 10),
                            GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _product!.relatedProducts.length,
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                childAspectRatio: 0.72,
                              ),
                              itemBuilder: (context, index) => _RelatedProductCard(product: _product!.relatedProducts[index]),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              Positioned(
                top: 10,
                right: 12,
                child: Row(
                  children: [
                    if (_product != null)
                      _GlassButton(
                        icon: Icons.share_outlined,
                        onTap: () => Share.share(getProductShareUrl(widget.productId), subject: _product!.name),
                      ),
                    const SizedBox(width: 8),
                    _GlassButton(icon: Icons.close, onTap: () => Navigator.of(context).pop()),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Miroir de _ProductCard (marketplace_grid.dart) — même visuel exact, en
/// plus compact pour tenir dans la grille "Vous pourriez aussi aimer" au
/// bas de la feuille de détail. Le tap empile une nouvelle feuille par-
/// dessus plutôt que de fermer celle-ci (comme AliExpress/Alibaba : on
/// peut revenir en arrière produit par produit).
class _RelatedProductCard extends StatelessWidget {
  const _RelatedProductCard({required this.product});
  final MarketplaceProduct product;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => MarketplaceProductDetailSheet(productId: product.id),
      ),
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
                    : Icon(Icons.inventory_2_outlined, size: 32, color: Colors.grey.shade300),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(
                    formatGNF(product.sellingPrice),
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.primary),
                  ),
                  const SizedBox(height: 2),
                  Text(product.storeName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, color: Colors.grey.shade400)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  const _GlassButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.black.withValues(alpha: 0.35)),
        child: Icon(icon, size: 17, color: Colors.white),
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
