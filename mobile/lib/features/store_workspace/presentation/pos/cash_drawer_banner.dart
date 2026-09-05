import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/cash_drawers_api.dart';
import '../../data/pos_models.dart';

/// Miroir de CashDrawerBanner.jsx (§30_fond_de_caisse.sql, décidé en
/// conversation). Entièrement optionnel : un vendeur qui n'ouvre jamais de
/// caisse continue à encaisser normalement. [refreshSignal] change après
/// chaque vente (bumpé par PosPage) pour réafficher le solde théorique à
/// jour — jamais recalculé ici, toujours côté serveur.
class CashDrawerBanner extends StatefulWidget {
  const CashDrawerBanner({super.key, required this.refreshSignal});

  final int refreshSignal;

  @override
  State<CashDrawerBanner> createState() => _CashDrawerBannerState();
}

class _CashDrawerBannerState extends State<CashDrawerBanner> {
  CashDrawer? _drawer;
  bool _loading = true;
  String? _error;
  CashDrawerCloseResult? _closeResult;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant CashDrawerBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSignal != widget.refreshSignal) _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final drawer = await context.read<CashDrawersApi>().getCurrent();
      if (!mounted) return;
      setState(() {
        _drawer = drawer;
        _loading = false;
      });
    } on ApiException {
      // Silencieux, même raison que côté web : un bandeau qui ne charge
      // pas ne doit jamais bloquer la Caisse elle-même.
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openDrawer(num openingBalance) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<CashDrawersApi>().open(openingBalance);
      await _load();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _closeDrawer(num closingBalance, String note) async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await context
          .read<CashDrawersApi>()
          .close(closingBalance: closingBalance, note: note);
      setState(() => _closeResult = result);
      await _load();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!,
                  style: const TextStyle(color: Colors.red, fontSize: 13)),
            ),
          if (_closeResult != null)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _closeResult!.discrepancy == 0
                    ? Colors.green.shade50
                    : Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _closeResult!.discrepancy == 0
                      ? Colors.green.shade100
                      : Colors.amber.shade200,
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Caisse fermée — théorique ${formatGNF(_closeResult!.expectedBalance)}, compté '
                      '${formatGNF(_closeResult!.closingBalance)}'
                      '${_closeResult!.discrepancy == 0 ? ' — aucun écart.' : ' — écart de ${formatGNF(_closeResult!.discrepancy.abs())} (${_closeResult!.discrepancy > 0 ? 'excédent' : 'manque'}).'}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  TextButton(
                      onPressed: () => setState(() => _closeResult = null),
                      child: const Text('OK')),
                ],
              ),
            ),
          if (_drawer == null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Expanded(
                      child: Text('Caisse fermée',
                          style: TextStyle(color: Colors.grey))),
                  TextButton(
                    onPressed:
                        _submitting ? null : () => _showOpenSheet(context),
                    child: const Text('Ouvrir la caisse'),
                  ),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .primary
                    .withValues(alpha: 0.05),
                border: Border.all(
                    color: Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: 0.2)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Caisse ouverte depuis ${formatDateTime(_drawer!.openingTime)} — solde théorique '
                      '${formatGNF(_drawer!.expectedBalance)}',
                      style: const TextStyle(fontSize: 12.5),
                    ),
                  ),
                  TextButton(
                    onPressed:
                        _submitting ? null : () => _showCloseSheet(context),
                    child: const Text('Fermer'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _showOpenSheet(BuildContext context) {
    final controller = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      // SafeArea(top: false) — § décidé en conversation, même correctif que
      // pos_page.dart#_showCartSheet : sans elle, le bouton "Ouvrir" tout en
      // bas se retrouve sous la barre de navigation système sur un
      // téléphone à boutons classiques.
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Ouvrir la caisse',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: const InputDecoration(
                    labelText: 'Fond de départ (GNF)',
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  final value = num.tryParse(controller.text) ?? 0;
                  Navigator.of(sheetContext).pop();
                  _openDrawer(value);
                },
                child: const Text('Ouvrir'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCloseSheet(BuildContext context) {
    final balanceController = TextEditingController();
    final noteController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      // SafeArea(top: false) — même correctif que _showOpenSheet ci-dessus.
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Fermer la caisse',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 12),
              TextField(
                controller: balanceController,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: const InputDecoration(
                    labelText: 'Montant compté (GNF)',
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(
                    labelText: 'Note (optionnel)',
                    border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  final value = num.tryParse(balanceController.text) ?? 0;
                  final note = noteController.text;
                  Navigator.of(sheetContext).pop();
                  _closeDrawer(value, note);
                },
                child: const Text('Confirmer'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
