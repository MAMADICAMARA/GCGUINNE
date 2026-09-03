import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../state/update_state.dart';

/// Écran plein bloquant (§5, niveau MANDATORY, décidé en conversation) —
/// rien d'autre n'est accessible tant que la mise à jour n'est pas faite :
/// pas de bouton retour utile, aucune route de l'app ne doit rester
/// atteignable pendant que cet écran est affiché (voir app_router.dart,
/// qui redirige systématiquement ici tant que
/// `updateState.isMandatory` est vrai). Le bouton ouvre le NAVIGATEUR
/// EXTERNE (§8.4) — l'app ne télécharge jamais le fichier elle-même.
class UpdateRequiredPage extends StatelessWidget {
  const UpdateRequiredPage({super.key});

  @override
  Widget build(BuildContext context) {
    final updateState = context.watch<UpdateState>();
    final version = updateState.latestVersion;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF082C48),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.system_update_alt, color: Colors.white, size: 36),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Mise à jour obligatoire',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    version != null
                        ? "Une nouvelle version (${version.versionName}) doit être installée avant de continuer à utiliser l'application."
                        : "Une mise à jour importante doit être installée avant de continuer à utiliser l'application.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.5),
                  ),
                  if (version?.releaseNotes != null) ...[
                    const SizedBox(height: 18),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'QUOI DE NEUF',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 0.3),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            version!.releaseNotes!,
                            style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => launchUrl(
                        Uri.parse('${AppConfig.frontendUrl}/telecharger'),
                        mode: LaunchMode.externalApplication,
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF082C48),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: const Icon(Icons.download_outlined),
                      label: const Text('Télécharger la mise à jour', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
