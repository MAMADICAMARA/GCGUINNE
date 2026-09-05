import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/plan_status_badge.dart';
import '../../store_workspace/presentation/settings/subscription_payment_sheet.dart';
import '../data/supervision_api.dart';
import '../data/supervision_models.dart';

/// Miroir de SupervisePage.jsx — boutiques de tiers supervisées via un
/// code de partage, en lecture seule stricte. Les boutiques possédées par
/// l'utilisateur n'apparaissent volontairement pas ici (déjà visibles via
/// "Ma Boutique"/le tableau de bord).
class SupervisePage extends StatefulWidget {
  const SupervisePage({super.key});

  @override
  State<SupervisePage> createState() => _SupervisePageState();
}

class _SupervisePageState extends State<SupervisePage> {
  List<SupervisableStore>? _stores;
  String? _error;
  String? _success;

  bool _showAddForm = false;
  final _codeController = TextEditingController();
  bool _submitting = false;

  int? _removingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _stores = null;
      _error = null;
    });
    try {
      final stores = await context.read<SupervisionApi>().listStores();
      if (!mounted) return;
      setState(() => _stores = stores);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  Future<void> _addCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      final storeName = await context.read<SupervisionApi>().addStore(code);
      if (!mounted) return;
      setState(() {
        _success = '"$storeName" a été ajoutée à votre supervision.';
        _showAddForm = false;
        _codeController.clear();
      });
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _success = null);
      });
      _load();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _remove(SupervisableStore store) async {
    final supervisionApi = context.read<SupervisionApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Retirer cette boutique ?'),
        content: Text('Retirer "${store.name}" de votre supervision ?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Annuler')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Retirer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _removingId = store.id);
    try {
      await supervisionApi.removeStore(store.id);
      _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _removingId = null);
    }
  }

  /// Paiement d'une boutique précise (§ décidé en conversation, "le
  /// superviseur peut payer") — même feuille que le Owner sur sa propre
  /// boutique, scopée à `store.id` via SupervisionApi.
  Future<void> _payStore(SupervisableStore store) async {
    final submitted = await showSubscriptionPaymentSheet(context,
        supervisedStoreId: store.id);
    if (submitted == true) {
      setState(() => _success =
          'Demande de paiement envoyée pour "${store.name}" — en attente de vérification.');
      Future.delayed(const Duration(seconds: 6), () {
        if (mounted) setState(() => _success = null);
      });
      _load();
    }
  }

  /// "Payer pour toutes" (§52_lot_paiement_abonnement.sql, décidé en
  /// conversation) — un seul plan + une seule durée choisis une fois,
  /// appliqués à TOUTES les boutiques supervisées d'un coup (un seul
  /// virement réel du superviseur). Le montant affiché est multiplié par
  /// le nombre de boutiques — purement visuel, chaque boutique garde sa
  /// propre demande avec son propre montant individuel côté serveur.
  Future<void> _payAll(List<SupervisableStore> stores) async {
    BulkPaymentSubmitResult? result;
    final submitted = await showSubscriptionPaymentSheet(
      context,
      bulkStoreIds: stores.map((s) => s.id).toList(),
      priceMultiplier: stores.length,
      subjectLabel:
          '${stores.length} boutique${stores.length > 1 ? 's' : ''} sélectionnée${stores.length > 1 ? 's' : ''} : ${stores.map((s) => s.name).join(', ')}',
      onBulkSubmitted: (r) => result = r,
    );
    if (submitted == true && result != null) {
      final successCount = result!.results.where((r) => r.success).length;
      final failCount = result!.results.length - successCount;
      setState(() {
        _success = failCount == 0
            ? 'Demande de paiement envoyée pour $successCount boutique(s) — en attente de vérification.'
            : '$successCount boutique(s) envoyée(s), $failCount déjà en attente d\'une autre demande.';
      });
      Future.delayed(const Duration(seconds: 8), () {
        if (mounted) setState(() => _success = null);
      });
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = _stores;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Row(
          children: [
            Icon(Icons.visibility_outlined,
                color: Theme.of(context).colorScheme.primary, size: 22),
            const SizedBox(width: 10),
            const Expanded(
                child: Text('Superviser',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 18))),
            OutlinedButton.icon(
              onPressed: () => setState(() => _showAddForm = true),
              icon: const Icon(Icons.add, size: 16),
              label: const Text('Ajouter', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
            ),
          ],
        ),
        if (stores != null && stores.isNotEmpty) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _payAll(stores),
              icon: const Icon(Icons.credit_card, size: 16),
              label: Text('Payer pour toutes (${stores.length})'),
              style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12)),
            ),
          ),
        ],
        const SizedBox(height: 6),
        Text(
          "Boutiques d'autres personnes que vous supervisez en lecture seule.",
          style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 16),
        if (_success != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(10)),
            child: Text(_success!,
                style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
          ),
        if (_error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(10)),
            child: Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 13)),
          ),
        if (_showAddForm)
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Code de supervision',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 4),
                Text(
                  'Demandez ce code à la personne qui gère la boutique — il se trouve dans ses Paramètres.',
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _codeController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    hintText: 'Ex : SYS3PJ556RT8',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    FilledButton(
                      onPressed: _submitting ? null : _addCode,
                      child: Text(_submitting ? 'Vérification...' : 'Ajouter'),
                    ),
                    const SizedBox(width: 12),
                    TextButton(
                      onPressed: () => setState(() => _showAddForm = false),
                      child: const Text('Annuler'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        if (stores == null)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Center(child: CircularProgressIndicator()))
        else if (stores.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 40),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                  color: Colors.grey.shade300, style: BorderStyle.solid),
            ),
            child: Center(
              child: Text('Aucune boutique supervisée pour l\'instant.',
                  style: TextStyle(color: Colors.grey.shade400)),
            ),
          )
        else
          for (final store in stores)
            _SupervisedStoreCard(
              store: store,
              removing: _removingId == store.id,
              onViewDetail: store.supervisionAllowed
                  ? () => context.push('/account/supervise/${store.id}')
                  : null,
              onPay: () => _payStore(store),
              onRemove: () => _remove(store),
            ),
      ],
    );
  }
}

