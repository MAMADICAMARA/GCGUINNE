import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../state/auth_state.dart';
import '../../../account/data/stores_api.dart';
import '../../data/purchases_api.dart';
import '../../data/supplier_models.dart';
import '../../data/suppliers_api.dart';
import '../settings/subscription_plans_page.dart';

/// Miroir de SupplierStorefrontPage.jsx (§29_commande_depuis_fournisseur_plateforme.sql)
/// — vitrine d'un fournisseur de la plateforme : parcourir son catalogue
/// reste ouvert à tous les plans, mais commander exige le plan PREMIUM DE
/// L'ACHETEUR (jamais celui du fournisseur, déjà vérifié séparément pour
/// accéder au catalogue). Le stock du fournisseur n'est jamais montré ; son
/// prix de vente n'est qu'une référence, modifiable ligne par ligne — c'est
/// un prix convenu, pas un prix de vente fixe comme à la Caisse.
class SupplierStorefrontPage extends StatefulWidget {
  const SupplierStorefrontPage({super.key, required this.storeId});

  final int storeId;

  @override
  State<SupplierStorefrontPage> createState() => _SupplierStorefrontPageState();
}

class _SupplierStorefrontPageState extends State<SupplierStorefrontPage> {
  SupplierOrderCatalog? _catalog;
  bool _allowsPurchaseOrders = false;
  bool _loading = true;
  String? _loadError;

  String _search = '';
  String? _selectedCategory;

