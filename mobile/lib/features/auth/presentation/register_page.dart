import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/widgets/password_form_field.dart';
import '../data/auth_api.dart';

const _kGenderOptions = {'HOMME': 'Homme', 'FEMME': 'Femme', 'AUTRE': 'Autre'};

/// Miroir de RegisterPage.jsx — mêmes champs, même contrat serveur exact
/// (auth.routes.js#register exige fullName/email/password/passwordConfirm/
/// phone/gender/birthDate, tous requis). Le compte est créé
/// PENDING_VERIFICATION : pas de connexion immédiate, on enchaîne sur
/// VerifyEmailPage comme côté web.
class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordConfirmController = TextEditingController();

  String? _gender;
  DateTime? _birthDate;

  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _passwordConfirmController.dispose();
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    // Vérifications côté client, en plus de celles du serveur (qui restent
    // les seules qui comptent réellement) — même logique que
    // RegisterPage.jsx : évite un aller-retour réseau pour une erreur de
    // saisie évidente.
    if (_passwordController.text != _passwordConfirmController.text) {
      setState(() => _error = 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (_gender == null) {
      setState(() => _error = 'Le sexe est requis.');
      return;
    }
    if (_birthDate == null) {
      setState(() => _error = 'La date de naissance est requise.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final authApi = context.read<AuthApi>();
      final email = _emailController.text.trim();
      await authApi.register(
        fullName: _fullNameController.text.trim(),
        email: email,
        password: _passwordController.text,
        passwordConfirm: _passwordConfirmController.text,
        phone: _phoneController.text.trim(),
        gender: _gender!,
        birthDate: _birthDate!.toIso8601String(),
      );
      if (!mounted) return;
      // Inscription volontairement limitée au compte : la création de
      // boutique se fait ensuite, depuis "Ma Boutique" (§4.1 vs §4.2 du
      // cahier des charges). Un compte peut exister sans boutique. Pas de
      // connexion immédiate ici (§6.1) : on enchaîne sur la vérification.
      context.go('/verify-email', extra: email);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _formatBirthDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF082C48),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Gestion Commerciale',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Créer votre compte',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 16),
                          if (_error != null) ...[
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.red.shade100),
                              ),
                              child: Text(
                                _error!,
                                style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                          TextFormField(
                            controller: _fullNameController,
                            decoration: const InputDecoration(labelText: 'Nom complet'),
                            validator: (v) =>
                                (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(labelText: 'E-mail'),
                            validator: (v) =>
                                (v == null || !v.contains('@')) ? 'E-mail invalide' : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(labelText: 'Téléphone', hintText: '622 00 00 00'),
                            validator: (v) =>
                                (v == null || v.trim().isEmpty) ? 'Téléphone requis' : null,
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: _gender,
                            decoration: const InputDecoration(labelText: 'Sexe'),
                            hint: const Text('Choisir'),
                            items: [
                              for (final entry in _kGenderOptions.entries)
                                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
                            ],
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
                                style: TextStyle(
                                  color: _birthDate == null ? Theme.of(context).hintColor : null,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          PasswordFormField(
                            controller: _passwordController,
                            labelText: 'Mot de passe (6 caractères min.)',
                            validator: (v) => (v == null || v.length < 6)
                                ? 'Au moins 6 caractères'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          PasswordFormField(
                            controller: _passwordConfirmController,
                            labelText: 'Confirmer le mot de passe',
                            validator: (v) => (v == null || v.length < 6)
                                ? 'Retapez le mot de passe'
                                : null,
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _loading ? null : _submit,
                            child: _loading
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Créer mon compte'),
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: () => context.go('/login'),
                            child: const Text('Déjà un compte ? Se connecter'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
