import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/widgets/password_form_field.dart';
import '../../../routing/login_route_extra.dart';
import '../../../state/auth_state.dart';
import '../../auth/data/auth_api.dart';

const _kGenderOptions = {'HOMME': 'Homme', 'FEMME': 'Femme', 'AUTRE': 'Autre'};

// Palette dérivée de la charte existante (bleu de marque) + tons
// complémentaires harmonieux — miroir de AVATAR_PALETTE côté web
// (ProfilePage.jsx), pour donner un avatar coloré et distinctif à chaque
// personne sans jamais sortir de l'identité visuelle déjà établie.
const _kAvatarPalette = [
  Color(0xFF0F5E9C),
  Color(0xFF0D9488),
  Color(0xFF7C3AED),
  Color(0xFFD97706),
  Color(0xFFE11D48),
  Color(0xFF059669),
];

String _initialsFor(String? fullName) {
  if (fullName == null || fullName.trim().isEmpty) return '?';
  final parts = fullName.trim().split(RegExp(r'\s+'));
  final first = parts.first.isNotEmpty ? parts.first[0] : '';
  final last = parts.length > 1 && parts.last.isNotEmpty ? parts.last[0] : '';
  return (first + last).toUpperCase();
}

// Couleur stable pour une même personne (basée sur son nom, pas aléatoire à
// chaque rendu) — même principe que getAvatarStyle() côté web.
Color _avatarColorFor(String? fullName) {
  if (fullName == null || fullName.isEmpty) return _kAvatarPalette.first;
  final hash = fullName.codeUnits.fold<int>(0, (sum, c) => sum + c);
  return _kAvatarPalette[hash % _kAvatarPalette.length];
}

String? _toDateInputValue(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  return iso.length >= 10 ? iso.substring(0, 10) : iso;
}

