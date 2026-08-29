import 'package:flutter/material.dart';

import '../../../../core/utils/formatters.dart';
import '../../data/pos_models.dart';

/// Mode d'affichage "Liste" de la Caisse (§ décidé en conversation, miroir
/// de PosProductListRow.jsx côté web) : une ligne compacte SANS image,
/// pensée pour un scan rapide plutôt que la découverte visuelle du mode
/// Grille (_PosProductCard).
///
/// Différence volontaire avec la carte Grille : pas de sélecteur de
/// quantité avant l'ajout — un tap sur "+" ajoute 1 unité, la quantité
/// s'ajuste ensuite dans le panier (déjà pourvu de +/-).
class PosProductListRow extends StatelessWidget {
  const PosProductListRow({super.key, required this.product, required this.cartQuantity, required this.onAdd});

  final Product product;
  final int cartQuantity;
  final void Function(int quantity) onAdd;

  @override
  Widget build(BuildContext context) {
    final isOutOfStock = product.quantity == 0;
    final isLocked = product.locked;
    final isLow = !isOutOfStock && product.quantity <= product.lowStockThreshold;
    final hasTiers = product.priceTiers.isNotEmpty;
    final inCart = cartQuantity > 0;
    final primary = Theme.of(context).colorScheme.primary;

    final Color stockColor = isOutOfStock ? Colors.red.shade500 : (isLow ? Colors.amber.shade600 : Colors.green.shade600);
    final Color stockTextColor = isOutOfStock ? Colors.red.shade600 : (isLow ? Colors.amber.shade700 : Colors.grey.shade500);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isLocked ? Colors.amber.shade50.withValues(alpha: 0.5) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isLocked ? Colors.amber.shade200 : (inCart ? primary : Colors.grey.shade200),
          width: inCart ? 1.4 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
                    ),
                    if (hasTiers) ...[
                      const SizedBox(width: 4),
                      Icon(Icons.percent, size: 12, color: primary),
                    ],
                  ],
                ),
                Text(product.reference ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Row(
            children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(color: stockColor, shape: BoxShape.circle)),
              const SizedBox(width: 4),
              Text('${product.quantity}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: stockTextColor)),
            ],
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 78,
            child: Text(
              formatGNF(product.sellingPrice),
              textAlign: TextAlign.right,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 10),
          Stack(
            clipBehavior: Clip.none,
            children: [
              Semantics(
                label: isLocked ? '${product.name} verrouillé par votre plan' : 'Ajouter ${product.name} au panier',
                button: true,
                child: SizedBox(
                  width: 36,
                  height: 36,
                  child: FilledButton(
                    onPressed: isOutOfStock ? null : () => onAdd(1),
                    style: FilledButton.styleFrom(
                      padding: EdgeInsets.zero,
                      shape: const CircleBorder(),
                      backgroundColor: isLocked ? Colors.amber.shade500 : primary,
                      disabledBackgroundColor: Colors.grey.shade200,
                    ),
                    child: Icon(
                      isLocked ? Icons.lock_outline : (isOutOfStock ? Icons.block : Icons.add),
                      size: isOutOfStock ? 15 : 18,
                      color: isOutOfStock ? Colors.grey.shade400 : Colors.white,
                    ),
                  ),
                ),
              ),
              if (inCart)
                Positioned(
                  top: -4,
                  right: -4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    constraints: const BoxConstraints(minWidth: 16),
                    decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white, width: 1.5)),
                    child: Text('$cartQuantity', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w800)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
