import 'package:flutter/material.dart';

import '../utils/formatters.dart';

const _sevenDays = Duration(days: 7);

/// Pastille de statut d'abonnement (§ décidé en conversation, "payer
/// l'abonnement depuis Superviser") — miroir de PlanStatusBadge.jsx,
/// réutilisée par supervise_page.dart et supervised_store_detail_page.dart.
/// `supervisionAllowed` prime sur tout le reste : c'est la donnée qui
/// bloque réellement l'accès, jamais recalculée ici à partir de la seule
/// date.
class PlanStatusBadge extends StatelessWidget {
  const PlanStatusBadge(
      {super.key,
      required this.supervisionAllowed,
      required this.planExpiresAt});

  final bool? supervisionAllowed;
  final String? planExpiresAt;

  @override
  Widget build(BuildContext context) {
    if (supervisionAllowed == false) {
      return _pill('Accès bloqué — abonnement expiré', Colors.red.shade50,
          Colors.red.shade700);
    }

    if (planExpiresAt == null || planExpiresAt!.isEmpty) {
      return _pill('Gratuit', Colors.grey.shade100, Colors.grey.shade600);
    }

    final expiresAt = DateTime.tryParse(planExpiresAt!);
    if (expiresAt == null) {
      return _pill('Gratuit', Colors.grey.shade100, Colors.grey.shade600);
    }

    final expiresSoon = expiresAt.difference(DateTime.now()) < _sevenDays;
    if (expiresSoon) {
      return _pill('Expire bientôt — ${formatDate(expiresAt)}',
          Colors.amber.shade50, Colors.amber.shade700);
    }

    return _pill('Actif jusqu\'au ${formatDate(expiresAt)}',
        Colors.green.shade50, Colors.green.shade700);
  }

  Widget _pill(String label, Color background, Color foreground) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
          color: background, borderRadius: BorderRadius.circular(999)),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: foreground)),
    );
  }
}
