import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/pos_models.dart';
import '../../data/products_api.dart';

/// Miroir de AdjustStockModal.jsx — ajustement manuel après comptage
/// physique. Le motif est obligatoire : toute variation de stock doit
/// rester traçable, aucune modification silencieuse tolérée (même règle
/// appliquée côté serveur).
///
/// Retourne la nouvelle quantité si l'ajustement a réussi, `null` sinon.
Future<int?> showAdjustStockSheet(BuildContext context, Product product) {
  return showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _AdjustStockSheet(product: product),
  );
}

class _AdjustStockSheet extends StatefulWidget {
  const _AdjustStockSheet({required this.product});

  final Product product;

  @override
  State<_AdjustStockSheet> createState() => _AdjustStockSheetState();
}

class _AdjustStockSheetState extends State<_AdjustStockSheet> {
  String _direction = 'IN'; // 'IN' (+) ou 'OUT' (-)
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  String? _error;
  bool _submitting = false;

  int get _parsedAmount => int.tryParse(_amountController.text) ?? 0;
  int get _delta => _direction == 'IN' ? _parsedAmount : -_parsedAmount;
  int get _projectedQuantity => widget.product.quantity + _delta;

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    if (_parsedAmount <= 0) {
      setState(() => _error = 'Veuillez saisir une quantité positive.');
      return;
    }
    if (_noteController.text.trim().isEmpty) {
      setState(() => _error = 'Le motif est obligatoire (ex : comptage physique, casse, perte...).');
      return;
    }
    if (_projectedQuantity < 0) {
      setState(() => _error = 'Cet ajustement ferait passer le stock à $_projectedQuantity (négatif) : impossible.');
      return;
    }

    setState(() => _submitting = true);
    final productsApi = context.read<ProductsApi>();
    try {
      final result = await productsApi.adjustStock(
        productId: widget.product.id,
        delta: _delta,
        note: _noteController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(result.newQuantity);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Ajuster le stock', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 4),
              Text(widget.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
              Text('Stock actuel : ${widget.product.quantity}', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              const SizedBox(height: 16),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              const Text('Sens', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: _DirectionButton(
                      label: '+ Entrée',
                      selected: _direction == 'IN',
                      color: Colors.green,
                      onTap: () => setState(() => _direction = 'IN'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _DirectionButton(
                      label: '− Sortie',
                      selected: _direction == 'OUT',
                      color: Colors.red,
                      onTap: () => setState(() => _direction = 'OUT'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Quantité', hintText: 'Ex : 5', border: OutlineInputBorder()),
              ),
              if (_parsedAmount > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Nouveau stock estimé : $_projectedQuantity', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                ),
              const SizedBox(height: 14),
              TextField(
                controller: _noteController,
                minLines: 2,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Motif (obligatoire)',
                  hintText: 'Ex : Comptage physique du 25/07 — écart constaté',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Enregistrement...' : "Confirmer l'ajustement"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DirectionButton extends StatelessWidget {
  const _DirectionButton({required this.label, required this.selected, required this.color, required this.onTap});

  final String label;
  final bool selected;
  final MaterialColor color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? color.shade50 : Colors.white,
          border: Border.all(color: selected ? color.shade400 : Colors.grey.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          label,
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: selected ? color.shade700 : Colors.grey.shade600),
        ),
      ),
    );
  }
}
