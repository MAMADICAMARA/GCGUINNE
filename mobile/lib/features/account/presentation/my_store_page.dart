import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/data/guinee_regions.dart';
import '../../../core/network/api_exception.dart';
import '../../../state/auth_state.dart';
import '../../../state/models/store.dart';
import '../../auth/data/auth_api.dart';
import '../../store_workspace/data/settings_models.dart';
import '../data/stores_api.dart';

const _kOtherCity = '__AUTRE__';

/// Miroir de frontend/src/pages/account/MyStorePage.jsx.
class MyStorePage extends StatefulWidget {
  const MyStorePage({super.key});

  @override
  State<MyStorePage> createState() => _MyStorePageState();
}

class _MyStorePageState extends State<MyStorePage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _freeRegionController = TextEditingController();
  final _freeCityController = TextEditingController();
  final _otherCityController = TextEditingController();

  bool _loadingList = true;
  bool _showForm = false;
  bool _submitting = false;
  int? _openingStoreId;
  String? _error;

  List<StoreTypeOption> _storeTypes = [];
  bool _storeTypesLoading = true;
  int? _storeTypeId;

  String _country = 'Guinée';
  String? _guineeRegion;
  String?
      _cityChoice; // valeur du menu ville (Guinée) : nom connu, ou _kOtherCity

  bool get _isGuinee => _country == 'Guinée';
  List<String> get _citiesForRegion => _isGuinee && _guineeRegion != null
      ? (kGuineeRegions[_guineeRegion!] ?? [])
      : [];

  StoreTypeOption? get _selectedStoreType => _storeTypes
      .where((t) => t.id == _storeTypeId)
      .cast<StoreTypeOption?>()
      .firstWhere((_) => true, orElse: () => null);

  @override
  void initState() {
    super.initState();
    _refreshStores();
    _loadStoreTypes();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _freeRegionController.dispose();
    _freeCityController.dispose();
    _otherCityController.dispose();
    super.dispose();
  }

  /// La liste des boutiques peut avoir changé depuis la connexion — on la
  /// rafraîchit toujours ici plutôt que de se fier uniquement à ce qui
  /// était présent au login. Une seule boutique -> on y entre directement
  /// (réutilise _handleOpen, même logique que le bouton "Ouvrir") plutôt
  /// que d'imposer un clic supplémentaire sur un choix qu'il n'a pas à
  /// faire.
  Future<void> _refreshStores() async {
    try {
      final stores = await context.read<StoresApi>().listMine();
      if (!mounted) return;
      context.read<AuthState>().setStores(stores);
      if (stores.length == 1) {
        await _handleOpen(stores.first);
        if (mounted) setState(() => _loadingList = false);
        return;
      }
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
    if (mounted) setState(() => _loadingList = false);
  }

  Future<void> _loadStoreTypes() async {
    try {
      final types = await context.read<StoresApi>().listStoreTypes();
      if (!mounted) return;
      setState(() {
        _storeTypes = types;
        _storeTypesLoading = false;
      });
    } on ApiException catch (_) {
      // Silencieux : le formulaire affichera juste une liste vide, la
      // validation "requis" empêchera de toute façon une soumission sans
      // type choisi.
      if (mounted) setState(() => _storeTypesLoading = false);
    }
  }

  void _updateCountry(String? value) {
    if (value == null) return;
    // Changer de pays invalide région/ville déjà choisies (le référentiel
    // de régions n'existe que pour la Guinée).
    setState(() {
      _country = value;
      _guineeRegion = null;
      _cityChoice = null;
      _freeRegionController.clear();
      _freeCityController.clear();
      _otherCityController.clear();
    });
  }

  void _updateGuineeRegion(String? value) {
    setState(() {
      _guineeRegion = value;
      _cityChoice = null;
      _otherCityController.clear();
    });
  }

  String? _resolvedCity() {
    if (!_isGuinee) return _freeCityController.text.trim();
    if (_cityChoice == _kOtherCity) return _otherCityController.text.trim();
    return _cityChoice;
  }

  String? _resolvedRegion() =>
      _isGuinee ? _guineeRegion : _freeRegionController.text.trim();

  Future<void> _handleCreate() async {
    if (!_formKey.currentState!.validate()) return;
    if (_storeTypeId == null) {
      setState(() => _error = 'Le type de boutique est requis.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final result = await context.read<StoresApi>().create(
            name: _nameController.text.trim(),
            storeTypeId: _storeTypeId!,
            country: _country,
            region: _resolvedRegion(),
            city: _resolvedCity(),
            address: _addressController.text.trim(),
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
      if (err.code == 'STORE_SUSPENDED') {
        _showSuspendedDialog(store.name);
      } else if (err.code == 'STORE_DEACTIVATED') {
        _showDeactivatedDialog(store);
      } else {
        setState(() => _error = err.message);
      }
      if (mounted) setState(() => _openingStoreId = null);
    }
  }

  void _showDeactivatedDialog(StoreRef store) {
    showDialog(
      context: context,
      builder: (dialogContext) => _DeactivatedStoreDialog(
        store: store,
        onReactivated: () async {
          final stores = await context.read<StoresApi>().listMine();
          if (!mounted) return;
          context.read<AuthState>().setStores(stores);
        },
      ),
    );
  }

  void _showSuspendedDialog(String storeName) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration:
              BoxDecoration(color: Colors.red.shade50, shape: BoxShape.circle),
          child: Icon(Icons.block, color: Colors.red.shade500, size: 22),
        ),
        title: const Text('Boutique suspendue', textAlign: TextAlign.center),
        content: Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 13.5, color: Colors.grey.shade600),
            children: [
              TextSpan(
                  text: '"$storeName" ',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, color: Colors.black87)),
              const TextSpan(
                text:
                    "a été suspendue par l'administrateur de la plateforme. Contactez l'administrateur pour en savoir plus ou pour la réactiver.",
              ),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Fermer')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<AuthState>().stores;

    if (_loadingList) {
      return const Center(child: CircularProgressIndicator());
    }

    // Un utilisateur ne peut posséder (owner_id) qu'une seule boutique (cf.
    // §13_un_seul_owner_par_boutique.sql) — on regarde s'il est OWNER de
    // N'IMPORTE LAQUELLE de ses boutiques, y compris s'il est par ailleurs
    // juste employé ailleurs. Une boutique DÉSACTIVÉE
    // (§53_desactivation_boutique.sql, décidé en conversation) ne compte
    // pas : c'est précisément ce qui libère l'Owner pour, par exemple, en
    // créer une nouvelle.
    final alreadyOwnsStore =
        stores.any((s) => s.roleCode == 'OWNER' && s.status != 'DEACTIVATED');

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Ma Boutique', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(
          alreadyOwnsStore
              ? 'Gérez votre boutique.'
              : 'Gérez vos boutiques ou créez-en une nouvelle.',
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
            child: Text(_error!,
                style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
          ),

        // --- Cas 1 : aucune boutique du tout ---
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
                title: Row(
                  children: [
                    Flexible(
                        child: Text(store.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                const TextStyle(fontWeight: FontWeight.w600))),
                    if (store.status == 'SUSPENDED') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(20)),
                        child: Text('Suspendue',
                            style: TextStyle(
                                color: Colors.red.shade600,
                                fontSize: 11,
                                fontWeight: FontWeight.w600)),
                      ),
                    ],
                    if (store.status == 'DEACTIVATED') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20)),
                        child: Text('Désactivée',
                            style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 11,
                                fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ],
                ),
                subtitle: Text(
                  [
                    store.roleCode,
                    if (store.region != null && store.region!.isNotEmpty)
                      store.region!,
                    if (store.city != null && store.city!.isNotEmpty)
                      store.city!,
                    if (store.isDefaultStore) 'Boutique par défaut',
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: FilledButton(
                  onPressed: opening ? null : () => _handleOpen(store),
                  child: opening
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Ouvrir'),
                ),
              ),
            );
          }),

        // Un Owner ne peut posséder qu'une seule boutique — on ne propose
        // "Créer" que s'il n'en possède encore aucune (il peut être simple
        // employé ailleurs sans jamais avoir créé la sienne).
        if (stores.isNotEmpty && !_showForm && !alreadyOwnsStore)
          TextButton.icon(
            onPressed: () => setState(() => _showForm = true),
            icon: const Icon(Icons.add),
            label: const Text('Créer une autre boutique'),
          ),

        if (stores.isNotEmpty && alreadyOwnsStore)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Vous possédez déjà une boutique. Pour suivre d\'autres boutiques gérées par des tiers, utilisez la fonctionnalité Superviser.',
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade400),
            ),
          ),

        // --- Formulaire de création (affiché à la demande) ---
        if (_showForm && !alreadyOwnsStore)
          Card(
            margin: const EdgeInsets.only(top: 12),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Nouvelle boutique',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                          labelText: 'Nom de la boutique',
                          hintText: 'Camara Mobile Store'),
                      validator: (v) =>
                          (v == null || v.trim().isEmpty) ? 'Nom requis' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      initialValue: _storeTypeId,
                      decoration: InputDecoration(
                          labelText: _storeTypesLoading
                              ? 'Chargement...'
                              : 'Type de boutique'),
                      hint: const Text('Choisir un type...'),
                      items: [
                        for (final t in _storeTypes)
                          DropdownMenuItem(value: t.id, child: Text(t.label))
                      ],
                      onChanged: _storeTypesLoading
                          ? null
                          : (value) => setState(() => _storeTypeId = value),
                      validator: (v) =>
                          v == null ? 'Le type de boutique est requis' : null,
                    ),
                    if (_selectedStoreType != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          _selectedStoreType!.categories.isNotEmpty
                              ? '${_selectedStoreType!.categories.length} catégorie(s) de produits seront créées automatiquement : ${_selectedStoreType!.categories.join(', ')}.'
                              : 'Aucune catégorie prédéfinie pour ce type — vous les créerez vous-même.',
                          style: TextStyle(
                              fontSize: 11.5, color: Colors.grey.shade500),
                        ),
                      ),
                    const SizedBox(height: 16),
                    const Divider(),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text('LOCALISATION',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade500,
                              letterSpacing: 0.4)),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: _country,
                      decoration: const InputDecoration(labelText: 'Pays'),
                      items: [
                        for (final c in kCountries)
                          DropdownMenuItem(value: c, child: Text(c))
                      ],
                      onChanged: _updateCountry,
                    ),
                    const SizedBox(height: 12),
                    Text('Région administrative',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600)),
                    const SizedBox(height: 4),
                    if (_isGuinee)
                      DropdownButtonFormField<String>(
                        initialValue: _guineeRegion,
                        decoration: const InputDecoration(isDense: true),
                        hint: const Text('Choisir une région'),
                        items: [
                          for (final r in kGuineeRegionNames)
                            DropdownMenuItem(value: r, child: Text(r))
                        ],
                        onChanged: _updateGuineeRegion,
                      )
                    else
                      TextFormField(
                        controller: _freeRegionController,
                        decoration: const InputDecoration(
                            hintText: 'Région / province', isDense: true),
                      ),
                    const SizedBox(height: 12),
                    Text('Ville',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600)),
                    const SizedBox(height: 4),
                    if (_isGuinee)
                      DropdownButtonFormField<String>(
                        initialValue: _cityChoice,
                        decoration: const InputDecoration(isDense: true),
                        hint: Text(_guineeRegion != null
                            ? 'Choisir une ville'
                            : 'Choisissez une région d\'abord'),
                        items: [
                          for (final city in _citiesForRegion)
                            DropdownMenuItem(value: city, child: Text(city)),
                          const DropdownMenuItem(
                              value: _kOtherCity, child: Text('Autre...')),
                        ],
                        onChanged: _guineeRegion == null
                            ? null
                            : (value) => setState(() => _cityChoice = value),
                      )
                    else
                      TextFormField(
                        controller: _freeCityController,
                        decoration: const InputDecoration(
                            hintText: 'Ville', isDense: true),
                      ),
                    if (_isGuinee && _cityChoice == _kOtherCity) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _otherCityController,
                        decoration: const InputDecoration(
                            labelText: 'Précisez la ville'),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Ville requise'
                            : null,
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _addressController,
                      decoration: const InputDecoration(
                          labelText: 'Adresse (quartier)',
                          hintText:
                              'Ex : Quartier Timbo, non loin du marché central'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                          labelText: 'Numéro de la boutique',
                          hintText: '622 00 00 00'),
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
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
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

