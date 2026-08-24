import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../state/auth_state.dart';
import '../data/auth_api.dart';

const _kResendCooldownSeconds = 30;

/// Miroir de VerifyEmailPage.jsx — le compte reste PENDING_VERIFICATION
/// tant que ce code n'est pas validé ici, login() le refuse explicitement
/// entre-temps (cf. LoginPage — même erreur EMAIL_NOT_VERIFIED gérée là-bas).
///
/// [initialEmail] vient de RegisterPage juste après l'inscription (ou de
/// LoginPage si un compte existant tente de se connecter sans être encore
/// vérifié) — reste modifiable, ce champ garantit que l'écran fonctionne
/// même en arrivant ici directement.
class VerifyEmailPage extends StatefulWidget {
  const VerifyEmailPage({super.key, this.initialEmail});

  final String? initialEmail;

  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}

class _VerifyEmailPageState extends State<VerifyEmailPage> {
  late final TextEditingController _emailController;
  final _codeController = TextEditingController();

  String? _error;
  String? _resendMessage;
  bool _verifying = false;
  bool _resending = false;
  int _cooldown = 0;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail ?? '');
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _cooldown = _kResendCooldownSeconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _cooldown--);
      if (_cooldown <= 0) timer.cancel();
    });
  }

  Future<void> _verify() async {
    setState(() {
      _error = null;
      _verifying = true;
    });
    try {
      final result = await context.read<AuthApi>().verifyEmail(
            email: _emailController.text.trim(),
            code: _codeController.text,
          );
      if (!mounted) return;
      context.read<AuthState>().setSession(result);
      context.go('/account');
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _error = null;
      _resendMessage = null;
      _resending = true;
    });
    try {
      final result = await context.read<AuthApi>().resendVerificationCode(_emailController.text.trim());
      if (!mounted) return;
      setState(() => _resendMessage = result['message'] as String? ?? 'Code renvoyé.');
      _startCooldown();
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = _emailController.text.trim();
    final codeComplete = _codeController.text.length == 6;

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
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('Vérifiez votre e-mail', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Text(
                          'Entrez le code à 6 chiffres envoyé à votre adresse e-mail pour activer votre compte.',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
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
                            child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                          ),
                          const SizedBox(height: 12),
                        ],
                        if (_resendMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.green.shade100),
                            ),
                            child: Text(_resendMessage!, style: TextStyle(color: Colors.green.shade800, fontSize: 13)),
                          ),
                          const SizedBox(height: 12),
                        ],
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(labelText: 'E-mail'),
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _codeController,
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 20, letterSpacing: 8),
                          decoration: const InputDecoration(labelText: 'Code de vérification', counterText: ''),
                          onChanged: (value) {
                            final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
                            if (digitsOnly != value) {
                              _codeController.value = TextEditingValue(
                                text: digitsOnly,
                                selection: TextSelection.collapsed(offset: digitsOnly.length),
                              );
                            }
                            setState(() {});
                          },
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: (_verifying || !codeComplete) ? null : _verify,
                          child: _verifying
                              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Vérifier'),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: (_resending || _cooldown > 0 || email.isEmpty) ? null : _resend,
                          child: Text(
                            _cooldown > 0
                                ? 'Renvoyer le code (${_cooldown}s)'
                                : (_resending ? 'Envoi...' : 'Renvoyer le code'),
                          ),
                        ),
                        const SizedBox(height: 4),
                        TextButton(
                          onPressed: () => context.go('/login'),
                          child: const Text('Retour à la connexion'),
                        ),
                      ],
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
