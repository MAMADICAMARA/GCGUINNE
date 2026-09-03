import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../state/update_state.dart';

/// Bandeau de mise à jour RECOMMANDÉE (§5, décidé en conversation) — même
/// principe visuel que _PlanStatusBanner (store_shell.dart) : visible et
/// persistant, mais l'app reste TOTALEMENT utilisable, l'utilisateur peut
/// ignorer et continuer à travailler. Réutilisé tel quel dans les deux
/// coquilles de navigation (AccountShell et StoreShell) plutôt que
/// dupliqué — un utilisateur sans boutique active ne doit pas non plus en
/// être privé.
class UpdateBanner extends StatelessWidget {
  const UpdateBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final updateState = context.watch<UpdateState>();
    if (!updateState.isRecommended) return const SizedBox.shrink();

    final version = updateState.latestVersion!;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.system_update_alt, size: 16, color: Colors.blue.shade700),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Une nouvelle version (${version.versionName}) est disponible.',
              style: TextStyle(fontSize: 12, color: Colors.blue.shade900),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            height: 30,
            child: FilledButton(
              onPressed: () => launchUrl(
                Uri.parse('${AppConfig.frontendUrl}/telecharger'),
                mode: LaunchMode.externalApplication,
              ),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.blue.shade600,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              child: const Text('Mettre à jour'),
            ),
          ),
        ],
      ),
    );
  }
}