/// Réactivation en libre-service par l'Owner (§53_desactivation_boutique.sql,
/// décidé en conversation) — refusée si un autre poste a été pris
/// entre-temps (message renvoyé tel quel par le serveur dans ce cas).
/// Widget dédié (plutôt qu'un StatefulBuilder inline) pour porter
/// proprement son propre état de chargement/erreur.
class _DeactivatedStoreDialog extends StatefulWidget {
  const _DeactivatedStoreDialog(
      {required this.store, required this.onReactivated});

  final StoreRef store;
  final Future<void> Function() onReactivated;

  @override
  State<_DeactivatedStoreDialog> createState() =>
      _DeactivatedStoreDialogState();
}

class _DeactivatedStoreDialogState extends State<_DeactivatedStoreDialog> {
  bool _reactivating = false;
  String? _error;

  Future<void> _reactivate() async {
    setState(() {
      _error = null;
      _reactivating = true;
    });
    try {
      await context.read<StoresApi>().reactivateStore(widget.store.id);
      if (!mounted) return;
      Navigator.of(context).pop();
      await widget.onReactivated();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _reactivating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: Container(
        width: 48,
        height: 48,
        alignment: Alignment.center,
        decoration:
            BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
        child: Icon(Icons.block, color: Colors.grey.shade500, size: 22),
      ),
      title: const Text('Boutique désactivée', textAlign: TextAlign.center),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text.rich(
            TextSpan(
              style: TextStyle(fontSize: 13.5, color: Colors.grey.shade600),
              children: [
                TextSpan(
                    text: '"${widget.store.name}" ',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, color: Colors.black87)),
                const TextSpan(
                  text:
                      'a été désactivée. Vous pouvez la réactiver vous-même, sauf si vous occupez entre-temps un autre poste (propriétaire ou vendeur) ailleurs.',
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 12.5),
                textAlign: TextAlign.center),
          ],
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Fermer')),
        FilledButton(
          onPressed: _reactivating ? null : _reactivate,
          child: Text(_reactivating ? 'Réactivation...' : 'Réactiver'),
        ),
      ],
    );
  }
}
