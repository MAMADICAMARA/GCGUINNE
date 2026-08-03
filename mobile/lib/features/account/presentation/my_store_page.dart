import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../state/auth_state.dart';
import '../../../state/models/store.dart';
import '../../auth/data/auth_api.dart';
import '../data/stores_api.dart';

/// Miroir de frontend/src/pages/account/MyStorePage.jsx.
class MyStorePage extends StatefulWidget {
  const MyStorePage({super.key});

  @override
  State<MyStorePage> createState() => _MyStorePageState();
}

class _MyStorePageState extends State<MyStorePage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _categoryController = TextEditingController();
  final _cityController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _loadingList = true;
  bool _showForm = false;
  bool _submitting = false;
  int? _openingStoreId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refreshStores();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _categoryController.dispose();
    _cityController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  /// La liste des boutiques peut avoir changé depuis la connexion — on la
  /// rafraîchit toujours ici plutôt que de se fier uniquement à ce qui
  /// était présent au login (même logique que le useEffect côté web).
  Future<void> _refreshStores() async {
    try {
      final stores = await context.read<StoresApi>().listMine();
      if (!mounted) return;
      context.read<AuthState>().setStores(stores);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _loadingList = false);
    }
  }

  Future<void> _handleCreate() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await context.read<StoresApi>().create(
            name: _nameController.text.trim(),
            category: _categoryController.text.trim(),
            city: _cityController.text.trim(),
            phone: _phoneController.text.trim(),
          );
      if (!mounted) return;
      // La nouvelle boutique devient immédiatement active — pas d'étape
      // de sélection superflue pour une boutique qu'on vient de créer.
      context.read<AuthState>().applyStoreSwitch(result);
      context.go('/workspace');
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _handleOpen(StoreRef store) async {
    setState(() {
      _openingStoreId = store.id;
      _error = null;
    });

    try {
      final result = await context.read<AuthApi>().switchStore(store.id);
      if (!mounted) return;
      context.read<AuthState>().applyStoreSwitch(result);
      context.go('/workspace');
    } on ApiException catch (err) {
      setState(() {
        _error = err.message;
        _openingStoreId = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<AuthState>().stores;

    if (_loadingList) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Ma Boutique', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          'Gérez vos boutiques ou créez-en une nouvelle.',
          style: TextStyle(color: Colors.grey.shade600),
        ),
        const SizedBox(height: 20),

        if (_error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade100),
            ),
            child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
          ),

        // --- Cas 1 : aucune boutique ---
        if (stores.isEmpty && !_showForm)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    "Vous n'avez pas encore de boutique. Créez-la pour "
                    'commencer à vendre, gérer votre stock et suivre vos clients.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => setState(() => _showForm = true),
                    icon: const Icon(Icons.add),
                    label: const Text('Créer ma boutique'),
                  ),
                ],
              ),
            ),
          ),

        // --- Cas 2 : une ou plusieurs boutiques ---
        if (stores.isNotEmpty)
          ...stores.map((store) {
            final opening = _openingStoreId == store.id;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text(store.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  [
                    store.roleCode,
                    if (store.city != null) store.city!,
                    if (store.isDefaultStore) 'Boutique par défaut',
                  ].join(' · '),
                ),
                trailing: FilledButton(
                  onPressed: opening ? null : () => _handleOpen(store),
                  child: opening
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Ouvrir'),
                ),
              ),
            );
          }),

        if (stores.isNotEmpty && !_showForm)
          TextButton.icon(
            onPressed: () => setState(() => _showForm = true),
            icon: const Icon(Icons.add),
            label: const Text('Créer une autre boutique'),
          ),

        // --- Formulaire de création (affiché à la demande) ---
        if (_showForm)
          Card(
            margin: const EdgeInsets.only(top: 12),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Nouvelle boutique', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Nom de la boutique'),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _categoryController,
                      decoration: const InputDecoration(labelText: 'Catégorie (optionnel)'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _cityController,
                      decoration: const InputDecoration(labelText: 'Ville (optionnel)'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Téléphone (optionnel)'),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: _submitting ? null : _handleCreate,
                            child: _submitting
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Créer la boutique'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        TextButton(
                          onPressed: () => setState(() => _showForm = false),
                          child: const Text('Annuler'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
