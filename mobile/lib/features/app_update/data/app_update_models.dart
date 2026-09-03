/// Miroir de la réponse GET /app/version — voir
/// appVersions.service.js#getLatestVersion pour le contrat exact.
library;

class AppVersionLink {
  const AppVersionLink({required this.label, required this.url, required this.isDirectUpload});

  factory AppVersionLink.fromJson(Map<String, dynamic> json) => AppVersionLink(
        label: json['label'] as String,
        url: json['url'] as String,
        isDirectUpload: json['isDirectUpload'] as bool? ?? false,
      );

  final String label;
  final String url;
  final bool isDirectUpload;
}

/// `updateLevel` reste une chaîne brute ('OPTIONAL' | 'RECOMMENDED' |
/// 'MANDATORY') plutôt qu'un enum Dart — évite tout risque de plantage si
/// le serveur introduit un jour une valeur non prévue par un ancien build
/// déjà installé (§ décidé en conversation, cohérent avec l'esprit "jamais
/// bloquer à cause d'un problème indépendant de la mise à jour elle-même").
class AppVersionInfo {
  const AppVersionInfo({
    required this.versionCode,
    required this.versionName,
    this.releaseNotes,
    required this.updateLevel,
    required this.links,
  });

  /// `{}` (objet vide, jamais un `null` racine — cf.
  /// appVersions.public.routes.js) signifie "aucune version publiée" :
  /// détecté ici par l'absence de `versionCode`.
  static AppVersionInfo? fromJsonOrNull(Map<String, dynamic> json) {
    if (json['versionCode'] == null) return null;
    return AppVersionInfo(
      versionCode: json['versionCode'] as int,
      versionName: json['versionName'] as String,
      releaseNotes: json['releaseNotes'] as String?,
      updateLevel: json['updateLevel'] as String? ?? 'OPTIONAL',
      links: (json['links'] as List<dynamic>? ?? [])
          .map((e) => AppVersionLink.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  final int versionCode;
  final String versionName;
  final String? releaseNotes;
  final String updateLevel;
  final List<AppVersionLink> links;
}