/// Miroir de ProfilePage.jsx — tout modifiable SAUF l'e-mail (identifiant de
/// connexion, affiché en lecture seule avec une explication). Deux
/// formulaires distincts : informations (nom/téléphone/sexe/naissance) et
/// mot de passe (nécessite l'actuel), chacun avec son propre état de
/// chargement/erreur — jamais couplés, une erreur sur l'un ne doit jamais
/// bloquer l'autre.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullNameController;
  late final TextEditingController _phoneController;
  String? _gender;
  DateTime? _birthDate;

  bool _saving = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthState>().user;
    _fullNameController = TextEditingController(text: user?.fullName ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _gender = user?.gender;
    final birthDateValue = _toDateInputValue(user?.birthDate);
    _birthDate = birthDateValue != null ? DateTime.tryParse(birthDateValue) : null;
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(now.year - 120),
      lastDate: now,
      helpText: 'Date de naissance',
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  String _formatBirthDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;
    if (_gender == null) {
      setState(() => _error = 'Le sexe est requis.');
      return;
    }
    if (_birthDate == null) {
      setState(() => _error = 'La date de naissance est requise.');
      return;
    }

    setState(() {
      _error = null;
      _success = null;
      _saving = true;
    });
    try {
      final updated = await context.read<AuthApi>().updateProfile(
            fullName: _fullNameController.text.trim(),
            phone: _phoneController.text.trim(),
            gender: _gender!,
            birthDate: _birthDate!.toIso8601String(),
          );
      if (!mounted) return;
      context.read<AuthState>().setUser(updated);
      setState(() => _success = 'Profil mis à jour.');
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _success = null);
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    final initials = _initialsFor(user?.fullName);
    final avatarColor = _avatarColorFor(user?.fullName);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Profil', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text('Vos informations personnelles.', style: TextStyle(color: Colors.grey.shade600)),
        const SizedBox(height: 20),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // En-tête signature : avatar à initiales, coloré de façon
              // stable selon le nom — donne une identité visuelle à chaque
              // personne, même principe que ProfilePage.jsx côté web.
              Container(
                width: double.infinity,
                color: Colors.grey.shade50,
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: avatarColor.withValues(alpha: 0.12),
                      child: Text(initials, style: TextStyle(color: avatarColor, fontWeight: FontWeight.w700, fontSize: 18)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user?.fullName ?? 'Utilisateur', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          Text(user?.email ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey.shade500, fontSize: 12.5)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                          child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
                        ),
                      if (_success != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
                          child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
                        ),
                      InputDecorator(
                        decoration: const InputDecoration(labelText: 'E-mail'),
                        child: Text(user?.email ?? '', style: TextStyle(color: Colors.grey.shade500)),
                      ),
                      const Padding(
                        padding: EdgeInsets.only(top: 4, bottom: 12),
                        child: Text('Non modifiable — c\'est votre identifiant de connexion.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ),
                      TextFormField(
                        controller: _fullNameController,
                        decoration: const InputDecoration(labelText: 'Nom complet'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Téléphone'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Téléphone requis' : null,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _gender,
                        decoration: const InputDecoration(labelText: 'Sexe'),
                        hint: const Text('Choisir'),
                        items: [for (final entry in _kGenderOptions.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                        onChanged: (value) => setState(() => _gender = value),
                        validator: (v) => v == null ? 'Le sexe est requis' : null,
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: _pickBirthDate,
                        child: InputDecorator(
                          decoration: const InputDecoration(labelText: 'Date de naissance'),
                          child: Text(
                            _birthDate == null ? 'jj/mm/aaaa' : _formatBirthDate(_birthDate!),
                            style: TextStyle(color: _birthDate == null ? Theme.of(context).hintColor : null),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: _saving ? null : _handleSave,
                        child: _saving
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Enregistrer'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const _ChangePasswordCard(),
      ],
    );
  }
}

class _ChangePasswordCard extends StatefulWidget {
  const _ChangePasswordCard();

  @override
  State<_ChangePasswordCard> createState() => _ChangePasswordCardState();
}

class _ChangePasswordCardState extends State<_ChangePasswordCard> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _newConfirmController = TextEditingController();

  bool _saving = false;
  String? _error;
  String? _success;
  // true dès que le mot de passe actuel saisi est refusé — propose alors
  // l'option "recevoir un code par e-mail" plutôt que de laisser la
  // personne bloquée (§ décidé en conversation).
  bool _wrongCurrentPassword = false;

  // Repli par e-mail (réutilise le même mécanisme que "mot de passe
  // oublié" côté web — ForgotPasswordPage.jsx — plutôt qu'un second
  // système de vérification). L'e-mail est déjà connu (celui du compte
  // connecté), jamais resaisi.
  bool _sendingCode = false;
  bool _codeSent = false;
  bool _redirecting = false;
  final _resetFormKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _resetNewController = TextEditingController();
  final _resetNewConfirmController = TextEditingController();
  String? _resetError;
  bool _resetSubmitting = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _newConfirmController.dispose();
    _codeController.dispose();
    _resetNewController.dispose();
    _resetNewConfirmController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_newController.text != _newConfirmController.text) {
      setState(() => _error = 'Les mots de passe ne correspondent pas.');
      return;
    }

    setState(() {
      _error = null;
      _success = null;
      _wrongCurrentPassword = false;
      _saving = true;
    });
    try {
      final token = await context.read<AuthApi>().changePassword(
            currentPassword: _currentController.text,
            newPassword: _newController.text,
            newPasswordConfirm: _newConfirmController.text,
          );
      if (!mounted) return;
      // La session en cours continue avec le nouveau jeton — les AUTRES
      // sessions ouvertes ailleurs sont invalidées côté serveur, jamais
      // celle-ci (cf. auth.service.js#changePassword).
      context.read<AuthState>().setToken(token);
      _currentController.clear();
      _newController.clear();
      _newConfirmController.clear();
      setState(() => _success = 'Mot de passe modifié. Vos autres sessions ont été déconnectées.');
      Future.delayed(const Duration(seconds: 8), () {
        if (mounted) setState(() => _success = null);
      });
    } on ApiException catch (err) {
      setState(() {
        _error = err.message;
        if (err.code == 'INVALID_CURRENT_PASSWORD') _wrongCurrentPassword = true;
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _sendCode() async {
    final email = context.read<AuthState>().user?.email;
    if (email == null) return;
    setState(() {
      _resetError = null;
      _sendingCode = true;
    });
    try {
      await context.read<AuthApi>().requestPasswordReset(email);
      if (!mounted) return;
      setState(() {
        _codeSent = true;
        _sendingCode = false;
      });
    } on ApiException catch (err) {
      setState(() {
        _resetError = err.message;
        _sendingCode = false;
      });
    }
  }

  Future<void> _handleResetViaCode() async {
    if (!_resetFormKey.currentState!.validate()) return;
    if (_resetNewController.text != _resetNewConfirmController.text) {
      setState(() => _resetError = 'Les mots de passe ne correspondent pas.');
      return;
    }
    final email = context.read<AuthState>().user?.email;
    if (email == null) return;

    setState(() {
      _resetError = null;
      _resetSubmitting = true;
    });
    try {
      await context.read<AuthApi>().resetPassword(
            email: email,
            code: _codeController.text,
            newPassword: _resetNewController.text,
            newPasswordConfirm: _resetNewConfirmController.text,
          );
      if (!mounted) return;
      // Le code par e-mail invalide la session en cours (aucun nouveau
      // jeton renvoyé, contrairement au changement via mot de passe actuel
      // — cf. auth.service.js#resetPassword) : reconnexion obligatoire,
      // même comportement que le flux "mot de passe oublié".
      setState(() => _redirecting = true);
      Future.delayed(const Duration(milliseconds: 1800), () async {
        if (!mounted) return;
        await context.read<AuthState>().logout();
        if (mounted) context.go('/login', extra: LoginRouteExtra(prefillEmail: email));
      });
    } on ApiException catch (err) {
      setState(() => _resetError = err.message);
    } finally {
      if (mounted) setState(() => _resetSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: _redirecting
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  'Mot de passe mis à jour. Reconnexion nécessaire — redirection...',
                  style: TextStyle(color: Colors.green.shade800, fontSize: 12.5),
                ),
              )
            : _codeSent
                ? _buildResetViaCodeForm()
                : _buildCurrentPasswordForm(),
      ),
    );
  }

  Widget _buildCurrentPasswordForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Mot de passe', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 4),
          Text('Changer votre mot de passe déconnecte automatiquement vos autres sessions ouvertes.', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          const SizedBox(height: 14),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          PasswordFormField(
            controller: _currentController,
            labelText: 'Mot de passe actuel',
            validator: (v) => (v == null || v.isEmpty) ? 'Requis' : null,
          ),
          const SizedBox(height: 12),
          PasswordFormField(
            controller: _newController,
            labelText: 'Nouveau mot de passe',
            validator: (v) => (v == null || v.length < 6) ? 'Au moins 6 caractères' : null,
          ),
          const SizedBox(height: 12),
          PasswordFormField(
            controller: _newConfirmController,
            labelText: 'Confirmer le nouveau mot de passe',
            validator: (v) => (v == null || v.length < 6) ? 'Retapez le mot de passe' : null,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _saving ? null : _handleSubmit,
            child: _saving
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Changer le mot de passe'),
          ),
          if (_wrongCurrentPassword) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.amber.shade100)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Mot de passe actuel oublié ?', style: TextStyle(fontSize: 11.5, color: Colors.amber.shade800)),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: _sendingCode ? null : _sendCode,
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                    child: Text(_sendingCode ? 'Envoi du code...' : 'Recevoir un code par e-mail', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildResetViaCodeForm() {
    final email = context.watch<AuthState>().user?.email ?? '';
    return Form(
      key: _resetFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Un code a été envoyé à $email — vérifiez aussi vos courriers indésirables.', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          const SizedBox(height: 12),
          if (_resetError != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_resetError!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          TextFormField(
            controller: _codeController,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            style: const TextStyle(fontSize: 18, letterSpacing: 6, fontWeight: FontWeight.w700),
            decoration: const InputDecoration(labelText: 'Code reçu par e-mail', counterText: '', hintText: '000000'),
            validator: (v) => (v == null || v.length != 6) ? '6 chiffres requis' : null,
          ),
          const SizedBox(height: 8),
          PasswordFormField(
            controller: _resetNewController,
            labelText: 'Nouveau mot de passe',
            validator: (v) => (v == null || v.length < 6) ? 'Au moins 6 caractères' : null,
          ),
          const SizedBox(height: 12),
          PasswordFormField(
            controller: _resetNewConfirmController,
            labelText: 'Confirmer le nouveau mot de passe',
            validator: (v) => (v == null || v.length < 6) ? 'Retapez le mot de passe' : null,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _resetSubmitting ? null : _handleResetViaCode,
            child: _resetSubmitting
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Réinitialiser le mot de passe'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => setState(() {
              _codeSent = false;
              _resetError = null;
            }),
            child: const Text('Retour', style: TextStyle(fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
