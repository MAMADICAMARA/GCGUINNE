import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/widgets/password_form_field.dart';
import '../data/auth_api.dart';

enum _Step { request, reset, done }

/// Miroir de ForgotPasswordPage.jsx — mot de passe oublié en 2 étapes
/// (§6.2 du cahier des charges). Règle de sécurité centrale (§6.2.2) : la
/// réponse de l'étape 1 est strictement identique que l'e-mail existe ou
/// non — l'écran passe donc TOUJOURS à l'étape 2 après un envoi réussi,
/// sans jamais indiquer si un code a réellement été envoyé. Pas de
/// connexion automatique à la fin (contrairement à VerifyEmailPage) :
/// l'utilisateur doit se reconnecter avec son nouveau mot de passe.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  _Step _step = _Step.request;
  final _emailController = TextEditingController();
  String? _requestMessage;

  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _newPasswordConfirmController = TextEditingController();

  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _newPasswordController.dispose();
    _newPasswordConfirmController.dispose();
    super.dispose();
  }

  Future<void> _handleRequest() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final result = await context.read<AuthApi>().requestPasswordReset(_emailController.text.trim());
      if (!mounted) return;
      setState(() {
        _requestMessage = result['message'] as String?;
        _step = _Step.reset;
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleReset() async {
    setState(() => _error = null);
    if (_newPasswordController.text != _newPasswordConfirmController.text) {
      setState(() => _error = 'Les mots de passe ne correspondent pas.');
      return;
    }
    setState(() => _loading = true);
    try {
      await context.read<AuthApi>().resetPassword(
            email: _emailController.text.trim(),
            code: _codeController.text,
            newPassword: _newPasswordController.text,
            newPasswordConfirm: _newPasswordConfirmController.text,
          );
      if (!mounted) return;
      setState(() => _step = _Step.done);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF082C48),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Gestion Commerciale',
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: _buildStepContent(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case _Step.done:
        return _buildDoneStep();
      case _Step.reset:
        return _buildResetStep();
      case _Step.request:
        return _buildRequestStep();
    }
  }

  Widget _buildDoneStep() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Mot de passe mis à jour', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(
          'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: () => context.go('/login'),
          child: const Text('Se connecter'),
        ),
      ],
    );
  }

  Widget _buildRequestStep() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Mot de passe oublié', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(
          'Entrez votre adresse e-mail — si un compte y est associé, un code de réinitialisation vous sera envoyé.',
          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
        ),
        const SizedBox(height: 16),
        if (_error != null) ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red.shade100)),
            child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
          ),
          const SizedBox(height: 12),
        ],
        TextFormField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'E-mail'),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: (_loading || !_emailController.text.contains('@')) ? null : _handleRequest,
          child: _loading
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Envoyer le code'),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => context.go('/login'),
          child: const Text('Retour à la connexion'),
        ),
      ],
    );
  }

  Widget _buildResetStep() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Réinitialiser le mot de passe', style: Theme.of(context).textTheme.titleMedium),
        if (_requestMessage != null) ...[
          const SizedBox(height: 6),
          Text(_requestMessage!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5)),
        ],
        const SizedBox(height: 14),
        if (_error != null) ...[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red.shade100)),
            child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
          ),
          const SizedBox(height: 12),
        ],
        TextFormField(
          controller: _codeController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 20, letterSpacing: 8),
          decoration: const InputDecoration(labelText: 'Code reçu par e-mail', counterText: ''),
          onChanged: (value) {
            final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
            if (digitsOnly != value) {
              _codeController.value = TextEditingValue(text: digitsOnly, selection: TextSelection.collapsed(offset: digitsOnly.length));
            }
            setState(() {});
          },
        ),
        const SizedBox(height: 12),
        PasswordFormField(
          controller: _newPasswordController,
          labelText: 'Nouveau mot de passe (6 caractères min.)',
        ),
        const SizedBox(height: 12),
        PasswordFormField(
          controller: _newPasswordConfirmController,
          labelText: 'Confirmer le mot de passe',
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: (_loading || _codeController.text.length != 6) ? null : _handleReset,
          child: _loading
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Réinitialiser le mot de passe'),
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: () => setState(() {
            _step = _Step.request;
            _error = null;
          }),
          icon: const Icon(Icons.chevron_left, size: 16),
          label: const Text('Utiliser un autre e-mail'),
        ),
      ],
    );
  }
}
