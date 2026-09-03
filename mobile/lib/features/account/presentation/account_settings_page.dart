import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Paramètres', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('Réglages du compte.', style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                "Contenu à définir — mis de côté pour l'instant, on y reviendra.",
                style: TextStyle(color: Colors.blue.withAlpha(150), fontSize: 13),
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
