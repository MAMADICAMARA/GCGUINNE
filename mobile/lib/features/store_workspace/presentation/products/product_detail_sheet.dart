import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../state/auth_state.dart';
import '../../data/pos_models.dart';
import '../../data/product_detail_models.dart';
import '../../data/products_api.dart';

/// Résultat de la feuille détail — indique à l'appelant si la liste doit se
/// recharger (produit modifié, désactivé ou réactivé pendant la
/// consultation).
Future<bool?> showProductDetailSheet(BuildContext context, Product product) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ProductDetailSheet(product: product),
  );
}

class _ProductDetailSheet extends StatefulWidget {
  const _ProductDetailSheet({required this.product});

  final Product product;

  @override
  State<_ProductDetailSheet> createState() => _ProductDetailSheetState();
}

class _ProductDetailSheetState extends State<_ProductDetailSheet> {
  List<StockMovement>? _movements;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      final movements = await context.read<ProductsApi>().getStockHistory(widget.product.id);
      if (!mounted) return;
      setState(() => _movements = movements);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _toggleStatus() async {
    final isActive = widget.product.status == 'ACTIVE';
    final api = context.read<ProductsApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isActive ? 'Désactiver ce produit ?' : 'Réactiver ce produit ?'),
        content: Text(isActive
            ? '"${widget.product.name}" n\'apparaîtra plus en caisse.'
            : '"${widget.product.name}" redeviendra disponible en caisse.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Confirmer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      if (isActive) {
        await api.deactivate(widget.product.id);
      } else {
        await api.reactivate(widget.product.id);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final margin = product.sellingPrice - product.purchasePrice;
    final marginPercent = product.purchasePrice > 0 ? (margin / product.purchasePrice * 100).round() : null;
    final isActive = product.status == 'ACTIVE';
    // Un Vendeur autorisé à créer des produits (§40_autorisation_ajout_produit.sql)
    // peut atteindre cette feuille, mais modifier/désactiver/réactiver un
    // produit existant reste strictement réservé au Owner.
    final isOwner = context.watch<AuthState>().activeStore?.roleCode == 'OWNER';

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => ListView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(product.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isActive ? Colors.green.shade50 : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isActive ? 'Actif' : 'Inactif',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isActive ? Colors.green.shade700 : Colors.grey.shade600),
                  ),
                ),
              ],
            ),
            Text('Référence : ${product.reference ?? '—'}', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500)),
            const SizedBox(height: 16),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.2,
              children: [
                _InfoTile(label: "Prix d'achat", value: formatGNF(product.purchasePrice)),
                _InfoTile(label: 'Prix de vente', value: formatGNF(product.sellingPrice)),
                _InfoTile(label: 'Marge', value: marginPercent != null ? '${formatGNF(margin)} · $marginPercent%' : formatGNF(margin)),
                _InfoTile(label: 'Stock actuel', value: '${product.quantity}'),
                _InfoTile(label: "Seuil d'alerte", value: '${product.lowStockThreshold}'),
                if (product.categoryId != null) _InfoTile(label: 'Catégorie', value: '#${product.categoryId}'),
              ],
            ),
            if (product.description != null && product.description!.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Text('Description', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 4),
              Text(product.description!, style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 20),
            const Text('Historique de stock', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const Text('Mouvements immuables', style: TextStyle(fontSize: 11, color: Colors.grey)),
            const SizedBox(height: 8),
            if (_movements == null)
              const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Center(child: CircularProgressIndicator()))
            else if (_movements!.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('Aucun mouvement de stock.', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
              )
            else
              Container(
                decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
                child: Column(
                  children: [
                    for (var i = 0; i < _movements!.length; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          border: i == 0 ? null : Border(top: BorderSide(color: Colors.grey.shade100)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
                                    child: Text(_movements![i].label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600)),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    '${formatDateTime(_movements![i].createdAt)}${_movements![i].note != null ? ' · ${_movements![i].note}' : ''}',
                                    style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500),
                                  ),
                                ],
                              ),
                            ),
                            Text('${_movements![i].quantity}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            if (isOwner) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => Navigator.of(context).pop(false),
                      icon: const Icon(Icons.edit_outlined, size: 17),
                      label: const Text('Modifier'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _busy ? null : _toggleStatus,
                      style: FilledButton.styleFrom(backgroundColor: isActive ? Colors.red.shade600 : Colors.green.shade600),
                      icon: Icon(isActive ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 17),
                      label: Text(isActive ? 'Désactiver' : 'Réactiver'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: TextStyle(fontSize: 9.5, color: Colors.grey.shade500, letterSpacing: 0.3), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
