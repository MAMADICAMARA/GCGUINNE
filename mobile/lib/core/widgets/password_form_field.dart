import 'package:flutter/material.dart';

/// Champ mot de passe avec bascule afficher/masquer — miroir du composant
/// PasswordInput.jsx côté web (décidé en conversation : plus facile à
/// taper correctement sur mobile, notamment pour un public peu habitué au
/// numérique). Réutilisé dans tous les formulaires qui saisissent un mot
/// de passe plutôt que de répéter la logique de bascule à chaque écran.
class PasswordFormField extends StatefulWidget {
  const PasswordFormField({super.key, required this.controller, required this.labelText, this.validator});

  final TextEditingController controller;
  final String labelText;
  final String? Function(String?)? validator;

  @override
  State<PasswordFormField> createState() => _PasswordFormFieldState();
}

class _PasswordFormFieldState extends State<PasswordFormField> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: !_visible,
      decoration: InputDecoration(
        labelText: widget.labelText,
        suffixIcon: IconButton(
          icon: Icon(_visible ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
          tooltip: _visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
          onPressed: () => setState(() => _visible = !_visible),
        ),
      ),
      validator: widget.validator,
    );
  }
}
