import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../data/settings_models.dart';
import '../../data/subscription_payments_api.dart';

enum _Step { plan, method, form, contact }

const _kPaymentMethods = [
  {'code': 'ORANGE_MONEY', 'label': 'Orange Money'},
  {'code': 'MOBILE_MONEY', 'label': 'Mobile Money'},
  {'code': 'PAYCARD', 'label': 'PayCard'},
];

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
Future<bool?> showSubscriptionPaymentSheet(BuildContext context, {SubscriptionPlanOption? initialPlan}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _SubscriptionPaymentSheet(initialPlan: initialPlan),
  );
}

class _SubscriptionPaymentSheet extends StatefulWidget {
  const _SubscriptionPaymentSheet({this.initialPlan});

  final SubscriptionPlanOption? initialPlan;

  @override
  State<_SubscriptionPaymentSheet> createState() => _SubscriptionPaymentSheetState();
}

class _SubscriptionPaymentSheetState extends State<_SubscriptionPaymentSheet> {
  late _Step _step = widget.initialPlan != null ? _Step.method : _Step.plan;
  SubscriptionOptions? _options;
  String? _loadError;

  late SubscriptionPlanOption? _selectedPlan = widget.initialPlan;
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
      final options = await context.read<SubscriptionPaymentsApi>().getOptions();
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

  Future<void> _submit() async {
    setState(() => _submitError = null);
    if (_referenceController.text.trim().isEmpty) {
      setState(() => _submitError = 'La référence de transaction est requise.');
      return;
    }
    setState(() => _submitting = true);
    try {
      await context.read<SubscriptionPaymentsApi>().submit(
            planId: _selectedPlan!.id,
            paymentMethod: _selectedMethod!,
            transactionReference: _referenceController.text.trim(),
            payerPhone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
          );
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
        _Step.method => 'Moyen de paiement',
        _Step.form => 'Payer par ${_kPaymentMethods.firstWhere((m) => m['code'] == _selectedMethod)['label']}',
        _Step.contact => "Contacter l'administrateur",
      };

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Row(
              children: [
                if (_step != _Step.plan)
                  IconButton(
                    onPressed: () {
                      // Plan déjà imposé par l'appelant (page dédiée) : pas
                      // d'étape "plan" à laquelle revenir, on ferme plutôt
                      // la feuille — même comportement que le "Changer de
                      // plan" côté web quand initialPlan est fourni.
                      if (widget.initialPlan != null && _step == _Step.method) {
                        Navigator.of(context).pop();
                        return;
                      }
                      setState(() {
                        _step = _step == _Step.form ? _Step.method : (_step == _Step.contact ? _Step.method : _Step.plan);
                        _submitError = null;
                      });
                    },
                    icon: const Icon(Icons.arrow_back, size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                if (_step != _Step.plan) const SizedBox(width: 8),
                Expanded(child: Text(_title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
              ],
            ),
          ),
          Expanded(
            child: _options == null
                ? Center(child: _loadError != null ? Text(_loadError!, style: const TextStyle(color: Colors.red)) : const CircularProgressIndicator())
                : ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    children: [
                      if (_step == _Step.plan) ..._buildPlanStep(),
                      if (_step == _Step.method) ..._buildMethodStep(),
                      if (_step == _Step.form) ..._buildFormStep(),
                      if (_step == _Step.contact) ..._buildContactStep(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPlanStep() {
    return [
      for (final plan in _options!.plans)
        InkWell(
          onTap: () => setState(() {
            _selectedPlan = plan;
            _step = _Step.method;
          }),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade300)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
                    Text('${formatGNF(plan.price)} / ${_options!.renewalDays} j', style: TextStyle(fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.primary)),
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
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.primary),
                    ),
                  ),
              ],
            ),
          ),
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
            TextSpan(text: _selectedPlan!.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: ' — ${formatGNF(_selectedPlan!.price)}'),
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
              child: Text(method['label']!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      const SizedBox(height: 10),
      OutlinedButton(
        onPressed: () => setState(() => _step = _Step.contact),
        child: const Text("Contacter l'admin", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
      ),
    ];
  }

  List<Widget> _buildFormStep() {
    final instruction = _instructionFor(_selectedMethod!);
    return [
      Container(
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (instruction != null && instruction.isNotEmpty) ...[
              Text(
                _selectedMethod == 'PAYCARD' ? 'INFORMATIONS DE PAIEMENT' : 'NUMÉRO À CRÉDITER',
                style: TextStyle(fontSize: 10, color: Colors.grey.shade500, letterSpacing: 0.3),
              ),
              const SizedBox(height: 2),
              Text(instruction, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
            ] else
              Text(
                "Ce moyen de paiement n'est pas encore configuré par l'administrateur — utilisez \"Contacter l'admin\" à la place, ou réessayez plus tard.",
                style: TextStyle(color: Colors.amber.shade800, fontSize: 12.5),
              ),
            const SizedBox(height: 8),
            Text.rich(
              TextSpan(
                style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                children: [
                  const TextSpan(text: 'Montant à payer : '),
                  TextSpan(text: formatGNF(_selectedPlan!.price), style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.black87)),
                ],
              ),
            ),
          ],
        ),
      ),
      if (_submitError != null)
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
          child: Text(_submitError!, style: const TextStyle(color: Colors.red, fontSize: 13)),
        ),
      if (_requiresPhone(_selectedMethod!)) ...[
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Numéro utilisé pour payer', hintText: 'Ex : 620 00 00 00', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 12),
      ],
      TextField(
        controller: _referenceController,
        decoration: const InputDecoration(labelText: 'Référence de la transaction', hintText: 'Ex : code reçu par SMS après paiement', border: OutlineInputBorder()),
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
          decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10)),
          child: Text("Aucune coordonnée de contact n'est configurée pour le moment.", style: TextStyle(color: Colors.amber.shade800, fontSize: 13)),
        ),
      ];
    }

    return [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (settings.contactPhone?.isNotEmpty ?? false)
              _ContactRow(label: 'Téléphone', value: settings.contactPhone!, onTap: () => launchUrl(Uri.parse('tel:${settings.contactPhone}'))),
            if (settings.contactWhatsapp?.isNotEmpty ?? false)
              _ContactRow(
                label: 'WhatsApp',
                value: settings.contactWhatsapp!,
                onTap: () => launchUrl(Uri.parse('https://wa.me/${settings.contactWhatsapp!.replaceAll(RegExp(r'\D'), '')}')),
              ),
            if (settings.contactEmail?.isNotEmpty ?? false)
              _ContactRow(label: 'E-mail', value: settings.contactEmail!, onTap: () => launchUrl(Uri.parse('mailto:${settings.contactEmail}'))),
          ],
        ),
      ),
    ];
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.label, required this.value, required this.onTap});

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
              TextSpan(text: value, style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
