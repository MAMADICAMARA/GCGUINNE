import 'package:flutter/material.dart';

class AccountSettingsPage extends StatelessWidget {
  const AccountSettingsPage({super.key});

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
        ],
      ),
    );
  }
}
