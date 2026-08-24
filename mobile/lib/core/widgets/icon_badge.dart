import 'package:flutter/material.dart';

/// Pastille d'icône colorée — même langage visuel que les StatCard du
/// Tableau de bord (icône neutre sur fond teinté clair, cf.
/// DashboardPage.jsx#StatCard) et frontend/src/index.css pour le bleu de
/// marque. Réutilisée comme en-tête de section/carte dans tout le reste de
/// l'app pour donner une identité visuelle immédiate à chaque type de
/// réglage, plutôt qu'une succession de cartes uniformément grises.
class IconBadge extends StatelessWidget {
  const IconBadge({super.key, required this.icon, required this.color, this.size = 36});

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(size * 0.3)),
      child: Icon(icon, color: color, size: size * 0.52),
    );
  }
}

/// Palette partagée — identique à celle du Tableau de bord côté web
/// (bg-blue-50/text-blue-600, emerald, violet, amber, rose).
class AppColors {
  AppColors._();

  static const blue = Color(0xFF2563EB);
  static const emerald = Color(0xFF059669);
  static const violet = Color(0xFF7C3AED);
  static const amber = Color(0xFFD97706);
  static const rose = Color(0xFFE11D48);
  static const teal = Color(0xFF0D9488);
}
