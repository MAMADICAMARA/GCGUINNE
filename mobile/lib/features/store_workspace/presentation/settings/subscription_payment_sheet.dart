import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../../account/data/supervision_api.dart';
import '../../../account/data/supervision_models.dart';
import '../../data/settings_models.dart';
import '../../data/subscription_payments_api.dart';

enum _Step { plan, duration, method, form, contact }

const _kPaymentMethods = [
  {'code': 'ORANGE_MONEY', 'label': 'Orange Money'},
  {'code': 'MOBILE_MONEY', 'label': 'Mobile Money'},
  {'code': 'PAYCARD', 'label': 'PayCard'},
];

bool _hasDurationChoice(SubscriptionPlanOption? plan) =>
    plan != null && plan.durationTiers.isNotEmpty;

/// Miroir de SubscriptionPaymentModal.jsx — flux en 3 étapes (plan, moyen
/// de paiement, formulaire de déclaration) + un écran "Contacter l'admin"
/// qui n'est qu'un affichage de coordonnées, jamais une déclaration.
/// Retourne `true` si une demande a été soumise avec succès.
///
/// `initialPlan` (§ décidé en conversation, "page dédiée pour choisir un
/// plan") : ouverte depuis SubscriptionPlansPage, le plan est déjà choisi
/// — la feuille saute directement à l'étape du moyen de paiement plutôt
/// que de refaire choisir un plan déjà sélectionné. Ouverte sans plan
/// fourni, le flux reste inchangé (démarre à l'étape "plan").
///
/// `supervisedStoreId` (§ décidé en conversation, "le superviseur peut
/// payer l'abonnement d'une boutique supervisée") : quand fourni, la
/// feuille utilise SupervisionApi (scopée à cette boutique) au lieu de
/// SubscriptionPaymentsApi (boutique active du Owner) — même feuille,
/// juste une source de données différente.
///
/// `bulkStoreIds` (§52_lot_paiement_abonnement.sql, "Payer pour toutes",
/// décidé en conversation) : un seul plan/une seule durée choisis ici
/// s'appliquent à PLUSIEURS boutiques à la fois — mutuellement exclusif
/// avec `supervisedStoreId`. `priceMultiplier` (nombre de boutiques)
/// multiplie uniquement l'AFFICHAGE du montant total, jamais envoyé au
/// serveur (chaque boutique reste calculée indépendamment). `subjectLabel`
/// rappelle le périmètre ("4 boutiques sélectionnées : ..."). `onBulkSubmitted`
/// reçoit le détail par boutique ({batchId, results}) juste avant la
/// fermeture, pour que l'appelant puisse afficher un résumé.
Future<bool?> showSubscriptionPaymentSheet(
  BuildContext context, {
  SubscriptionPlanOption? initialPlan,
  int? supervisedStoreId,
  List<int>? bulkStoreIds,
  int priceMultiplier = 1,
  String? subjectLabel,
  ValueChanged<BulkPaymentSubmitResult>? onBulkSubmitted,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _SubscriptionPaymentSheet(
      initialPlan: initialPlan,
      supervisedStoreId: supervisedStoreId,
      bulkStoreIds: bulkStoreIds,
      priceMultiplier: priceMultiplier,
      subjectLabel: subjectLabel,
      onBulkSubmitted: onBulkSubmitted,
    ),
  );
}

class _SubscriptionPaymentSheet extends StatefulWidget {
  const _SubscriptionPaymentSheet({
    this.initialPlan,
    this.supervisedStoreId,
    this.bulkStoreIds,
    this.priceMultiplier = 1,
    this.subjectLabel,
    this.onBulkSubmitted,
  });

  final SubscriptionPlanOption? initialPlan;
  final int? supervisedStoreId;
  final List<int>? bulkStoreIds;
  final int priceMultiplier;
  final String? subjectLabel;
  final ValueChanged<BulkPaymentSubmitResult>? onBulkSubmitted;

  @override
  State<_SubscriptionPaymentSheet> createState() =>
      _SubscriptionPaymentSheetState();
}

