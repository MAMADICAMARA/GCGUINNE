import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/auth_state.dart';
import '../data/catalog_api.dart';
import '../data/orders_api.dart';
import '../data/pos_models.dart';
import 'pos/cash_drawer_banner.dart';
import 'pos/customer_step_sheet.dart';
import 'pos/order_summary_sheet.dart';
import 'pos/receipt_sheet.dart';

/// Miroir de PosPage.jsx — catalogue + panier + validation de vente en 3
/// étapes (client, récapitulatif/paiement, reçu). Sur mobile, le panier
/// n'est pas affiché côte à côte avec le catalogue (pas la place) : une
/// barre persistante en bas résume le panier et ouvre son détail complet
/// en feuille modale, plutôt que de l'enterrer en bas d'une longue liste
/// de produits comme le ferait un simple scroll vertical.
class PosPage extends StatefulWidget {
  const PosPage({super.key});

  @override
  State<PosPage> createState() => _PosPageState();
}

class _PosPageState extends State<PosPage> {
  List<Product> _products = [];
  List<ProductCategory> _categories = [];
  bool _loadingProducts = true;
  String? _error;

  String _searchTerm = '';
  int? _selectedCategoryId;

  final List<CartItem> _cart = [];
  num _discountPercent = 0;
  num _taxPercent = 0;
  String _paymentMethod = 'CASH';
  bool _submitting = false;
  int _drawerRefreshSignal = 0;

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    setState(() => _loadingProducts = true);
    try {
      final catalogApi = context.read<CatalogApi>();
      final results = await Future.wait([catalogApi.listActiveProducts(), catalogApi.listCategories()]);
      if (!mounted) return;
      setState(() {
        _products = results[0] as List<Product>;
        _categories = results[1] as List<ProductCategory>;
        _error = null;
        _loadingProducts = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loadingProducts = false;
      });
    }
  }

  List<Product> get _filteredProducts {
    final term = _searchTerm.toLowerCase();
    return _products.where((p) {
      final matchesSearch = p.name.toLowerCase().contains(term) || (p.reference ?? '').toLowerCase().contains(term);
      final matchesCategory = _selectedCategoryId == null || p.categoryId == _selectedCategoryId;
      return matchesSearch && matchesCategory;
    }).toList();
  }

  int _cartQuantityFor(int productId) {
    for (final item in _cart) {
      if (item.productId == productId) return item.quantity;
    }
    return 0;
  }

  void _addToCart(Product product, int requestedQty) {
    if (requestedQty <= 0) return;
    final existingIndex = _cart.indexWhere((i) => i.productId == product.id);
    final currentQty = existingIndex >= 0 ? _cart[existingIndex].quantity : 0;
    final newQuantity = currentQty + requestedQty;

    if (newQuantity > product.quantity) {
      setState(() {
        _error = 'Stock insuffisant pour "${product.name}" : ${product.quantity} disponible'
            '${currentQty > 0 ? ', $currentQty déjà dans le panier.' : '.'}';
      });
      return;
    }

    setState(() {
      _error = null;
      final normalUnitPrice = product.effectiveUnitPriceFor(newQuantity);
      if (existingIndex >= 0) {
        final existing = _cart[existingIndex];
        existing.quantity = newQuantity;
        // Si un prix négocié a déjà été saisi, on le garde — sauf s'il
        // retombe sous le nouveau plancher (le palier de quantité a pu
        // changer), auquel cas on le relève juste ce qu'il faut.
        existing.unitPrice =
            existing.priceEdited ? math.max(existing.unitPrice, normalUnitPrice) : normalUnitPrice;
      } else {
        _cart.add(CartItem(
          productId: product.id,
          productName: product.name,
          quantity: newQuantity,
          unitPrice: normalUnitPrice,
          availableStock: product.quantity,
        ));
      }
    });
  }

  void _removeFromCart(int productId) {
    setState(() {
      _cart.removeWhere((i) => i.productId == productId);
      _error = null;
    });
  }

  void _updateQuantity(int productId, int newQty) {
    if (newQty <= 0) {
      _removeFromCart(productId);
      return;
    }
    Product? product;
    for (final p in _products) {
      if (p.id == productId) {
        product = p;
        break;
      }
    }
    final selectedProduct = product;
    if (selectedProduct != null && newQty > selectedProduct.quantity) {
      setState(() =>
          _error = 'Stock insuffisant pour "${selectedProduct.name}" (disponible : ${selectedProduct.quantity}).');
      return;
    }
    setState(() {
      _error = null;
      final index = _cart.indexWhere((i) => i.productId == productId);
      if (index >= 0) {
        final item = _cart[index];
        item.quantity = newQty;
        if (selectedProduct != null) {
          final normalUnitPrice = selectedProduct.effectiveUnitPriceFor(newQty);
          item.unitPrice = item.priceEdited ? math.max(item.unitPrice, normalUnitPrice) : normalUnitPrice;
        }
      }
    });
  }

  // Prix négocié à la vente (§39_prix_editable_vente.sql, décidé en
  // conversation) — volontairement PAS clampé au fil de la saisie (ça
  // empêcherait de taper "15000" si le plancher est "12000" : le premier
  // "1" serait aussitôt remonté à 12000). On laisse taper librement, et on
  // n'empêche que la validation finale si le prix retombe sous le
  // plancher (voir _cartHasPriceBelowFloor). Le serveur revérifie de toute
  // façon ce même plancher indépendamment à la création de la vente.
  void _updateUnitPrice(int productId, String rawValue) {
    final parsed = math.max(0, num.tryParse(rawValue) ?? 0);
    setState(() {
      final index = _cart.indexWhere((i) => i.productId == productId);
      if (index >= 0) {
        _cart[index].unitPrice = parsed;
        _cart[index].priceEdited = true;
      }
    });
  }

  num _normalUnitPriceFor(CartItem item) {
    for (final p in _products) {
      if (p.id == item.productId) return p.effectiveUnitPriceFor(item.quantity);
    }
    return item.unitPrice;
  }

  bool get _cartHasPriceBelowFloor {
    final roleCode = context.read<AuthState>().activeStore?.roleCode;
    if (roleCode == 'OWNER') return false;
    return _cart.any((item) => item.priceEdited && item.unitPrice < _normalUnitPriceFor(item));
  }

  num get _subtotal => _cart.fold(0, (sum, item) => sum + item.lineTotal);
  num get _discountAmount => _subtotal * _discountPercent / 100;
  num get _taxAmount => (_subtotal - _discountAmount) * _taxPercent / 100;
  num get _total => _subtotal - _discountAmount + _taxAmount;
  int get _itemCount => _cart.fold(0, (sum, item) => sum + item.quantity);

  Future<void> _startCheckout() async {
    if (_cart.isEmpty) {
      setState(() => _error = 'Le panier est vide.');
      return;
    }
    if (_cartHasPriceBelowFloor) {
      setState(() => _error = 'Un prix saisi est inférieur au prix minimum autorisé — corrigez-le avant de continuer.');
      return;
    }
    setState(() => _error = null);

    final customer = await showCustomerStepSheet(context);
    if (customer == null || !mounted) return;

    final amountPaid = await showOrderSummarySheet(
      context,
      cart: _cart,
      subtotal: _subtotal,
      discountAmount: _discountAmount,
      taxAmount: _taxAmount,
      total: _total,
      paymentMethod: _paymentMethod,
      customer: customer,
    );
    if (amountPaid == null || !mounted) return;

    await _confirmOrder(customer, amountPaid);
  }

  Future<void> _confirmOrder(SelectedCustomer customer, num amountPaid) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final order = await context.read<OrdersApi>().createOrder(
            items: _cart,
            paymentMethod: _paymentMethod,
            discount: _discountAmount,
            tax: _taxAmount,
            amountPaid: amountPaid,
            customer: customer,
          );
      if (!mounted) return;
      setState(() {
        _cart.clear();
        _discountPercent = 0;
        _taxPercent = 0;
        _paymentMethod = 'CASH';
        _drawerRefreshSignal++;
      });
      await _loadCatalog();
      if (!mounted) return;
      await showReceiptSheet(context, order);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    // Owner : toujours. Vendeur : seulement si autorisé
    // (§39_prix_editable_vente.sql) — revérifié de toute façon côté
    // serveur à la création de la vente.
    final canEditPrice = authState.activeStore?.roleCode == 'OWNER' || authState.canEditPrice;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadCatalog,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              children: [
                CashDrawerBanner(refreshSignal: _drawerRefreshSignal),
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      children: [
                        Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5))),
                        InkWell(onTap: () => setState(() => _error = null), child: const Icon(Icons.close, size: 16, color: Colors.red)),
                      ],
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        onChanged: (value) => setState(() => _searchTerm = value),
                        decoration: const InputDecoration(
                          hintText: 'Rechercher un produit...',
                          prefixIcon: Icon(Icons.search, size: 20),
                          border: OutlineInputBorder(),
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ),
                  ],
                ),
                if (_categories.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 34,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _CategoryChip(
                          label: 'Toutes catégories',
                          selected: _selectedCategoryId == null,
                          onTap: () => setState(() => _selectedCategoryId = null),
                        ),
                        for (final category in _categories)
                          Padding(
                            padding: const EdgeInsets.only(left: 6),
                            child: _CategoryChip(
                              label: category.name,
                              selected: _selectedCategoryId == category.id,
                              onTap: () => setState(() => _selectedCategoryId = category.id),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                if (_loadingProducts)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_filteredProducts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: Center(child: Text('Aucun produit trouvé.', style: TextStyle(color: Colors.grey))),
                  )
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _filteredProducts.length,
                    // Hauteur fixe (plutôt qu'un ratio largeur/hauteur) —
                    // le contenu de la carte est de forme connue et
                    // constante (voir _PosProductCard), donc une hauteur
                    // choisie une fois pour l'accueillir largement est
                    // sûre par construction, quelle que soit la largeur
                    // d'écran — contrairement à un ratio, qui recalcule la
                    // hauteur disponible à partir de la largeur et peut la
                    // rendre trop juste sur un petit téléphone (c'est ce
                    // qui causait les débordements constatés).
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      // Marge volontairement généreuse au-delà de la
                      // hauteur calculée du contenu (~307px à 188px de
                      // large) : absorbe aussi un texte système agrandi
                      // (accessibilité), sans quoi le même bug reviendrait
                      // dès qu'un utilisateur augmente la taille de police.
                      mainAxisExtent: 330,
                    ),
                    itemBuilder: (context, index) {
                      final product = _filteredProducts[index];
                      return _PosProductCard(
                        product: product,
                        cartQuantity: _cartQuantityFor(product.id),
                        onAdd: (qty) => _addToCart(product, qty),
                      );
                    },
                  ),
                const SizedBox(height: 90),
              ],
            ),
          ),
        ),
        _CartSummaryBar(
          itemCount: _itemCount,
          total: _total,
          submitting: _submitting,
          onTap: _cart.isEmpty
              ? null
              : () => _showCartSheet(context, canEditPrice),
        ),
      ],
    );
  }

  void _showCartSheet(BuildContext context, bool canEditPrice) {
    final isOwner = context.read<AuthState>().activeStore?.roleCode == 'OWNER';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) => Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Panier', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
                      child: Text('$_itemCount article${_itemCount > 1 ? 's' : ''}', style: const TextStyle(fontSize: 11)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: _cart.isEmpty
                      ? const Center(child: Text('Le panier est vide.', style: TextStyle(color: Colors.grey)))
                      : ListView(
                          controller: scrollController,
                          children: [
                            for (final item in _cart)
                              Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10)),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(child: Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13))),
                                        InkWell(
                                          onTap: () {
                                            _removeFromCart(item.productId);
                                            setSheetState(() {});
                                          },
                                          child: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            _qtyButton(Icons.remove, () {
                                              _updateQuantity(item.productId, item.quantity - 1);
                                              setSheetState(() {});
                                            }),
                                            Container(
                                              width: 36,
                                              alignment: Alignment.center,
                                              child: Text('${item.quantity}', style: const TextStyle(fontSize: 13)),
                                            ),
                                            _qtyButton(Icons.add, () {
                                              _updateQuantity(item.productId, item.quantity + 1);
                                              setSheetState(() {});
                                            }),
                                          ],
                                        ),
                                        Flexible(
                                          child: Text(
                                            formatGNF(item.lineTotal),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            textAlign: TextAlign.right,
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (canEditPrice) ...[
                                      const SizedBox(height: 6),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text('Prix unitaire négocié', style: TextStyle(fontSize: 11, color: Colors.grey)),
                                          SizedBox(
                                            width: 90,
                                            child: TextField(
                                              key: ValueKey('price-${item.productId}'),
                                              keyboardType: TextInputType.number,
                                              textAlign: TextAlign.right,
                                              controller: TextEditingController(text: '${item.unitPrice}'),
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: !isOwner && item.priceEdited && item.unitPrice < _normalUnitPriceFor(item)
                                                    ? Colors.red
                                                    : null,
                                              ),
                                              decoration: InputDecoration(
                                                isDense: true,
                                                contentPadding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                                                border: const OutlineInputBorder(),
                                                enabledBorder: OutlineInputBorder(
                                                  borderSide: BorderSide(
                                                    color: !isOwner && item.priceEdited && item.unitPrice < _normalUnitPriceFor(item)
                                                        ? Colors.red.shade300
                                                        : Colors.grey.shade300,
                                                  ),
                                                ),
                                              ),
                                              onChanged: (value) {
                                                _updateUnitPrice(item.productId, value);
                                                setSheetState(() {});
                                              },
                                            ),
                                          ),
                                        ],
                                      ),
                                      if (!isOwner && item.priceEdited && item.unitPrice < _normalUnitPriceFor(item))
                                        Padding(
                                          padding: const EdgeInsets.only(top: 2),
                                          child: Text(
                                            'Minimum : ${formatGNF(_normalUnitPriceFor(item))}',
                                            style: const TextStyle(fontSize: 10.5, color: Colors.red),
                                          ),
                                        ),
                                    ],
                                  ],
                                ),
                              ),
                          ],
                        ),
                ),
                const Divider(),
                _totalsLine('Sous-total', formatGNF(_subtotal)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Réduction (%)', style: TextStyle(fontSize: 12.5, color: Colors.grey)),
                    SizedBox(
                      width: 70,
                      child: TextField(
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        controller: TextEditingController(text: _discountPercent == 0 ? '' : '$_discountPercent'),
                        decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 6), border: OutlineInputBorder()),
                        onChanged: (value) {
                          final parsed = (num.tryParse(value) ?? 0).clamp(0, 100);
                          setState(() => _discountPercent = parsed);
                          setSheetState(() {});
                        },
                      ),
                    ),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Taxe (%)', style: TextStyle(fontSize: 12.5, color: Colors.grey)),
                    SizedBox(
                      width: 70,
                      child: TextField(
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        controller: TextEditingController(text: _taxPercent == 0 ? '' : '$_taxPercent'),
                        decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 6), border: OutlineInputBorder()),
                        onChanged: (value) {
                          final parsed = (num.tryParse(value) ?? 0).clamp(0, 100);
                          setState(() => _taxPercent = parsed);
                          setSheetState(() {});
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                _totalsLine('TOTAL', formatGNF(_total), bold: true),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _paymentMethod,
                  decoration: const InputDecoration(labelText: 'Méthode de paiement', border: OutlineInputBorder(), isDense: true),
                  items: const [
                    DropdownMenuItem(value: 'CASH', child: Text('Espèces')),
                    DropdownMenuItem(value: 'MOBILE_MONEY', child: Text('Mobile Money')),
                    DropdownMenuItem(value: 'CARD', child: Text('Carte')),
                    DropdownMenuItem(value: 'OTHER', child: Text('Autre')),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _paymentMethod = value);
                    setSheetState(() {});
                  },
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _cart.isEmpty || _submitting || _cartHasPriceBelowFloor
                      ? null
                      : () {
                          Navigator.of(sheetContext).pop();
                          _startCheckout();
                        },
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  child: Text(_submitting ? 'Validation en cours...' : 'Valider la vente'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _qtyButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
        child: Icon(icon, size: 14),
      ),
    );
  }

  Widget _totalsLine(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: bold ? 14 : 12.5, fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
          const Spacer(),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: bold ? 14 : 12.5, fontWeight: bold ? FontWeight.w700 : FontWeight.normal)),
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(label: Text(label, style: const TextStyle(fontSize: 12)), selected: selected, onSelected: (_) => onTap());
  }
}

