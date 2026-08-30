import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/formatters.dart';
import '../../../account/data/stores_api.dart';
import '../../data/settings_models.dart';
import '../../data/subscription_payments_api.dart';
import 'subscription_payment_sheet.dart';

/// Miroir de SubscriptionPlansPage.jsx — page dédiée au choix d'un plan
/// (§ décidé en conversation, "page dédiée, design moderne comme les
/// applications les plus reconnues"), plutôt que l'ancienne première étape
/// imbriquée au fond de la feuille de paiement. Mêmes données exactement
/// (GET /subscription-payments/options + GET /stores/plan-status), aucune
/// nouvelle route backend.
class SubscriptionPlansPage extends StatefulWidget {
  const SubscriptionPlansPage({super.key});

  @override
  State<SubscriptionPlansPage> createState() => _SubscriptionPlansPageState();
}

class _SubscriptionPlansPageState extends State<SubscriptionPlansPage> {
  SubscriptionOptions? _options;
  PlanStatus? _currentPlan;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final optionsFuture = context.read<SubscriptionPaymentsApi>().getOptions();
      final planFuture = context.read<StoresApi>().getPlanStatus();
      final options = await optionsFuture;
      final plan = await planFuture;
      if (!mounted) return;
      setState(() {
        _options = options;
        _currentPlan = plan;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loading = false;
      });
    }
  }

  Future<void> _choosePlan(SubscriptionPlanOption plan) async {
    final submitted = await showSubscriptionPaymentSheet(context, initialPlan: plan);
    if (submitted == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final plans = _options?.plans ?? const <SubscriptionPlanOption>[];
    // Le plan le plus cher sert de mise en avant visuelle ("le plus
    // complet") — un repère commercial usuel, jamais une donnée renvoyée
    // par le serveur : recalculé ici à partir des prix, pour rester
    // correct même si le Super Admin change les plans/leur ordre. Même
    // logique exacte que PlanCard côté web.
    int? highestPriceId;
    num highestPrice = -1;
    for (final p in plans) {
      if (p.price > highestPrice) {
        highestPrice = p.price;
        highestPriceId = p.id;
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Choisir un plan')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                children: [
                  Center(
                    child: Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Theme.of(context).colorScheme.primary, Theme.of(context).colorScheme.primary.withValues(alpha: 0.8)],
                        ),
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6)),
                        ],
                      ),
                      child: const Icon(Icons.workspace_premium_outlined, color: Colors.white, size: 26),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Choisissez votre plan',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Des offres pensées pour accompagner la croissance de votre boutique — changez ou renouvelez à tout moment.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13.5, height: 1.4),
                  ),
                  if (_currentPlan != null) ...[
                    const SizedBox(height: 12),
                    Center(
                      child: Text.rich(
                        TextSpan(
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          children: [
                            const TextSpan(text: 'Plan actuel : '),
                            TextSpan(
                              text: _currentPlan!.planName,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _currentPlan!.isEffectivelyFreemium ? Colors.amber.shade800 : Theme.of(context).colorScheme.primary,
                              ),
                            ),
                            if (_currentPlan!.planExpiresAt != null)
                              TextSpan(
                                text: ' — ${_currentPlan!.isEffectivelyFreemium ? "expiré le" : "expire le"} ${formatDateTime(_currentPlan!.planExpiresAt)}',
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                      child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                    ),
                  for (final plan in plans) ...[
                    _PlanCard(
                      plan: plan,
                      renewalDays: _options!.renewalDays,
                      isCurrent: _currentPlan?.planName == plan.name,
                      isHighlighted: plan.id == highestPriceId && plan.price > 0,
                      onChoose: () => _choosePlan(plan),
                    ),
                    const SizedBox(height: 16),
                  ],
                ],
              ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.renewalDays,
    required this.isCurrent,
    required this.isHighlighted,
    required this.onChoose,
  });

  final SubscriptionPlanOption plan;
  final int renewalDays;
  final bool isCurrent;
  final bool isHighlighted;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final isFree = plan.price == 0;
    // Un simple Check/X par ligne (pas d'icône propre à chaque avantage) —
    // même choix exact que PlanCard côté web.
    final features = <(String, bool)>[
      ('${plan.maxUsersPerStore} utilisateur${plan.maxUsersPerStore > 1 ? 's' : ''} / boutique', true),
      ('${plan.maxProductsPerStore} produits actifs / boutique', true),
      ("Superviser d'autres boutiques", plan.allowsSupervision),
      ('Fournisseurs inter-boutiques', plan.allowsSuppliers),
      ("Commandes d'achat", plan.allowsPurchaseOrders),
      ('Visible sur le MARCHÉ', plan.allowsMarketplace),
      ('Transfert de stock entre boutiques', plan.allowsStockTransfer),
    ];

    final bgColor = isHighlighted ? const Color(0xFF0F172A) : Colors.white;
    final titleColor = isHighlighted ? Colors.amber.shade300 : Theme.of(context).colorScheme.primary;
    final priceColor = isHighlighted ? Colors.white : Colors.grey.shade900;
    final subColor = isHighlighted ? Colors.grey.shade400 : Colors.grey.shade500;
    final featureTextColor = isHighlighted ? Colors.grey.shade300 : Colors.grey.shade800;
    final featureMutedColor = isHighlighted ? Colors.grey.shade600 : Colors.grey.shade400;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(24),
            border: isHighlighted ? null : Border.all(color: Colors.grey.shade200),
            boxShadow: isHighlighted
                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 24, offset: const Offset(0, 10))]
                : [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isHighlighted) const SizedBox(height: 10),
              Text(
                plan.name,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: titleColor),
              ),
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    isFree ? 'Gratuit' : formatGNF(plan.price),
                    style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: priceColor, letterSpacing: -0.5),
                  ),
                  if (!isFree) ...[
                    const SizedBox(width: 4),
                    Text('/ $renewalDays j', style: TextStyle(fontSize: 13, color: subColor)),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              Text(
                isFree ? 'Pour démarrer sans engagement' : 'Facturation manuelle, renouvelable à tout moment',
                style: TextStyle(fontSize: 12.5, color: subColor),
              ),
              const SizedBox(height: 18),
              for (final (label, included) in features)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        included ? Icons.check_circle : Icons.cancel_outlined,
                        size: 16,
                        color: included ? (isHighlighted ? Colors.green.shade300 : Colors.green.shade600) : featureMutedColor,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          label,
                          style: TextStyle(fontSize: 13, color: included ? featureTextColor : featureMutedColor),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: isCurrent
                    ? Container(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: isHighlighted ? Colors.white.withValues(alpha: 0.1) : Colors.green.shade50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.verified_outlined, size: 17, color: isHighlighted ? Colors.white : Colors.green.shade700),
                            const SizedBox(width: 6),
                            Text(
                              'Votre plan actuel',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: isHighlighted ? Colors.white : Colors.green.shade700),
                            ),
                          ],
                        ),
                      )
                    : FilledButton(
                        onPressed: onChoose,
                        style: FilledButton.styleFrom(
                          backgroundColor: isHighlighted ? Colors.white : const Color(0xFF0F172A),
                          foregroundColor: isHighlighted ? const Color(0xFF0F172A) : Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(isFree ? 'Choisir ce plan' : 'Passer à ce plan', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                      ),
              ),
            ],
          ),
        ),
        if (isHighlighted)
          Positioned(
            top: -12,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [Colors.amber.shade300, Colors.amber.shade500]),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: Colors.amber.withValues(alpha: 0.35), blurRadius: 10, offset: const Offset(0, 4))],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.auto_awesome, size: 13, color: Color(0xFF0F172A)),
                    SizedBox(width: 5),
                    Text('Le plus complet', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
