import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/widgets/password_form_field.dart';
import '../../../state/auth_state.dart';
import '../data/auth_api.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.prefillEmail, this.redirectProductId});

  final String? prefillEmail;

  /// Produit MARCHÉ à réafficher juste après connexion (§ bouton
  /// "Contacter le propriétaire", décidé en conversation) — voir
  /// app_router.dart et marketplace_page.dart.
  final int? redirectProductId;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _emailController;
  final _passwordController = TextEditingController();

  bool _loading = false;
  String? _error;
  bool _needsVerification = false;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.prefillEmail ?? '');
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _loading = true;
      _error = null;
      _needsVerification = false;
    });

    try {
      final authApi = context.read<AuthApi>();
      final result = await authApi.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      if (!mounted) return;
      context.read<AuthState>().setSession(result);
      if (widget.redirectProductId != null) {
        context.go('/marche', extra: widget.redirectProductId);
      } else {
        context.go('/account');
      }
    } on ApiException catch (err) {
      // Compte existant mais pas encore vérifié (§6.1 du cahier des
      // charges) — même logique que LoginPage.jsx : proposer directement
      // le lien vers l'écran de code plutôt qu'un message sans issue.
      if (err.code == 'EMAIL_NOT_VERIFIED') {
        setState(() => _needsVerification = true);
      }
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
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Plateforme multi-boutiques',
                  style: TextStyle(color: Colors.white70),
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
                            'Connexion',
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
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _error!,
                                    style: TextStyle(color: Colors.red.shade700, fontSize: 13),
                                  ),
                                  if (_needsVerification) ...[
                                    const SizedBox(height: 6),
                                    InkWell(
                                      onTap: () => context.push('/verify-email', extra: _emailController.text.trim()),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            'Entrer le code de vérification',
                                            style: TextStyle(color: Colors.red.shade700, fontSize: 13, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                                          ),
                                          Icon(Icons.chevron_right, size: 16, color: Colors.red.shade700),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(labelText: 'E-mail'),
                            validator: (v) =>
                                (v == null || !v.contains('@')) ? 'E-mail invalide' : null,
                          ),
                          const SizedBox(height: 12),
                          PasswordFormField(
                            controller: _passwordController,
                            labelText: 'Mot de passe',
                            validator: (v) =>
                                (v == null || v.isEmpty) ? 'Mot de passe requis' : null,
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 32)),
                              onPressed: () => context.push('/forgot-password'),
                              child: const Text('Mot de passe oublié ?', style: TextStyle(fontSize: 12)),
                            ),
                          ),
                          const SizedBox(height: 8),
                          FilledButton(
                            onPressed: _loading ? null : _submit,
                            child: _loading
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Se connecter'),
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: () => context.go('/register'),
                            child: const Text('Créer mon compte'),
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
