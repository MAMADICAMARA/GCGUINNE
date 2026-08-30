/// Charge utile de `context.go('/login', extra: ...)` — un seul type
/// pour tous les appelants (au lieu d'un `String?` brut réservé à
/// prefillEmail) depuis l'ajout de `redirectProductId` (§ MARCHÉ, bouton
/// "Contacter le propriétaire" pour un visiteur non connecté, décidé en
/// conversation) : après connexion, LoginPage doit pouvoir retomber sur
/// LE MÊME produit plutôt que sur /account par défaut.
class LoginRouteExtra {
  const LoginRouteExtra({this.prefillEmail, this.redirectProductId});

  final String? prefillEmail;
  final int? redirectProductId;
}