class _SubscriptionPaymentSheetState extends State<_SubscriptionPaymentSheet> {
  late _Step _step = widget.initialPlan != null
      ? (_hasDurationChoice(widget.initialPlan) ? _Step.duration : _Step.method)
      : _Step.plan;
  SubscriptionOptions? _options;
  String? _loadError;

  late SubscriptionPlanOption? _selectedPlan = widget.initialPlan;
  int _selectedMonths = 1;
  String? _selectedMethod;
  final _referenceController = TextEditingController();
  final _phoneController = TextEditingController();
  String? _submitError;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _referenceController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final storeId = widget.supervisedStoreId;
      final SubscriptionOptions options;
      if (widget.bulkStoreIds != null) {
        options =
            await context.read<SupervisionApi>().getBulkSubscriptionOptions();
      } else if (storeId != null) {
        options = await context
            .read<SupervisionApi>()
            .getSubscriptionOptions(storeId);
      } else {
        options = await context.read<SubscriptionPaymentsApi>().getOptions();
      }
      if (!mounted) return;
      setState(() => _options = options);
    } on ApiException catch (err) {
      if (mounted) setState(() => _loadError = err.message);
    }
  }

  String? _instructionFor(String methodCode) {
    final settings = _options!.paymentSettings;
    switch (methodCode) {
      case 'ORANGE_MONEY':
        return settings.orangeMoneyNumber;
      case 'MOBILE_MONEY':
        return settings.mobileMoneyNumber;
      case 'PAYCARD':
        return settings.paycardInfo;
      default:
        return null;
    }
  }

  bool _requiresPhone(String methodCode) => methodCode != 'PAYCARD';

  // priceMultiplier ("Payer pour toutes") ne change QUE cet affichage —
  // jamais envoyé au serveur, qui recalcule toujours par boutique.
  num get _totalPriceForSelection {
    final options = durationOptionsFor(_selectedPlan!);
    final base = options
        .firstWhere((d) => d.months == _selectedMonths,
            orElse: () => options.first)
        .totalPrice;
    return base * widget.priceMultiplier;
  }

  Future<void> _submit() async {
    setState(() => _submitError = null);
    if (_referenceController.text.trim().isEmpty) {
      setState(() => _submitError = 'La référence de transaction est requise.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final storeId = widget.supervisedStoreId;
      final bulkStoreIds = widget.bulkStoreIds;
      final payerPhone = _phoneController.text.trim().isEmpty
          ? null
          : _phoneController.text.trim();
      if (bulkStoreIds != null) {
        final result = await context.read<SupervisionApi>().submitBulkPayment(
              bulkStoreIds,
              planId: _selectedPlan!.id,
              months: _selectedMonths,
              paymentMethod: _selectedMethod!,
              transactionReference: _referenceController.text.trim(),
              payerPhone: payerPhone,
            );
        widget.onBulkSubmitted?.call(result);
      } else if (storeId != null) {
        await context.read<SupervisionApi>().submitPayment(
              storeId,
              planId: _selectedPlan!.id,
              months: _selectedMonths,
              paymentMethod: _selectedMethod!,
              transactionReference: _referenceController.text.trim(),
              payerPhone: payerPhone,
            );
      } else {
        await context.read<SubscriptionPaymentsApi>().submit(
              planId: _selectedPlan!.id,
              months: _selectedMonths,
              paymentMethod: _selectedMethod!,
              transactionReference: _referenceController.text.trim(),
              payerPhone: payerPhone,
            );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (err) {
      setState(() => _submitError = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String get _title => switch (_step) {
        _Step.plan => 'Choisir un plan',
        _Step.duration => 'Choisir une durée',
        _Step.method => 'Moyen de paiement',
        _Step.form =>
          'Payer par ${_kPaymentMethods.firstWhere((m) => m['code'] == _selectedMethod)['label']}',
        _Step.contact => "Contacter l'administrateur",
      };

  // Indicateur d'étapes (§ décidé en conversation — un utilisateur peu à
  // l'aise avec le numérique doit toujours savoir où il en est). CONTACT
  // n'est qu'une bulle d'info greffée sur METHOD, elle ne compte pas comme
  // une étape à part.
  List<_Step> get _stepOrder => _hasDurationChoice(_selectedPlan)
      ? const [_Step.plan, _Step.duration, _Step.method, _Step.form]
      : const [_Step.plan, _Step.method, _Step.form];

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      // SafeArea(top: false) — § décidé en conversation, même correctif que
      // pos_page.dart#_showCartSheet : protège le bouton en bas de chaque
      // étape (Continuer/J'ai payé — soumettre) sur un téléphone à boutons
      // classiques.
      builder: (context, scrollController) => SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  if (_step != _Step.plan)
                    IconButton(
                      onPressed: _goBack,
                      icon: const Icon(Icons.arrow_back, size: 20),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  if (_step != _Step.plan) const SizedBox(width: 8),
                  Expanded(
                      child: Text(_title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16))),
                ],
              ),
            ),
            if (widget.subjectLabel != null)
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                color: Theme.of(context)
                    .colorScheme
                    .primary
                    .withValues(alpha: 0.06),
                child: Text(
                  widget.subjectLabel!,
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.primary),
                ),
              ),
            if (_options != null && _loadError == null)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Row(
                  children: [
                    for (final s in _stepOrder) ...[
                      if (s != _stepOrder.first) const SizedBox(width: 6),
                      Expanded(
                        child: Container(
                          height: 6,
                          decoration: BoxDecoration(
                            color: _stepOrder.indexOf(s) <=
                                    _stepOrder.indexOf(_step == _Step.contact
                                        ? _Step.method
                                        : _step)
                                ? Theme.of(context).colorScheme.primary
                                : Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            Expanded(
              child: _options == null
                  ? Center(
                      child: _loadError != null
                          ? Text(_loadError!,
                              style: const TextStyle(color: Colors.red))
                          : const CircularProgressIndicator())
                  : ListView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                      children: [
                        if (_step == _Step.plan) ..._buildPlanStep(),
                        if (_step == _Step.duration) ..._buildDurationStep(),
                        if (_step == _Step.method) ..._buildMethodStep(),
                        if (_step == _Step.form) ..._buildFormStep(),
                        if (_step == _Step.contact) ..._buildContactStep(),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _goBack() {
    // Plan déjà imposé par l'appelant (page dédiée) : pas d'étape "plan" à
    // laquelle revenir, on ferme plutôt la feuille — même comportement que
    // le "Changer de plan" côté web quand initialPlan est fourni.
    if (widget.initialPlan != null &&
        (_step == _Step.duration ||
            (_step == _Step.method && !_hasDurationChoice(_selectedPlan)))) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _step = switch (_step) {
        _Step.form => _Step.method,
        _Step.contact => _Step.method,
        _Step.method =>
          _hasDurationChoice(_selectedPlan) ? _Step.duration : _Step.plan,
        _Step.duration => _Step.plan,
        _Step.plan => _Step.plan,
      };
      _submitError = null;
    });
  }

  List<Widget> _buildPlanStep() {
    return [
      for (final plan in _options!.plans)
        InkWell(
          onTap: () => setState(() {
            _selectedPlan = plan;
            _selectedMonths = 1;
            _step = _hasDurationChoice(plan) ? _Step.duration : _Step.method;
          }),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                        child: Text(plan.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14))),
                    Text(
                        '${formatGNF(plan.price)} / ${_options!.renewalDays} j',
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.primary)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${plan.maxUsersPerStore} utilisateur(s) · Supervision ${plan.allowsSupervision ? "incluse" : "non incluse"} · Fournisseurs ${plan.allowsSuppliers ? "inclus" : "non inclus"}',
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                ),
                if (plan.allowsPurchaseOrders)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      "+ Commandes d'achat fournisseur (exclusif PREMIUM)",
                      style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.primary),
                    ),
                  ),
              ],
            ),
          ),
        ),
    ];
  }

  List<Widget> _buildDurationStep() {
    final options = durationOptionsFor(_selectedPlan!);
    final bestSavings = options.length > 1
        ? options.map((o) => o.savingsPercent).reduce((a, b) => a > b ? a : b)
        : 0;
    final primary = Theme.of(context).colorScheme.primary;
    return [
      Text.rich(
        TextSpan(
          style: const TextStyle(fontSize: 13, color: Colors.black87),
          children: [
            const TextSpan(text: 'Plan choisi : '),
            TextSpan(
                text: _selectedPlan!.name,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const TextSpan(
                text: ' — pour combien de temps voulez-vous payer ?'),
          ],
        ),
      ),
      const SizedBox(height: 14),
      for (final d in options)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: InkWell(
            onTap: () => setState(() => _selectedMonths = d.months),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: _selectedMonths == d.months
                        ? primary
                        : Colors.grey.shade300,
                    width: 2),
                color: _selectedMonths == d.months
                    ? primary.withValues(alpha: 0.06)
                    : null,
              ),
              child: Stack(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text('${d.months} mois',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 17)),
                          if (d.savingsPercent > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(999)),
                              child: Text('ÉCONOMISEZ ${d.savingsPercent}%',
                                  style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.green.shade700)),
                            ),
                          if (options.length > 1 &&
                              d.savingsPercent > 0 &&
                              d.savingsPercent == bestSavings)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                  color: Colors.amber.shade100,
                                  borderRadius: BorderRadius.circular(999)),
                              child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.auto_awesome,
                                        size: 11, color: Colors.amber.shade800),
                                    const SizedBox(width: 3),
                                    Text('Meilleure offre',
                                        style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.amber.shade900)),
                                  ]),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text.rich(
                        TextSpan(
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: Colors.black87),
                          children: [
                            TextSpan(
                                text: formatGNF(
                                    d.totalPrice * widget.priceMultiplier)),
                            if (widget.priceMultiplier > 1)
                              TextSpan(
                                text:
                                    ' (${formatGNF(d.totalPrice)} × ${widget.priceMultiplier})',
                                style: TextStyle(
                                    fontWeight: FontWeight.w400,
                                    fontSize: 11.5,
                                    color: Colors.grey.shade500),
                              ),
                          ],
                        ),
                      ),
                      Text(
                        '≈ ${formatGNF(d.pricePerMonth)} / mois${widget.priceMultiplier > 1 ? ' / boutique' : ''}',
                        style: TextStyle(
                            fontSize: 11.5, color: Colors.grey.shade500),
                      ),
                    ],
                  ),
                  if (_selectedMonths == d.months)
                    Positioned(
                      top: 0,
                      right: 0,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                            color: primary, shape: BoxShape.circle),
                        child: const Icon(Icons.check,
                            size: 12, color: Colors.white),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      const SizedBox(height: 4),
      FilledButton(
        onPressed: () => setState(() => _step = _Step.method),
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        child: const Text('Continuer'),
      ),
    ];
  }

  List<Widget> _buildMethodStep() {
    return [
      Text.rich(
        TextSpan(
          style: const TextStyle(fontSize: 13, color: Colors.black87),
          children: [
            const TextSpan(text: 'Plan choisi : '),
            TextSpan(
                text: _selectedPlan!.name,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            if (_hasDurationChoice(_selectedPlan))
              TextSpan(text: ' — $_selectedMonths mois'),
            TextSpan(
                text: ' — ${formatGNF(_totalPriceForSelection)}',
                style: const TextStyle(fontWeight: FontWeight.w700)),
            if (widget.priceMultiplier > 1)
              TextSpan(text: ' (${widget.priceMultiplier} boutiques)'),
          ],
        ),
      ),
      const SizedBox(height: 14),
      GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 2.4,
        children: [
          for (final method in _kPaymentMethods)
            OutlinedButton(
              onPressed: () => setState(() {
                _selectedMethod = method['code'];
                _step = _Step.form;
              }),
              child: Text(method['label']!,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      const SizedBox(height: 10),
      OutlinedButton(
        onPressed: () => setState(() => _step = _Step.contact),
        child: const Text("Contacter l'admin",
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ),
    ];
  }

  List<Widget> _buildFormStep() {
    final instruction = _instructionFor(_selectedMethod!);
    final primary = Theme.of(context).colorScheme.primary;
    return [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: primary.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: primary.withValues(alpha: 0.15)),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                  color: Colors.white, shape: BoxShape.circle),
              child: Icon(Icons.trending_up, size: 18, color: primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MONTANT À PAYER${_hasDurationChoice(_selectedPlan) ? " — $_selectedMonths MOIS" : ""}'
                    '${widget.priceMultiplier > 1 ? " — ${widget.priceMultiplier} BOUTIQUES" : ""}',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: primary,
                        letterSpacing: 0.3),
                  ),
                  Text(formatGNF(_totalPriceForSelection),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 18)),
                ],
              ),
            ),
          ],
        ),
      ),
      Container(
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (instruction != null && instruction.isNotEmpty) ...[
              Text(
                _selectedMethod == 'PAYCARD'
                    ? 'INFORMATIONS DE PAIEMENT'
                    : 'NUMÉRO À CRÉDITER',
                style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey.shade500,
                    letterSpacing: 0.3),
              ),
              const SizedBox(height: 2),
              Text(instruction,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 13.5)),
            ] else
              Text(
                "Ce moyen de paiement n'est pas encore configuré par l'administrateur — utilisez \"Contacter l'admin\" à la place, ou réessayez plus tard.",
                style: TextStyle(color: Colors.amber.shade800, fontSize: 12.5),
              ),
          ],
        ),
      ),
      if (_submitError != null)
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(10)),
          child: Text(_submitError!,
              style: const TextStyle(color: Colors.red, fontSize: 13)),
        ),
      if (_requiresPhone(_selectedMethod!)) ...[
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
              labelText: 'Numéro utilisé pour payer',
              hintText: 'Ex : 620 00 00 00',
              border: OutlineInputBorder()),
        ),
        const SizedBox(height: 12),
      ],
      TextField(
        controller: _referenceController,
        decoration: const InputDecoration(
            labelText: 'Référence de la transaction',
            hintText: 'Ex : code reçu par SMS après paiement',
            border: OutlineInputBorder()),
      ),
      const SizedBox(height: 16),
      FilledButton(
        onPressed: _submitting ? null : _submit,
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        child: Text(_submitting ? 'Envoi...' : "J'ai payé — soumettre"),
      ),
    ];
  }

  List<Widget> _buildContactStep() {
    final settings = _options!.paymentSettings;
    final hasContact = (settings.contactPhone?.isNotEmpty ?? false) ||
        (settings.contactWhatsapp?.isNotEmpty ?? false) ||
        (settings.contactEmail?.isNotEmpty ?? false);

    if (!hasContact) {
      return [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(10)),
          child: Text(
              "Aucune coordonnée de contact n'est configurée pour le moment.",
              style: TextStyle(color: Colors.amber.shade800, fontSize: 13)),
        ),
      ];
    }

    return [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (settings.contactPhone?.isNotEmpty ?? false)
              _ContactRow(
                  label: 'Téléphone',
                  value: settings.contactPhone!,
                  onTap: () =>
                      launchUrl(Uri.parse('tel:${settings.contactPhone}'))),
            if (settings.contactWhatsapp?.isNotEmpty ?? false)
              _ContactRow(
                label: 'WhatsApp',
                value: settings.contactWhatsapp!,
                onTap: () => launchUrl(Uri.parse(
                    'https://wa.me/${settings.contactWhatsapp!.replaceAll(RegExp(r'\D'), '')}')),
              ),
            if (settings.contactEmail?.isNotEmpty ?? false)
              _ContactRow(
                  label: 'E-mail',
                  value: settings.contactEmail!,
                  onTap: () =>
                      launchUrl(Uri.parse('mailto:${settings.contactEmail}'))),
          ],
        ),
      ),
    ];
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow(
      {required this.label, required this.value, required this.onTap});

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        child: Text.rich(
          TextSpan(
            style: const TextStyle(fontSize: 13),
            children: [
              TextSpan(text: '$label : '),
              TextSpan(
                  text: value,
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