  final List<SupplierCartItem> _cart = [];
  final _referenceController = TextEditingController();
  String? _error;
  String? _successMessage;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final suppliersApi = context.read<SuppliersApi>();
      final storesApi = context.read<StoresApi>();
      final results = await Future.wait([
        suppliersApi.getOrderCatalog(widget.storeId),
        storesApi.getPlanStatus(),
      ]);
      if (!mounted) return;
      setState(() {
        _catalog = results[0] as SupplierOrderCatalog;
        _allowsPurchaseOrders = (results[1] as PlanStatus).allowsPurchaseOrders;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _loadError = err.message;
        _loading = false;
      });
    }
  }

  List<SupplierProduct> get _filteredProducts {
    final catalog = _catalog;
    if (catalog == null) return [];
    final term = _search.toLowerCase();
    return catalog.products.where((p) {
      final matchesSearch = p.name.toLowerCase().contains(term) ||
          (p.reference ?? '').toLowerCase().contains(term);
      final matchesCategory =
          _selectedCategory == null || p.categoryName == _selectedCategory;
      return matchesSearch && matchesCategory;
    }).toList();
  }

  List<String> get _categories => (_catalog?.products
          .map((p) => p.categoryName)
          .whereType<String>()
          .toSet()
          .toList() ??
      [])
    ..sort();

  int _cartQuantityFor(int productId) {
    for (final item in _cart) {
      if (item.supplierProductId == productId) return item.quantity;
    }
    return 0;
  }

  // § décidé en conversation, réduction des doublons : à l'ajout au panier
  // (jamais après, voir le fil de discussion sur l'immuabilité des lignes
  // de commande), on cherche tout de suite si ce produit ressemble à un
  // produit déjà présent dans le catalogue DE L'ACHETEUR. Simple
  // suggestion, jamais un rapprochement automatique silencieux.
  Future<void> _addToCart(SupplierProduct product, int quantity) async {
    if (quantity <= 0) return;
    final index = _cart.indexWhere((i) => i.supplierProductId == product.id);
    if (index >= 0) {
      setState(() => _cart[index].quantity += quantity);
      return;
    }

    setState(() => _cart.add(SupplierCartItem(
          supplierProductId: product.id,
          productName: product.name,
          quantity: quantity,
          unitPrice: product.sellingPrice,
        )));

    try {
      final suggestions = await context
          .read<PurchasesApi>()
          .suggestMatchingProducts(product.name);
      if (!mounted || suggestions.isEmpty) return;
      final item = _cart.firstWhere((i) => i.supplierProductId == product.id,
          orElse: () => _cart.first);
      if (item.supplierProductId != product.id) return;
      setState(() => item.suggestion = suggestions.first);
    } on ApiException catch (_) {
      // Silencieux : une suggestion qui échoue à charger ne doit jamais
      // bloquer l'ajout au panier, simple confort.
    }
  }

  void _confirmMatch(SupplierCartItem item, bool matched) {
    setState(() {
      item.matchedProductId = matched ? item.suggestion?.id : null;
      item.suggestionDismissed = true;
    });
  }

  num get _total => _cart.fold(0, (sum, item) => sum + item.lineTotal);
  int get _itemCount => _cart.fold(0, (sum, item) => sum + item.quantity);

  Future<void> _submitOrder() async {
    if (_cart.isEmpty) {
      setState(() => _error = 'Le panier est vide.');
      return;
    }
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await context.read<PurchasesApi>().createOrderFromSupplierStore(
            supplierStoreId: widget.storeId,
            reference: _referenceController.text.trim().isEmpty
                ? null
                : _referenceController.text.trim(),
            items: _cart,
          );
      if (!mounted) return;
      setState(() {
        _successMessage =
            'Commande créée — retrouvez-la dans "Achats" pour la marquer reçue.';
        _cart.clear();
        _referenceController.clear();
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = context.read<AuthState>().activeStore?.roleCode == 'OWNER';
    return Scaffold(
      appBar: AppBar(title: Text(_catalog?.supplierName ?? 'Fournisseur')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadError != null
              ? Padding(
                  padding: const EdgeInsets.all(20),
                  child: Text(_loadError!,
                      style: const TextStyle(color: Colors.red)))
              : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                        children: [
                          Text(
                            'Prix indiqués à titre de référence — le stock de cette boutique reste privé.',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey.shade500),
                          ),
                          const SizedBox(height: 10),
                          if (!_allowsPurchaseOrders)
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                  color: Colors.amber.shade50,
                                  borderRadius: BorderRadius.circular(10)),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Passer commande est réservé au plan PREMIUM — vous pouvez toujours parcourir le catalogue.',
                                    style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.amber.shade800),
                                  ),
                                  if (isOwner) ...[
                                    const SizedBox(height: 8),
                                    SizedBox(
                                      height: 30,
                                      child: FilledButton(
                                        onPressed: () => Navigator.of(context)
                                            .push(MaterialPageRoute(
                                                builder: (_) =>
                                                    const SubscriptionPlansPage())),
                                        style: FilledButton.styleFrom(
                                          backgroundColor:
                                              Colors.amber.shade600,
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 12),
                                          textStyle: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700),
                                        ),
                                        child: const Text(
                                            'Passer au plan supérieur'),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          if (_error != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                  color: Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(10)),
                              child: Text(_error!,
                                  style: const TextStyle(
                                      color: Colors.red, fontSize: 13)),
                            ),
                          if (_successMessage != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(10)),
                              child: Text(_successMessage!,
                                  style: TextStyle(
                                      color: Colors.green.shade800,
                                      fontSize: 12.5)),
                            ),
                          TextField(
                            onChanged: (value) =>
                                setState(() => _search = value),
                            decoration: const InputDecoration(
                              hintText: 'Rechercher un produit...',
                              prefixIcon: Icon(Icons.search, size: 20),
                              border: OutlineInputBorder(),
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                            ),
                          ),
                          if (_categories.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 34,
                              child: ListView(
                                scrollDirection: Axis.horizontal,
                                children: [
                                  ChoiceChip(
                                      label: const Text('Toutes catégories',
                                          style: TextStyle(fontSize: 12)),
                                      selected: _selectedCategory == null,
                                      onSelected: (_) => setState(
                                          () => _selectedCategory = null)),
                                  for (final category in _categories) ...[
                                    const SizedBox(width: 6),
                                    ChoiceChip(
                                        label: Text(category,
                                            style:
                                                const TextStyle(fontSize: 12)),
                                        selected: _selectedCategory == category,
                                        onSelected: (_) => setState(() =>
                                            _selectedCategory = category)),
                                  ],
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 14),
                          if (_filteredProducts.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 40),
                              child: Center(
                                  child: Text('Aucun produit trouvé.',
                                      style: TextStyle(
                                          color: Colors.grey.shade500))),
                            )
                          else
                            GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _filteredProducts.length,
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                mainAxisExtent: 330,
                              ),
                              itemBuilder: (context, index) {
                                final product = _filteredProducts[index];
                                return _SupplierProductCard(
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
                    _CartSummaryBar(
                      itemCount: _itemCount,
                      total: _total,
                      onTap:
                          _cart.isEmpty ? null : () => _showCartSheet(context),
                    ),
                  ],
                ),
    );
  }

  void _showCartSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          // SafeArea(top: false) — même correctif que pos_page.dart#_showCartSheet :
          // sans elle, le bouton "Commander" tout en bas se retrouve sous la
          // barre de navigation système sur un téléphone à boutons classiques.
          builder: (context, scrollController) => SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Text('Panier',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20)),
                        child: Text(
                            '$_itemCount article${_itemCount > 1 ? 's' : ''}',
                            style: const TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Expanded(
                    child: ListView(
                      controller: scrollController,
                      children: [
                        for (final item in _cart)
                          Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                                color: Colors.grey.shade50,
                                borderRadius: BorderRadius.circular(10)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                        child: Text(item.productName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13))),
                                    InkWell(
                                      onTap: () {
                                        setState(() => _cart.removeWhere((i) =>
                                            i.supplierProductId ==
                                            item.supplierProductId));
                                        setSheetState(() {});
                                      },
                                      child: const Icon(Icons.delete_outline,
                                          size: 18, color: Colors.redAccent),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextField(
                                        controller: TextEditingController(
                                            text: '${item.quantity}'),
                                        keyboardType: TextInputType.number,
                                        decoration: const InputDecoration(
                                            labelText: 'Quantité',
                                            isDense: true,
                                            border: OutlineInputBorder()),
                                        onChanged: (value) {
                                          final qty = int.tryParse(value);
                                          setState(() => item.quantity =
                                              (qty == null || qty < 1)
                                                  ? 1
                                                  : qty);
                                          setSheetState(() {});
                                        },
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: TextField(
                                        controller: TextEditingController(
                                            text: item.unitPrice
                                                .toStringAsFixed(0)),
                                        keyboardType: TextInputType.number,
                                        decoration: const InputDecoration(
                                            labelText: 'Prix/u.',
                                            isDense: true,
                                            border: OutlineInputBorder()),
                                        onChanged: (value) {
                                          final price = num.tryParse(value);
                                          setState(() =>
                                              item.unitPrice = price ?? 0);
                                          setSheetState(() {});
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Align(
                                    alignment: Alignment.centerRight,
                                    child: Text(formatGNF(item.lineTotal),
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13))),
                                if (item.suggestion != null &&
                                    !item.suggestionDismissed) ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                        color: Colors.blue.shade50,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                            color: Colors.blue.shade100)),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        RichText(
                                          text: TextSpan(
                                            style: TextStyle(
                                                fontSize: 11.5,
                                                color: Colors.blue.shade900),
                                            children: [
                                              const TextSpan(
                                                  text:
                                                      'Vous avez peut-être déjà ce produit : '),
                                              TextSpan(
                                                  text: item.suggestion!.name,
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w700)),
                                              const TextSpan(
                                                  text: " — c'est le même ?"),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            TextButton(
                                              style: TextButton.styleFrom(
                                                  backgroundColor:
                                                      Colors.blue.shade600,
                                                  foregroundColor: Colors.white,
                                                  minimumSize:
                                                      const Size(0, 30),
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 10)),
                                              onPressed: () {
                                                _confirmMatch(item, true);
                                                setSheetState(() {});
                                              },
                                              child: const Text('Oui, le même',
                                                  style: TextStyle(
                                                      fontSize: 11.5)),
                                            ),
                                            const SizedBox(width: 8),
                                            TextButton(
                                              style: TextButton.styleFrom(
                                                  foregroundColor:
                                                      Colors.blue.shade700,
                                                  minimumSize:
                                                      const Size(0, 30),
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 10)),
                                              onPressed: () {
                                                _confirmMatch(item, false);
                                                setSheetState(() {});
                                              },
                                              child: const Text(
                                                  'Non, différent',
                                                  style: TextStyle(
                                                      fontSize: 11.5)),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                                if (item.matchedProductId != null) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                      '✓ Rapproché à votre produit existant — aucun doublon créé.',
                                      style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.green.shade700)),
                                ],
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  const Divider(),
                  TextField(
                    controller: _referenceController,
                    decoration: const InputDecoration(
                        labelText: 'Référence (optionnel)',
                        hintText: 'Ex : BC-2026-014',
                        border: OutlineInputBorder(),
                        isDense: true),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Text('TOTAL',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                      const Spacer(),
                      Text(formatGNF(_total),
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed:
                        (_cart.isEmpty || _submitting || !_allowsPurchaseOrders)
                            ? null
                            : () {
                                Navigator.of(sheetContext).pop();
                                _submitOrder();
                              },
                    style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(48)),
                    child: Text(!_allowsPurchaseOrders
                        ? 'Réservé au plan PREMIUM'
                        : (_submitting ? 'Envoi...' : 'Commander')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CartSummaryBar extends StatelessWidget {
  const _CartSummaryBar(
      {required this.itemCount, required this.total, required this.onTap});

  final int itemCount;
  final num total;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 8,
      // SafeArea(top: false) — § décidé en conversation, même correctif que
      // pos_page.dart#_CartSummaryBar : sans elle, cette barre se retrouve
      // sous la barre de navigation système sur un téléphone à boutons
      // classiques (ex: Samsung), inaccessible au toucher.
      child: SafeArea(
        top: false,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            color: Theme.of(context).colorScheme.surface,
            child: Row(
              children: [
                Icon(Icons.shopping_cart_outlined,
                    color: onTap == null
                        ? Colors.grey
                        : Theme.of(context).colorScheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    itemCount == 0
                        ? 'Panier vide'
                        : '$itemCount article${itemCount > 1 ? 's' : ''} — ${formatGNF(total)}',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: onTap == null ? Colors.grey : null),
                  ),
                ),
                if (onTap != null) const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SupplierProductCard extends StatefulWidget {
  const _SupplierProductCard(
      {required this.product, required this.cartQuantity, required this.onAdd});

  final SupplierProduct product;
  final int cartQuantity;
  final void Function(int quantity) onAdd;

  @override
  State<_SupplierProductCard> createState() => _SupplierProductCardState();
}

class _SupplierProductCardState extends State<_SupplierProductCard> {
  int _quantity = 1;

  void _changeQuantity(int delta) {
    final next = _quantity + delta;
    if (next < 1) return;
    setState(() => _quantity = next);
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final primary = Theme.of(context).colorScheme.primary;
    final inCart = widget.cartQuantity > 0;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: inCart ? primary : Colors.grey.shade200,
            width: inCart ? 1.5 : 1),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 1.35,
                child: Container(
                  color: Colors.grey.shade50,
                  child: product.imageUrl != null
                      ? Image.network(product.imageUrl!, fit: BoxFit.cover)
                      : Icon(Icons.inventory_2_outlined,
                          color: Colors.grey.shade300, size: 30),
                ),
              ),
              if (inCart)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                        color: primary,
                        borderRadius: BorderRadius.circular(20)),
                    child: Text('${widget.cartQuantity} au panier',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700)),
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
                  child: Text(product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          height: 1.15)),
                ),
                const SizedBox(height: 3),
                Text(formatGNF(product.sellingPrice),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: primary)),
                const SizedBox(height: 2),
                Text(product.categoryName ?? 'Sans catégorie',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        TextStyle(fontSize: 10.5, color: Colors.grey.shade500)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _StepperButton(
                        icon: Icons.remove, onTap: () => _changeQuantity(-1)),
                    SizedBox(
                        width: 32,
                        child: Text('$_quantity',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700))),
                    _StepperButton(
                        icon: Icons.add, onTap: () => _changeQuantity(1)),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 34,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10))),
                    onPressed: () {
                      widget.onAdd(_quantity);
                      setState(() => _quantity = 1);
                    },
                    child: const Text('Ajouter',
                        style: TextStyle(
                            fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ),
                ),
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
        decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, size: 16, color: Colors.grey.shade700),
      ),
    );
  }
}
