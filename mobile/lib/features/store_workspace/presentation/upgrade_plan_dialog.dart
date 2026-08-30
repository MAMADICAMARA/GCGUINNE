import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../state/auth_state.dart';
import 'settings/subscription_plans_page.dart';

/// Miroir de UpgradePlanModal.jsx (web) — affiché quand un marchand touche
/// un produit verrouillé par le plafond de son plan (§ décidé en
/// conversation, "plan gratuit limité à 50 produits"). Réutilisé par
/// ProductsPage et PosPage — un seul widget, jamais deux messages
/// différents pour la même règle.
///
/// Le bouton ouvre la page dédiée des plans (§ décidé en conversation,
/// "partout où le message plan gratuit/limité apparaît, un bouton vers
/// l'abonnement"). Ce dialogue peut s'afficher pour un Vendeur autorisé
/// (POS/Produits) — seul le Owner gère la facturation, donc le Vendeur voit
/// un message sans bouton plutôt qu'un lien qui échouerait (page réservée
/// au Owner côté serveur).
Future<void> showUpgradePlanDialog(
  BuildContext context, {
  required String? planName,
  required int? maxProductsPerStore,
  String? productName,
}) {
  return showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (dialogContext) => _UpgradePlanDialog(
      planName: planName,
      maxProductsPerStore: maxProductsPerStore,
      productName: productName,
    ),
  );
}

class _UpgradePlanDialog extends StatelessWidget {
  const _UpgradePlanDialog({required this.planName, required this.maxProductsPerStore, this.productName});

  final String? planName;
  final int? maxProductsPerStore;
  final String? productName;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final isOwner = context.read<AuthState>().activeStore?.roleCode == 'OWNER';

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.white,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 36),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      top: -8,
                      right: -8,
                      child: IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                      ),
                    ),
                    Column(
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), shape: BoxShape.circle),
                          child: const Icon(Icons.lock_outline, color: Color(0xFFFBBF24), size: 26),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          productName != null ? '"$productName" est verrouillé' : 'Produit verrouillé',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Votre plan ${planName ?? ''} est limité à ${maxProductsPerStore ?? '—'} produit(s) actif(s) par boutique.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12, height: 1.4),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                child: Column(
                  children: [
                    Text(
                      isOwner
                          ? 'Passez à un plan supérieur pour débloquer ce produit — et tous les autres au-delà de votre limite actuelle.'
                          : 'Demandez au propriétaire de la boutique de passer à un plan supérieur pour débloquer ce produit.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
                    ),
                    if (isOwner) ...[
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () {
                            Navigator.of(context).pop();
                            Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SubscriptionPlansPage()));
                          },
                          style: FilledButton.styleFrom(
                            backgroundColor: primary,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.auto_awesome, size: 17),
                          label: const Text('Voir les plans disponibles', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Plus tard', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
