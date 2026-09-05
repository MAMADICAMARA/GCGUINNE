import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/auth/quick_unlock_service.dart';
import '../../../core/config/app_config.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/quick_unlock_storage.dart';
import '../../../core/widgets/password_form_field.dart';
import '../../../state/auth_state.dart';
import '../../../state/update_state.dart';
import '../../app_update/data/app_update_api.dart';
import '../../auth/data/auth_api.dart';

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
          const _QuickUnlockSection(),
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

/// Déverrouillage rapide (§ décidé en conversation) — reconnexion
/// automatique en déverrouillant simplement le téléphone (empreinte,
/// visage, code ou schéma), plutôt que de retaper e-mail/mot de passe à
/// chaque expiration de session (8h, cf. login_page.dart). Voir
/// QuickUnlockStorage/QuickUnlockService pour le détail du mécanisme.
class _QuickUnlockSection extends StatefulWidget {
  const _QuickUnlockSection();

  @override
  State<_QuickUnlockSection> createState() => _QuickUnlockSectionState();
}

class _QuickUnlockSectionState extends State<_QuickUnlockSection> {
  bool _loading = true;
  bool _enabled = false;
  bool _deviceSupported = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final enabled = await context.read<QuickUnlockStorage>().isEnabled;
    final supported =
        await context.read<QuickUnlockService>().isDeviceSupported();
    if (!mounted) return;
    setState(() {
      _enabled = enabled;
      _deviceSupported = supported;
      _loading = false;
    });
  }

  Future<void> _enable() async {
    final email = context.read<AuthState>().user?.email;
    if (email == null) return;

    // On ne conserve jamais le mot de passe en mémoire au-delà du
    // formulaire de connexion — il faut le redemander explicitement ici
    // avant de pouvoir l'enregistrer pour le déverrouillage rapide.
    final password = await showDialog<String>(
      context: context,
      builder: (dialogContext) => _ConfirmPasswordDialog(email: email),
    );
    if (password == null || password.isEmpty || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Vérifie que le mot de passe est correct avant d'enregistrer quoi
      // que ce soit (vrai POST /auth/login, donc une entrée LOGIN de plus
      // — cohérent avec le reste de la fonctionnalité).
      await context.read<AuthApi>().login(email: email, password: password);
      await context
          .read<QuickUnlockStorage>()
          .save(email: email, password: password);
      if (!mounted) return;
      setState(() => _enabled = true);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disable() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Désactiver le déverrouillage rapide ?'),
        content: const Text(
          'Vous devrez retaper votre e-mail et votre mot de passe à la prochaine connexion.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade500),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Désactiver'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await context.read<QuickUnlockStorage>().clear();
    if (!mounted) return;
    setState(() => _enabled = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(12),
      ),
      child: _loading
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.fingerprint, color: Colors.blue.shade600),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text('Déverrouillage rapide',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                    _busy
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Switch(
                            value: _enabled,
                            onChanged: _deviceSupported
                                ? (value) => value ? _enable() : _disable()
                                : null,
                          ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  _deviceSupported
                      ? 'Reconnexion automatique en déverrouillant simplement votre téléphone (empreinte, visage, code ou schéma) — sans retaper vos identifiants.'
                      : "Aucun verrou n'est configuré sur cet appareil (empreinte, visage, code ou schéma). Activez-en un dans les réglages du téléphone pour utiliser cette fonctionnalité.",
                  style: TextStyle(
                      fontSize: 12.5,
                      color: Colors.grey.shade600,
                      height: 1.35),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!,
                      style:
                          const TextStyle(color: Colors.red, fontSize: 12.5)),
                ],
              ],
            ),
    );
  }
}

class _ConfirmPasswordDialog extends StatefulWidget {
  const _ConfirmPasswordDialog({required this.email});

  final String email;

  @override
  State<_ConfirmPasswordDialog> createState() => _ConfirmPasswordDialogState();
}

class _ConfirmPasswordDialogState extends State<_ConfirmPasswordDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Confirmez votre mot de passe'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.email,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5)),
          const SizedBox(height: 10),
          PasswordFormField(
              controller: _controller, labelText: 'Mot de passe actuel'),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Annuler'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_controller.text),
          child: const Text('Confirmer'),
        ),
      ],
    );
  }
}
