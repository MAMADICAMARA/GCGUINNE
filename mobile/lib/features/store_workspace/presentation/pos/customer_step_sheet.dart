import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/customers_api.dart';
import '../../data/pos_models.dart';

/// Miroir de CustomerStepModal.jsx — deuxième étape de la validation d'une
/// vente : rattacher un client, en préparer un nouveau, ou vendre sans
/// client. Un NOUVEAU client n'est jamais créé ici, seulement transmis en
/// mémoire (isNewCustomer: true) — il n'est réellement créé qu'à la
/// confirmation finale de la vente, dans la même transaction que la
/// commande (voir orders.service.js côté backend).
Future<SelectedCustomer?> showCustomerStepSheet(BuildContext context) {
  return showModalBottomSheet<SelectedCustomer>(
    context: context,
    isScrollControlled: true,
    builder: (context) => const _CustomerStepSheet(),
  );
}

class _CustomerStepSheet extends StatefulWidget {
  const _CustomerStepSheet();

  @override
  State<_CustomerStepSheet> createState() => _CustomerStepSheetState();
}

class _CustomerStepSheetState extends State<_CustomerStepSheet> {
  final _searchController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  List<CustomerSearchResult> _results = [];
  bool _searching = false;
  bool _showCreateForm = false;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      final results = await context.read<CustomersApi>().search(value);
      if (!mounted) return;
      setState(() {
        _results = results;
        _searching = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => Padding(
          padding: const EdgeInsets.all(20),
          child: ListView(
            controller: scrollController,
            children: [
              const Text('Client', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const Text(
                'Recherchez un client existant, ajoutez-en un nouveau, ou vendez sans client.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              if (!_showCreateForm) ..._buildSearchStep() else ..._buildCreateForm(),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildSearchStep() {
    return [
      TextField(
        controller: _searchController,
        autofocus: true,
        onChanged: _onSearchChanged,
        decoration: const InputDecoration(
          hintText: 'Nom ou numéro de téléphone...',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 10),
      if (_searching) const Text('Recherche...', style: TextStyle(color: Colors.grey)),
      if (_results.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(top: 6),
          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(8)),
          child: Column(
            children: [
              for (final customer in _results)
                ListTile(
                  title: Text(customer.name),
                  subtitle: Text(customer.phone ?? 'Sans téléphone'),
                  onTap: () => Navigator.of(context)
                      .pop(SelectedCustomer(id: customer.id, name: customer.name, phone: customer.phone)),
                ),
            ],
          ),
        ),
      if (_searchController.text.trim().isNotEmpty && !_searching && _results.isEmpty)
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text('Aucun client trouvé.', style: TextStyle(color: Colors.grey)),
        ),
      const SizedBox(height: 14),
      OutlinedButton(
        onPressed: () {
          _nameController.text = _searchController.text.trim();
          setState(() => _showCreateForm = true);
        },
        child: const Text('+ Nouveau client'),
      ),
      const SizedBox(height: 10),
      FilledButton(
        onPressed: () => Navigator.of(context).pop(const SelectedCustomer(name: 'Client anonyme')),
        child: const Text('Vente sans client'),
      ),
    ];
  }

  List<Widget> _buildCreateForm() {
    return [
      const Text(
        'Ce client sera enregistré uniquement si la vente est confirmée à l\'étape suivante.',
        style: TextStyle(fontSize: 12, color: Colors.grey),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _nameController,
        autofocus: true,
        onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(labelText: 'Nom', border: OutlineInputBorder()),
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        decoration: const InputDecoration(labelText: 'Téléphone (optionnel)', border: OutlineInputBorder()),
      ),
      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(
            child: FilledButton(
              onPressed: _nameController.text.trim().isEmpty
                  ? null
                  : () => Navigator.of(context).pop(SelectedCustomer(
                        name: _nameController.text.trim(),
                        phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
                        isNewCustomer: true,
                      )),
              child: const Text('Continuer'),
            ),
          ),
          TextButton(
            onPressed: () => setState(() => _showCreateForm = false),
            child: const Text('Retour'),
          ),
        ],
      ),
    ];
  }
}
