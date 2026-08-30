import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/pos_models.dart';
import '../../data/stock_transfers_api.dart';

/// Étape 2 du transfert de stock (§45_transfert_de_stock.sql) — code de
/// transfert de la boutique destination + quantité, avec aperçu en direct.
/// Miroir de StockTransferConfirmModal.jsx. Le code est revérifié
/// intégralement côté serveur à la confirmation.
///
/// Retourne le résultat du transfert si réussi, `null` sinon.
Future<StockTransferResult?> showStockTransferConfirmSheet(BuildContext context, Product product) {
  return showModalBottomSheet<StockTransferResult>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _StockTransferConfirmSheet(product: product),
  );
}

class _StockTransferConfirmSheet extends StatefulWidget {
  const _StockTransferConfirmSheet({required this.product});

  final Product product;

  @override
  State<_StockTransferConfirmSheet> createState() => _StockTransferConfirmSheetState();
}

class _StockTransferConfirmSheetState extends State<_StockTransferConfirmSheet> {
  final _codeController = TextEditingController();
  final _quantityController = TextEditingController();
  Timer? _debounce;

  StockTransferPreview? _resolved;
  bool _resolving = false;
  String? _resolveError;

  bool _submitting = false;
  String? _submitError;

  int get _parsedQuantity => int.tryParse(_quantityController.text) ?? 0;
  bool get _canSubmit =>
      _resolved != null && _parsedQuantity > 0 && _parsedQuantity <= widget.product.quantity;

  @override
  void dispose() {
    _debounce?.cancel();
    _codeController.dispose();
    _quantityController.dispose();
    super.dispose();
  }

  void _onCodeChanged(String value) {
    _debounce?.cancel();
    setState(() {
      _resolved = null;
      _resolveError = null;
    });
    final trimmed = value.trim();
    if (trimmed.length < 6) return;

    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _resolving = true);
      try {
        final preview = await context.read<StockTransfersApi>().resolveCode(trimmed);
        if (!mounted) return;
        setState(() {
          _resolved = preview;
          _resolving = false;
        });
      } on ApiException catch (err) {
        if (!mounted) return;
        setState(() {
          _resolveError = err.message;
          _resolving = false;
        });
      }
    });
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _submitError = null;
      _submitting = true;
    });
    try {
      final result = await context.read<StockTransfersApi>().create(
            transferCode: _codeController.text.trim(),
            productId: widget.product.id,
            quantity: _parsedQuantity,
          );
      if (!mounted) return;
      Navigator.of(context).pop(result);
    } on ApiException catch (err) {
      setState(() => _submitError = err.message);
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
              const Text('Transférer le stock', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 4),
              Text(widget.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
              Text('Stock disponible : ${widget.product.quantity}', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              const SizedBox(height: 16),
              if (_submitError != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_submitError!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              TextField(
                controller: _codeController,
                autofocus: true,
                textCapitalization: TextCapitalization.characters,
                onChanged: _onCodeChanged,
                decoration: const InputDecoration(
                  labelText: 'Code de transfert de la boutique destination',
                  hintText: 'Ex : 8EFE3A973646',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_resolving)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text('Vérification du code...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                ),
              if (_resolveError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, size: 14, color: Colors.red),
                      const SizedBox(width: 4),
                      Expanded(child: Text(_resolveError!, style: const TextStyle(fontSize: 12, color: Colors.red))),
                    ],
                  ),
                ),
              if (_resolved != null)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle, size: 14, color: Colors.green.shade700),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _resolved!.storeTypeLabel != null
                              ? '${_resolved!.storeName} (${_resolved!.storeTypeLabel})'
                              : _resolved!.storeName,
                          style: TextStyle(fontSize: 12.5, color: Colors.green.shade800, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 14),
              TextField(
                controller: _quantityController,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(labelText: 'Quantité à transférer', hintText: 'Ex : 5', border: OutlineInputBorder()),
              ),
              if (_parsedQuantity > widget.product.quantity)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Quantité supérieure au stock disponible (${widget.product.quantity}).',
                    style: const TextStyle(fontSize: 12, color: Colors.red),
                  ),
                ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: (_canSubmit && !_submitting) ? _submit : null,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Transfert en cours...' : 'Confirmer le transfert'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
