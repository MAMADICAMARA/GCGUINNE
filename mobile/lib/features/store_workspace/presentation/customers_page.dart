import 'package:flutter/material.dart';

class CustomersPage extends StatelessWidget {
  const CustomersPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Clients', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text("Recherche, fiche client, historique d'achats.", style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                "Écran à implémenter — voir cahier des charges §8.",
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
