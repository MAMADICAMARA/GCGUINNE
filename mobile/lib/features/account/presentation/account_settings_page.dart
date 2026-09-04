import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../state/auth_state.dart';
import '../../../state/update_state.dart';
import '../../app_update/data/app_update_api.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage({super.key});

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  @override
  void initState() {
    super.initState();
    // §8 du cahier des charges "Système de notification de mise à jour" :
    // vérifier aussi à chaque ouverture des Paramètres, pas seulement au
    // lancement de l'app (main.dart) — échec silencieux, jamais bloquant.
    unawaited(context.read<UpdateState>().check(context.read<AppUpdateApi>()));
  }

  @override
  Widget build(BuildContext context) {
    final updateState = context.watch<UpdateState>();

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Paramètres', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('Réglages du compte.',
              style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 20),
          // §5/§8 du cahier des charges "Système de notification de mise à
          // jour" (décidé en conversation) — le niveau OPTIONAL n'affiche
          // qu'un badge discret sur l'icône Paramètres (voir
          // account_shell.dart), jamais de bandeau intrusif. Il fallait
          // donc UN endroit où agir une fois arrivé ici, sinon le badge ne
          // menait nulle part — c'est ce bloc-ci. RECOMMENDED/MANDATORY ont
          // déjà leur propre affichage bien plus visible ailleurs, mais ce
          // bloc reste inoffensif à afficher aussi dans ce cas (même
          // action, juste redondante).
          if (updateState.hasUpdate) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.system_update_alt,
                          size: 18, color: Colors.blue.shade700),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Une nouvelle version (${updateState.latestVersion?.versionName ?? ''}) est disponible.',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.blue.shade900),
                        ),
                      ),
                    ],
                  ),
                  if (updateState.latestVersion?.releaseNotes != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      updateState.latestVersion!.releaseNotes!,
                      style:
                          TextStyle(fontSize: 12, color: Colors.blue.shade800),
                    ),
                  ],
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => launchUrl(
                        Uri.parse('${AppConfig.frontendUrl}/telecharger'),
                        mode: LaunchMode.externalApplication,
                      ),
                      style: FilledButton.styleFrom(
                          backgroundColor: Colors.blue.shade600),
                      icon: const Icon(Icons.download_outlined, size: 18),
                      label: const Text('Télécharger la mise à jour'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              border: Border.all(
                  color: Colors.grey.shade300, style: BorderStyle.solid),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                "Contenu à définir — mis de côté pour l'instant, on y reviendra.",
                style:
                    TextStyle(color: Colors.blue.withAlpha(150), fontSize: 13),
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Seul endroit de l'espace "Compte" d'où se déconnecter — le
          // shell (account_shell.dart) n'a qu'une barre de navigation, pas
          // de menu ; jusqu'ici la déconnexion n'était atteignable que
          // depuis l'espace boutique (store_shell.dart). Même geste exact
          // que là-bas (AuthState.logout(), sans confirmation) : la
          // redirection vers /login se fait automatiquement (voir
          // app_router.dart#redirect, qui écoute AuthState).
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.read<AuthState>().logout(),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red.shade600,
                side: BorderSide(color: Colors.red.shade200),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.logout),
              label: const Text('Se déconnecter'),
            ),
          ),
        ],
      ),
    );
  }
}
