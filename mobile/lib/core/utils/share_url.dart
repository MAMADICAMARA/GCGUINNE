import '../config/app_config.dart';

/// Miroir de frontend/src/utils/shareUrl.js — dérive l'origine du backend
/// depuis apiBaseUrl (qui se termine par /api/v1) pour construire le lien
/// de partage d'un produit MARCHÉ. C'est CE lien qu'il faut partager,
/// jamais une URL interne à l'app : seul le backend sait générer les
/// balises Open Graph pour les robots des réseaux sociaux (voir
/// backend/src/modules/marketplace/marketplaceShare.routes.js).
String getProductShareUrl(int productId) {
  final origin = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/api/v1/?$'), '');
  return '$origin/marche/produits/$productId';
}