class _SupervisedStoreCard extends StatelessWidget {
  const _SupervisedStoreCard({
    required this.store,
    required this.removing,
    required this.onViewDetail,
    required this.onPay,
    required this.onRemove,
  });

  final SupervisableStore store;
  final bool removing;
  final VoidCallback? onViewDetail;
  final VoidCallback onPay;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(store.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14.5)),
              ),
              const SizedBox(width: 8),
              PlanStatusBadge(
                  supervisionAllowed: store.supervisionAllowed,
                  planExpiresAt: store.planExpiresAt),
            ],
          ),
          const SizedBox(height: 10),
          if (store.supervisionAllowed)
            Row(
              children: [
                Expanded(
                    child: _MiniStat(
                        label: 'CA du jour',
                        value: formatGNF(store.todayRevenue))),
                Expanded(
                  child: _MiniStat(
                    label: 'Bénéfice',
                    value: formatGNF(store.todayProfit),
                    color: Colors.green.shade700,
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: 'Ruptures',
                    value: '${store.lowStockCount ?? 0}',
                    color: (store.lowStockCount ?? 0) > 0
                        ? Colors.red.shade600
                        : null,
                  ),
                ),
              ],
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8)),
              child: Text(
                "L'abonnement actuel de cette boutique n'autorise plus la supervision — vous restez lié(e), mais ses données ne sont plus accessibles pour l'instant.",
                style: TextStyle(fontSize: 11.5, color: Colors.amber.shade900),
              ),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              TextButton(
                onPressed: onViewDetail,
                style: TextButton.styleFrom(
                    padding: EdgeInsets.zero, minimumSize: const Size(0, 32)),
                child: const Text('Voir le détail',
                    style: TextStyle(fontSize: 12.5)),
              ),
              const SizedBox(width: 16),
              TextButton(
                onPressed: onPay,
                style: TextButton.styleFrom(
                    padding: EdgeInsets.zero, minimumSize: const Size(0, 32)),
                child: const Text('Payer l\'abonnement',
                    style: TextStyle(fontSize: 12.5)),
              ),
              const Spacer(),
              TextButton(
                onPressed: removing ? null : onRemove,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 32),
                  foregroundColor: Colors.grey.shade500,
                ),
                child: Text(removing ? 'Retrait...' : 'Retirer',
                    style: const TextStyle(fontSize: 12.5)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label.toUpperCase(),
            style: TextStyle(fontSize: 9.5, color: Colors.grey.shade400)),
        const SizedBox(height: 2),
        Text(value,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color ?? Colors.grey.shade800)),
      ],
    );
  }
}
