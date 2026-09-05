import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/pos_models.dart';
import '../../data/products_api.dart';
import '../../data/purchase_models.dart';
import '../../data/purchases_api.dart';

/// Miroir de CreatePurchaseOrderModal.jsx — commande manuelle vers un
/// fournisseur contact, produits DE CETTE BOUTIQUE, prix d'achat libre par
/// ligne (le total est purement informatif ici, toujours recalculé côté
/// serveur). Retourne `true` si créée.
Future<bool?> showCreatePurchaseOrderSheet(
    BuildContext context, List<SupplierContact> suppliers) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _CreatePurchaseOrderSheet(suppliers: suppliers),
  );
}

class _CreatePurchaseOrderSheet extends StatefulWidget {
  const _CreatePurchaseOrderSheet({required this.suppliers});

  final List<SupplierContact> suppliers;

  @override
  State<_CreatePurchaseOrderSheet> createState() =>
      _CreatePurchaseOrderSheetState();
}

class _CreatePurchaseOrderSheetState extends State<_CreatePurchaseOrderSheet> {
  List<Product> _products = [];
  bool _loadingProducts = true;

  int? _supplierId;
  final _referenceController = TextEditingController();
  final List<PurchaseOrderDraftItem> _rows = [
    PurchaseOrderDraftItem(quantity: 1, purchasePrice: 0)
  ];

  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _referenceController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      final result =
          await context.read<ProductsApi>().list(limit: 200, status: 'ALL');
      if (!mounted) return;
      setState(() {
        _products = result.products;
        _loadingProducts = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loadingProducts = false;
        });
      }
    }
  }

  void _addRow() {
    setState(
        () => _rows.add(PurchaseOrderDraftItem(quantity: 1, purchasePrice: 0)));
  }

  void _removeRow(PurchaseOrderDraftItem row) {
    if (_rows.length == 1) return;
    setState(() => _rows.remove(row));
  }

  num get _total =>
      _rows.fold(0, (sum, row) => sum + row.quantity * row.purchasePrice);

  Future<void> _submit() async {
    setState(() => _error = null);
    if (_supplierId == null) {
      setState(() => _error = 'Choisissez un fournisseur.');
      return;
    }
    final items = _rows.where((r) => r.productId != null).toList();
    if (items.isEmpty) {
      setState(() => _error = 'Ajoutez au moins un article valide.');
      return;
    }

    setState(() => _submitting = true);
    try {
      await context.read<PurchasesApi>().createPurchaseOrder(
            supplierId: _supplierId!,
            reference: _referenceController.text.trim().isEmpty
                ? null
                : _referenceController.text.trim(),
            items: items,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      // SafeArea(top: false) — § décidé en conversation, même correctif que
      // pos_page.dart#_showCartSheet.
      builder: (context, scrollController) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text("Nouvelle commande d'achat",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  children: [
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(10)),
                        child: Text(_error!,
                            style: const TextStyle(
                                color: Colors.red, fontSize: 13)),
                      ),
                    if (widget.suppliers.isEmpty)
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(10)),
                        child: Text(
                          'Ajoutez d\'abord un fournisseur (onglet "Fournisseurs") avant de créer une commande.',
                          style: TextStyle(
                              fontSize: 12.5, color: Colors.amber.shade800),
                        ),
                      )
                    else ...[
                      DropdownButtonFormField<int>(
                        initialValue: _supplierId,
                        decoration: const InputDecoration(
                            labelText: 'Fournisseur',
                            border: OutlineInputBorder(),
                            isDense: true),
                        hint: const Text('Choisir...'),
                        items: [
                          for (final s in widget.suppliers)
                            DropdownMenuItem(value: s.id, child: Text(s.name))
                        ],
                        onChanged: (value) =>
                            setState(() => _supplierId = value),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _referenceController,
                        decoration: const InputDecoration(
                            labelText: 'Référence (optionnel)',
                            hintText: 'Ex : BC-2026-014',
                            border: OutlineInputBorder(),
                            isDense: true),
                      ),
                      const SizedBox(height: 16),
                    ],
                    const Text('Articles',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 13.5)),
                    const SizedBox(height: 8),
                    if (_loadingProducts)
                      const Padding(
                          padding: EdgeInsets.only(top: 20),
                          child: Center(child: CircularProgressIndicator()))
                    else ...[
                      for (final row in _rows)
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
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
                                    child: DropdownButtonFormField<int>(
                                      initialValue: row.productId,
                                      decoration: const InputDecoration(
                                          labelText: 'Produit',
                                          isDense: true,
                                          border: OutlineInputBorder()),
                                      isExpanded: true,
                                      items: [
                                        for (final p in _products)
                                          DropdownMenuItem(
                                              value: p.id,
                                              child: Text(p.name,
                                                  overflow:
                                                      TextOverflow.ellipsis))
                                      ],
                                      onChanged: (value) => setState(() {
                                        row.productId = value;
                                        final product = _products
                                            .where((p) => p.id == value)
                                            .cast<Product?>()
                                            .firstWhere((_) => true,
                                                orElse: () => null);
                                        row.productName = product?.name;
                                        if (row.purchasePrice == 0 &&
                                            product != null)
                                          row.purchasePrice =
                                              product.purchasePrice;
                                      }),
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: _rows.length == 1
                                        ? null
                                        : () => _removeRow(row),
                                    icon: const Icon(Icons.close, size: 18),
                                    color: Colors.red.shade400,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      keyboardType: TextInputType.number,
                                      controller: TextEditingController(
                                          text: '${row.quantity}'),
                                      decoration: const InputDecoration(
                                          labelText: 'Quantité',
                                          isDense: true,
                                          border: OutlineInputBorder()),
                                      onChanged: (value) => setState(() => row
                                          .quantity = int.tryParse(value) ?? 1),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: TextField(
                                      keyboardType: TextInputType.number,
                                      controller: TextEditingController(
                                          text: row.purchasePrice
                                              .toStringAsFixed(0)),
                                      decoration: const InputDecoration(
                                          labelText: 'P.U. achat',
                                          isDense: true,
                                          border: OutlineInputBorder()),
                                      onChanged: (value) => setState(() =>
                                          row.purchasePrice =
                                              num.tryParse(value) ?? 0),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      InkWell(
                        onTap: _addRow,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Text('+ Ajouter une ligne',
                              style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color:
                                      Theme.of(context).colorScheme.primary)),
                        ),
                      ),
                    ],
                    const Divider(height: 24),
                    Row(
                      children: [
                        const Text('Total estimé',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 14)),
                        const Spacer(),
                        Text(formatGNF(_total),
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 14)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed:
                    (_submitting || widget.suppliers.isEmpty) ? null : _submit,
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Création...' : 'Créer la commande'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