class _CartSummaryBar extends StatelessWidget {
  const _CartSummaryBar({required this.itemCount, required this.total, required this.submitting, required this.onTap});

  final int itemCount;
  final num total;
  final bool submitting;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          color: Theme.of(context).colorScheme.surface,
          child: Row(
            children: [
              Icon(Icons.shopping_cart_outlined, color: onTap == null ? Colors.grey : Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  itemCount == 0 ? 'Panier vide' : '$itemCount article${itemCount > 1 ? 's' : ''} — ${formatGNF(total)}',
                  style: TextStyle(fontWeight: FontWeight.w600, color: onTap == null ? Colors.grey : null),
                ),
              ),
              if (onTap != null) const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _PosProductCard extends StatefulWidget {
  const _PosProductCard({required this.product, required this.cartQuantity, required this.onAdd});

  final Product product;
  final int cartQuantity;
  final void Function(int quantity) onAdd;

  @override
  State<_PosProductCard> createState() => _PosProductCardState();
}

class _PosProductCardState extends State<_PosProductCard> {
  int _quantity = 1;

  void _changeQuantity(int delta) {
    final next = _quantity + delta;
    if (next < 1) return;
    setState(() => _quantity = next);
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final isOutOfStock = product.quantity == 0;
    final isLow = !isOutOfStock && product.quantity <= product.lowStockThreshold;
    final hasTiers = product.priceTiers.isNotEmpty;
    final primary = Theme.of(context).colorScheme.primary;
    final inCart = widget.cartQuantity > 0;

    final Color stockColor = isOutOfStock ? Colors.red.shade600 : (isLow ? Colors.amber.shade800 : Colors.green.shade700);
    final String stockLabel = isOutOfStock ? 'Rupture de stock' : (isLow ? 'Stock faible : ${product.quantity}' : 'En stock : ${product.quantity}');

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: inCart ? primary : Colors.grey.shade200, width: inCart ? 1.5 : 1),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // --- Image + badges superposés : évite d'empiler encore plus
          // de lignes de texte (rupture, panier, prix dégressif) sous la
          // carte, ce qui est justement ce qui provoquait les
          // débordements — l'info reste visible, juste condensée.
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 1.35,
                child: Container(
                  color: Colors.grey.shade50,
                  child: product.imageUrl != null
                      ? Image.network(product.imageUrl!, fit: BoxFit.cover)
                      : Icon(Icons.inventory_2_outlined, color: Colors.grey.shade300, size: 30),
                ),
              ),
              if (hasTiers)
                Positioned(
                  top: 8,
                  left: 8,
                  child: _Badge(
                    color: Colors.amber.shade600,
                    icon: Icons.percent,
                    tooltip: 'Prix dégressif selon la quantité',
                  ),
                ),
              if (inCart)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: primary, borderRadius: BorderRadius.circular(20)),
                    child: Text('${widget.cartQuantity} au panier',
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: 32,
                  child: Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, height: 1.15),
                  ),
                ),
                const SizedBox(height: 3),
                Text(formatGNF(product.sellingPrice),
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: primary)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(color: stockColor, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(stockLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: stockColor)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (isOutOfStock)
                  Container(
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(10)),
                    child: Text('Indisponible', style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                  )
                else ...[
                  // Compteur à taper (+/-) plutôt qu'un champ clavier : plus
                  // sûr au toucher, pas de clavier numérique qui surgit et
                  // recompose l'écran (source elle aussi de débordements
                  // fugaces), plus simple pour un public peu à l'aise avec
                  // la saisie sur téléphone.
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _StepperButton(icon: Icons.remove, onTap: () => _changeQuantity(-1)),
                      SizedBox(
                        width: 32,
                        child: Text('$_quantity', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      ),
                      _StepperButton(icon: Icons.add, onTap: () => _changeQuantity(1)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 34,
                    child: Semantics(
                      label: 'Ajouter ${product.name} au panier',
                      button: true,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          padding: EdgeInsets.zero,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          widget.onAdd(_quantity);
                          setState(() => _quantity = 1);
                        },
                        child: const Text('Ajouter', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                      ),
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

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, size: 16, color: Colors.grey.shade700),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.color, required this.icon, required this.tooltip});

  final Color color;
  final IconData icon;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        child: Icon(icon, size: 12, color: Colors.white),
      ),
    );
  }
}
