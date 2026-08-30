import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/data/guinee_regions.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/icon_badge.dart';
import '../../account/data/stores_api.dart';
import '../data/employee_models.dart';
import '../data/employees_api.dart';
import '../data/settings_models.dart';
import '../data/subscription_payments_api.dart';
import 'products/image_picker_field.dart';
import 'settings/subscription_plans_page.dart';

/// Miroir de SettingsPage.jsx — réservé au Owner (déjà vérifié côté
/// serveur par requireRole('OWNER') sur toutes les routes /stores/* ici
/// utilisées). Regroupée en sections thématiques, chaque section gérant
/// son propre chargement/enregistrement — exactement comme les composants
/// React importés séparément côté web.
class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: const [
          _SectionGroup(title: 'ABONNEMENT', children: [_SubscriptionSection()]),
          _SectionGroup(
            title: 'BOUTIQUE',
            description: 'Identité visuelle et catégorisation de votre activité.',
            children: [_StoreLogoSection(), _StoreInfoSection(), _StoreTypeSection()],
          ),
          _SectionGroup(
            title: 'PARTAGE & ACCÈS',
            description: 'Deux codes distincts, deux niveaux de confiance différents.',
            children: [
              _ShareCodeCard(
                shareCodeKind: _ShareCodeKind.supervision,
                title: 'Code de supervision',
                description: "Donne une vue en lecture seule à un propriétaire multi-boutiques — aucun droit d'action (pas de caisse, pas de gestion produit/équipe).",
              ),
              SizedBox(height: 12),
              _ShareCodeCard(
                shareCodeKind: _ShareCodeKind.supplier,
                title: 'Code fournisseur',
                description: 'Permet à une autre boutique de vous ajouter comme fournisseur — elle voit uniquement votre catalogue (nom, image, catégorie), jamais vos prix ni stocks.',
              ),
            ],
          ),
          _SectionGroup(
            title: 'VENTES',
            description: 'Règles applicables à la caisse et aux reçus.',
            children: [_VoidReturnSection(), _EditPriceSection(), _AddProductSection(), _ReceiptSettingsSection()],
          ),
          _SectionGroup(title: 'FACTURATION', children: [_BillingStub()]),
        ],
      ),
    );
  }
}

class _SectionGroup extends StatelessWidget {
  const _SectionGroup({required this.title, this.description, required this.children});

  final String title;
  final String? description;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade400, letterSpacing: 0.4)),
          if (description != null) ...[
            const SizedBox(height: 3),
            Text(description!, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500)),
          ],
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.margin});

  final Widget child;
  final EdgeInsets? margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: margin,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey.shade200)),
      clipBehavior: Clip.antiAlias,
      // Material(transparency) est nécessaire ici : les CheckboxListTile
      // utilisés dans certaines sections ont besoin d'un ancêtre Material
      // du bon type pour que leurs éclaboussures d'encre restent visibles
      // (avertissement Flutter sinon, uniquement en debug — release strippe
      // l'assertion mais l'effet visuel manquant, lui, resterait bien réel).
      child: Material(
        type: MaterialType.transparency,
        child: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle({required this.title, this.subtitle, this.icon, this.iconColor});

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final titleColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle!, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
        ],
      ],
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: icon == null
          ? titleColumn
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconBadge(icon: icon!, color: iconColor ?? AppColors.blue),
                const SizedBox(width: 12),
                Expanded(child: titleColumn),
              ],
            ),
    );
  }
}

// --- Abonnement -------------------------------------------------------

class _SubscriptionSection extends StatefulWidget {
  const _SubscriptionSection();

  @override
  State<_SubscriptionSection> createState() => _SubscriptionSectionState();
}

class _SubscriptionSectionState extends State<_SubscriptionSection> {
  PlanStatus? _plan;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final plan = await context.read<StoresApi>().getPlanStatus();
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _error = null;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: _SubscriptionSectionBody(
        plan: _plan,
        error: _error,
        onOpenPayment: () async {
          await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const SubscriptionPlansPage()),
          );
          // Le plan a pu changer pendant la visite de la page dédiée
          // (déclaration de paiement soumise) — toujours rafraîchir au
          // retour plutôt que de propager un résultat booléen à travers
          // une navigation complète.
          _load();
        },
      ),
    );
  }
}

class _SubscriptionSectionBody extends StatefulWidget {
  const _SubscriptionSectionBody({required this.plan, required this.error, required this.onOpenPayment});

  final PlanStatus? plan;
  final String? error;
  final VoidCallback onOpenPayment;

  @override
  State<_SubscriptionSectionBody> createState() => _SubscriptionSectionBodyState();
}

class _SubscriptionSectionBodyState extends State<_SubscriptionSectionBody> {
  SubscriptionRequest? _latestRequest;
  bool _loadingRequest = true;

  @override
  void initState() {
    super.initState();
    _loadRequest();
  }

  @override
  void didUpdateWidget(covariant _SubscriptionSectionBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.plan != oldWidget.plan) _loadRequest();
  }

  Future<void> _loadRequest() async {
    setState(() => _loadingRequest = true);
    try {
      final request = await context.read<SubscriptionPaymentsApi>().getMine();
      if (!mounted) return;
      setState(() {
        _latestRequest = request;
        _loadingRequest = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingRequest = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CardTitle(
          title: 'Abonnement',
          subtitle: 'Activation/renouvellement manuel possible en contactant le support, ou déclarez vous-même un paiement (Orange Money, Mobile Money, PayCard) — vérifié par la plateforme avant activation.',
          icon: Icons.workspace_premium_outlined,
          iconColor: AppColors.violet,
        ),
        if (widget.error != null) Text(widget.error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
        if (plan == null)
          Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
        else ...[
          _InfoRow(label: 'Plan actuel', value: plan.planName, valueColor: plan.isEffectivelyFreemium ? Colors.amber.shade800 : null),
          if (plan.planExpiresAt != null)
            _InfoRow(label: plan.isEffectivelyFreemium ? 'Expiré le' : 'Expire le', value: formatDateTime(plan.planExpiresAt)),
          _InfoRow(label: 'Utilisateurs / boutique', value: '${plan.maxUsersPerStore}'),
          _InfoRow(label: "Superviser d'autres boutiques", value: plan.allowsSupervision ? 'Oui' : 'Non'),
          _InfoRow(label: 'Fournisseurs', value: plan.allowsSuppliers ? 'Oui' : 'Non'),
          _InfoRow(label: "Commandes d'achat (PREMIUM)", value: plan.allowsPurchaseOrders ? 'Oui' : 'Non'),
          if (plan.expired)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(
                'Votre abonnement ${plan.previousPlanName} a expiré — la boutique fonctionne actuellement avec le plan ${plan.planName}.',
                style: TextStyle(fontSize: 12, color: Colors.amber.shade800),
              ),
            ),
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.only(top: 12),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade100))),
            child: _loadingRequest
                ? const SizedBox.shrink()
                : (_latestRequest?.status == 'PENDING')
                    ? Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.blue.shade100)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Demande en attente de vérification', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                            const SizedBox(height: 3),
                            Text(
                              '${_latestRequest!.planName} — ${kPaymentMethodLabels[_latestRequest!.paymentMethod] ?? _latestRequest!.paymentMethod} — ${formatGNF(_latestRequest!.amountDeclared)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            Text('Référence : ${_latestRequest!.transactionReference}', style: TextStyle(fontSize: 11.5, color: Colors.blue.shade700)),
                            Text('Soumise le ${formatDateTime(_latestRequest!.createdAt)}', style: TextStyle(fontSize: 11.5, color: Colors.blue.shade700)),
                          ],
                        ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_latestRequest?.status == 'REJECTED')
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                              child: Text(
                                'Votre dernière demande (${_latestRequest!.planName}) a été refusée${_latestRequest!.rejectionReason != null ? " : ${_latestRequest!.rejectionReason}" : ""}. Vous pouvez en soumettre une nouvelle.',
                                style: const TextStyle(color: Colors.red, fontSize: 12),
                              ),
                            ),
                          FilledButton(
                            onPressed: widget.onOpenPayment,
                            child: Text(plan.isEffectivelyFreemium ? "S'abonner" : 'Renouveler / changer de plan'),
                          ),
                        ],
                      ),
          ),
        ],
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500))),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: valueColor)),
        ],
      ),
    );
  }
}

// --- Logo de la boutique ------------------------------------------------

class _StoreLogoSection extends StatefulWidget {
  const _StoreLogoSection();

  @override
  State<_StoreLogoSection> createState() => _StoreLogoSectionState();
}

class _StoreLogoSectionState extends State<_StoreLogoSection> {
  String? _logoUrl;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final logoUrl = await context.read<StoresApi>().getLogo();
      if (!mounted) return;
      setState(() {
        _logoUrl = logoUrl;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _save() async {
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      final saved = await context.read<StoresApi>().updateLogo(_logoUrl);
      if (!mounted) return;
      setState(() {
        _logoUrl = saved;
        _success = 'Logo enregistré.';
      });
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _success = null);
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Logo de la boutique',
            subtitle: 'Collez un lien existant, ou envoyez directement un fichier depuis votre appareil.',
            icon: Icons.storefront_outlined,
            iconColor: AppColors.blue,
          ),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            ImagePickerField(
              imageUrl: _logoUrl,
              uploadContext: 'stores/logos',
              onChanged: (url) => setState(() => _logoUrl = url),
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
          ],
        ],
      ),
    );
  }
}

// --- Informations générales de la boutique -------------------------------

const _kOtherCity = '__AUTRE__';

/// Miroir de StoreInfoSection.jsx — tout modifiable après création SAUF le
/// type de boutique (section à part juste en dessous, définitif une fois
/// choisi — règle déjà établie séparément). Même patron de sélection
/// pays/région/ville en cascade que MyStorePage.dart, pour rester cohérent
/// visuellement et fonctionnellement.
class _StoreInfoSection extends StatefulWidget {
  const _StoreInfoSection();

  @override
  State<_StoreInfoSection> createState() => _StoreInfoSectionState();
}

class _StoreInfoSectionState extends State<_StoreInfoSection> {
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _freeRegionController = TextEditingController();
  final _freeCityController = TextEditingController();
  final _otherCityController = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;

  String _country = 'Guinée';
  String? _guineeRegion;
  String? _cityChoice;

  bool get _isGuinee => _country == 'Guinée';
  List<String> get _citiesForRegion => _isGuinee && _guineeRegion != null ? (kGuineeRegions[_guineeRegion!] ?? []) : [];

  @override
  void initState() {
    super.initState();
    _load();
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

  Future<void> _load() async {
    try {
      final info = await context.read<StoresApi>().getStoreInfo();
      if (!mounted) return;
      _applyInfo(info);
      setState(() => _loading = false);
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  void _applyInfo(StoreInfo info) {
    _nameController.text = info.name;
    _addressController.text = info.address;
    _phoneController.text = info.phone;
    _country = info.country.isEmpty ? 'Guinée' : info.country;
    if (_isGuinee) {
      _guineeRegion = info.region.isEmpty ? null : info.region;
      final known = _guineeRegion != null ? (kGuineeRegions[_guineeRegion!] ?? []) : <String>[];
      // Une ville déjà enregistrée qui ne fait pas partie du référentiel
      // (saisie via "Autre..." à l'époque) doit rester visible et
      // modifiable, jamais silencieusement vidée.
      if (info.city.isNotEmpty && !known.contains(info.city)) {
        _cityChoice = _kOtherCity;
        _otherCityController.text = info.city;
      } else {
        _cityChoice = info.city.isEmpty ? null : info.city;
      }
    } else {
      _freeRegionController.text = info.region;
      _freeCityController.text = info.city;
    }
  }

  void _updateCountry(String? value) {
    if (value == null) return;
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

  String _resolvedCity() {
    if (!_isGuinee) return _freeCityController.text.trim();
    if (_cityChoice == _kOtherCity) return _otherCityController.text.trim();
    return _cityChoice ?? '';
  }

  String _resolvedRegion() => _isGuinee ? (_guineeRegion ?? '') : _freeRegionController.text.trim();

  Future<void> _save() async {
    setState(() {
      _error = null;
      _success = null;
      _saving = true;
    });
    try {
      final saved = await context.read<StoresApi>().updateStoreInfo(StoreInfo(
            name: _nameController.text.trim(),
            address: _addressController.text.trim(),
            phone: _phoneController.text.trim(),
            region: _resolvedRegion(),
            city: _resolvedCity(),
            country: _country,
          ));
      if (!mounted) return;
      _applyInfo(saved);
      setState(() => _success = 'Informations enregistrées.');
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _success = null);
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Informations générales',
            subtitle: 'Nom, coordonnées et localisation de votre boutique — modifiables à tout moment.',
            icon: Icons.storefront_outlined,
            iconColor: AppColors.blue,
          ),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Nom de la boutique', isDense: true),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Numéro de la boutique', isDense: true),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _country,
              decoration: const InputDecoration(labelText: 'Pays', isDense: true),
              items: [for (final c in kCountries) DropdownMenuItem(value: c, child: Text(c))],
              onChanged: _updateCountry,
            ),
            const SizedBox(height: 12),
            Text('Région administrative', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            if (_isGuinee)
              DropdownButtonFormField<String>(
                initialValue: _guineeRegion,
                decoration: const InputDecoration(isDense: true),
                hint: const Text('Choisir une région'),
                items: [for (final r in kGuineeRegionNames) DropdownMenuItem(value: r, child: Text(r))],
                onChanged: _updateGuineeRegion,
              )
            else
              TextField(
                controller: _freeRegionController,
                decoration: const InputDecoration(hintText: 'Région / province', isDense: true),
              ),
            const SizedBox(height: 12),
            Text('Ville', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            if (_isGuinee)
              DropdownButtonFormField<String>(
                initialValue: _cityChoice,
                decoration: const InputDecoration(isDense: true),
                hint: Text(_guineeRegion != null ? 'Choisir une ville' : 'Choisissez une région d\'abord'),
                items: [
                  for (final city in _citiesForRegion) DropdownMenuItem(value: city, child: Text(city)),
                  const DropdownMenuItem(value: _kOtherCity, child: Text('Autre...')),
                ],
                onChanged: _guineeRegion == null ? null : (value) => setState(() => _cityChoice = value),
              )
            else
              TextField(
                controller: _freeCityController,
                decoration: const InputDecoration(hintText: 'Ville', isDense: true),
              ),
            if (_isGuinee && _cityChoice == _kOtherCity) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _otherCityController,
                decoration: const InputDecoration(labelText: 'Précisez la ville', isDense: true),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(labelText: 'Adresse (quartier)', hintText: 'Ex : Quartier Timbo, non loin du marché central', isDense: true),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
          ],
        ],
      ),
    );
  }
}

// --- Type de boutique -----------------------------------------------------

class _StoreTypeSection extends StatefulWidget {
  const _StoreTypeSection();

  @override
  State<_StoreTypeSection> createState() => _StoreTypeSectionState();
}

class _StoreTypeSectionState extends State<_StoreTypeSection> {
  int? _storeTypeId;
  String? _storeTypeLabel;
  List<StoreTypeOption> _allTypes = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  int? _selectedId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final storesApi = context.read<StoresApi>();
      final results = await Future.wait([storesApi.getStoreType(), storesApi.listStoreTypes()]);
      if (!mounted) return;
      final storeType = results[0] as (int?, String?);
      setState(() {
        _storeTypeId = storeType.$1;
        _storeTypeLabel = storeType.$2;
        _allTypes = results[1] as List<StoreTypeOption>;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _save() async {
    if (_selectedId == null) return;
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      final result = await context.read<StoresApi>().adoptStoreType(_selectedId!);
      if (!mounted) return;
      final categoriesAdded = result['categoriesAdded'] as int? ?? 0;
      setState(() {
        _storeTypeId = result['storeTypeId'] as int?;
        _storeTypeLabel = result['storeTypeLabel'] as String?;
        _success = categoriesAdded > 0
            ? 'Type "$_storeTypeLabel" enregistré — $categoriesAdded catégorie(s) de produits ajoutée(s).'
            : 'Type "$_storeTypeLabel" enregistré — aucune nouvelle catégorie à ajouter, tout existait déjà.';
      });
      Future.delayed(const Duration(seconds: 8), () {
        if (mounted) setState(() => _success = null);
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Type de boutique',
            subtitle: "Détermine les catégories de produits suggérées. Une boutique ne peut avoir qu'un seul type — le choix est définitif une fois enregistré.",
            icon: Icons.category_outlined,
            iconColor: AppColors.amber,
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else if (_storeTypeId != null)
            Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 13, color: Colors.black87),
                children: [
                  const TextSpan(text: 'Type : '),
                  TextSpan(text: _storeTypeLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            )
          else ...[
            Text("Aucun type défini pour l'instant.", style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            const SizedBox(height: 10),
            DropdownButtonFormField<int>(
              initialValue: _selectedId,
              decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
              hint: const Text('Choisir un type...'),
              items: [for (final t in _allTypes) DropdownMenuItem(value: t.id, child: Text(t.label))],
              onChanged: (value) => setState(() => _selectedId = value),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: (_selectedId == null || _saving) ? null : _save,
              child: Text(_saving ? 'Enregistrement...' : 'Définir le type'),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Codes de partage (supervision / fournisseur) ------------------------

enum _ShareCodeKind { supervision, supplier }

class _ShareCodeCard extends StatefulWidget {
  const _ShareCodeCard({required this.shareCodeKind, required this.title, required this.description});

  final _ShareCodeKind shareCodeKind;
  final String title;
  final String description;

  @override
  State<_ShareCodeCard> createState() => _ShareCodeCardState();
}

class _ShareCodeCardState extends State<_ShareCodeCard> {
  String? _code;
  bool _loading = true;
  String? _error;
  bool _copied = false;
  bool _regenerating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final storesApi = context.read<StoresApi>();
      final code = widget.shareCodeKind == _ShareCodeKind.supervision
          ? await storesApi.getSupervisionCode()
          : await storesApi.getSupplierCode();
      if (!mounted) return;
      setState(() {
        _code = code;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _copy() async {
    if (_code == null) return;
    await Clipboard.setData(ClipboardData(text: _code!));
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  Future<void> _regenerate() async {
    final isSupervision = widget.shareCodeKind == _ShareCodeKind.supervision;
    final storesApi = context.read<StoresApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Régénérer le code ?'),
        content: Text(
          isSupervision
              ? "L'ancien ne pourra plus être utilisé pour ajouter de nouveaux superviseurs (ceux déjà ajoutés gardent leur accès)."
              : "L'ancien ne pourra plus être utilisé pour ajouter de nouveaux clients (ceux déjà ajoutés gardent leur accès à votre catalogue).",
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Régénérer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _regenerating = true);
    try {
      final newCode = isSupervision ? await storesApi.regenerateSupervisionCode() : await storesApi.regenerateSupplierCode();
      if (!mounted) return;
      setState(() => _code = newCode);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _regenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardTitle(
            title: widget.title,
            subtitle: widget.description,
            icon: widget.shareCodeKind == _ShareCodeKind.supervision ? Icons.visibility_outlined : Icons.local_shipping_outlined,
            iconColor: widget.shareCodeKind == _ShareCodeKind.supervision ? AppColors.blue : AppColors.teal,
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
                    child: Text(_code ?? '—', style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600, fontSize: 13.5)),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(onPressed: _copy, child: Text(_copied ? 'Copié !' : 'Copier', style: const TextStyle(fontSize: 12))),
              ],
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _regenerating ? null : _regenerate,
              child: Text(
                _regenerating ? 'Régénération...' : 'Régénérer le code',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade400),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Autorisation d'annulation/retour de vente par un vendeur ------------

class _VoidReturnSection extends StatefulWidget {
  const _VoidReturnSection();

  @override
  State<_VoidReturnSection> createState() => _VoidReturnSectionState();
}

class _VoidReturnSectionState extends State<_VoidReturnSection> {
  bool _allowAllSellers = false;
  List<Employee> _sellers = [];
  bool _loading = true;
  String? _error;
  bool _savingAll = false;
  int? _savingSellerId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final storesApi = context.read<StoresApi>();
      final employeesApi = context.read<EmployeesApi>();
      final results = await Future.wait([storesApi.getVoidReturnSettings(), employeesApi.list()]);
      if (!mounted) return;
      setState(() {
        _allowAllSellers = results[0] as bool;
        _sellers = (results[1] as List<Employee>).where((e) => e.roleCode == 'SELLER').toList();
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleAll(bool value) async {
    setState(() => _savingAll = true);
    try {
      final result = await context.read<StoresApi>().updateVoidReturnSettings(value);
      if (!mounted) return;
      setState(() => _allowAllSellers = result);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingAll = false);
    }
  }

  Future<void> _toggleSeller(Employee seller, bool value) async {
    setState(() => _savingSellerId = seller.userId);
    try {
      await context.read<EmployeesApi>().updateVoidReturnPermission(seller.userId, value);
      if (!mounted) return;
      setState(() {
        _sellers = _sellers
            .map((s) => s.userId == seller.userId ? s.copyWith(canVoidReturn: value) : s)
            .toList();
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingSellerId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Annulation / retour de vente par un vendeur',
            subtitle: 'Par défaut, seul vous pouvez annuler ou retourner une vente. Vous pouvez autoriser vos vendeurs à le faire eux-mêmes, uniquement sur leurs propres ventes.',
            icon: Icons.assignment_return_outlined,
            iconColor: AppColors.rose,
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            CheckboxListTile(
              value: _allowAllSellers,
              onChanged: _savingAll ? null : (value) => _toggleAll(value ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Autoriser tous les vendeurs', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
            if (_sellers.isEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text("Aucun vendeur dans l'équipe pour l'instant.", style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
              )
            else
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Column(
                  children: [
                    for (final seller in _sellers)
                      CheckboxListTile(
                        value: _allowAllSellers || seller.canVoidReturn,
                        onChanged: (_allowAllSellers || _savingSellerId == seller.userId) ? null : (value) => _toggleSeller(seller, value ?? false),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                        title: Text(seller.fullName, style: TextStyle(fontSize: 13, color: _allowAllSellers ? Colors.grey.shade400 : Colors.black87)),
                      ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// Miroir exact de _VoidReturnSection ci-dessus, pour le prix modifiable à
/// la Caisse (§39_prix_editable_vente.sql, décidé en conversation).
class _EditPriceSection extends StatefulWidget {
  const _EditPriceSection();

  @override
  State<_EditPriceSection> createState() => _EditPriceSectionState();
}

class _EditPriceSectionState extends State<_EditPriceSection> {
  bool _allowAllSellers = false;
  List<Employee> _sellers = [];
  bool _loading = true;
  String? _error;
  bool _savingAll = false;
  int? _savingSellerId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final storesApi = context.read<StoresApi>();
      final employeesApi = context.read<EmployeesApi>();
      final results = await Future.wait([storesApi.getEditPriceSettings(), employeesApi.list()]);
      if (!mounted) return;
      setState(() {
        _allowAllSellers = results[0] as bool;
        _sellers = (results[1] as List<Employee>).where((e) => e.roleCode == 'SELLER').toList();
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleAll(bool value) async {
    setState(() => _savingAll = true);
    try {
      final result = await context.read<StoresApi>().updateEditPriceSettings(value);
      if (!mounted) return;
      setState(() => _allowAllSellers = result);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingAll = false);
    }
  }

  Future<void> _toggleSeller(Employee seller, bool value) async {
    setState(() => _savingSellerId = seller.userId);
    try {
      await context.read<EmployeesApi>().updateEditPricePermission(seller.userId, value);
      if (!mounted) return;
      setState(() {
        _sellers = _sellers
            .map((s) => s.userId == seller.userId ? s.copyWith(canEditPrice: value) : s)
            .toList();
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingSellerId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Prix de vente modifiable par un vendeur',
            subtitle: 'Par défaut, seul vous pouvez modifier le prix à la Caisse. Vous pouvez autoriser vos vendeurs à négocier un prix avec le client — jamais en dessous du prix normalement appliqué.',
            icon: Icons.sell_outlined,
            iconColor: AppColors.teal,
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            CheckboxListTile(
              value: _allowAllSellers,
              onChanged: _savingAll ? null : (value) => _toggleAll(value ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Autoriser tous les vendeurs', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
            if (_sellers.isEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text("Aucun vendeur dans l'équipe pour l'instant.", style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
              )
            else
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Column(
                  children: [
                    for (final seller in _sellers)
                      CheckboxListTile(
                        value: _allowAllSellers || seller.canEditPrice,
                        onChanged: (_allowAllSellers || _savingSellerId == seller.userId) ? null : (value) => _toggleSeller(seller, value ?? false),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                        title: Text(seller.fullName, style: TextStyle(fontSize: 13, color: _allowAllSellers ? Colors.grey.shade400 : Colors.black87)),
                      ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

/// Miroir exact de _EditPriceSection ci-dessus, pour la création de
/// produit par un vendeur (§40_autorisation_ajout_produit.sql, décidé en
/// conversation) — couvre UNIQUEMENT la création ; modifier/désactiver un
/// produit existant reste strictement réservé au Owner (voir
/// products/product_detail_sheet.dart).
class _AddProductSection extends StatefulWidget {
  const _AddProductSection();

  @override
  State<_AddProductSection> createState() => _AddProductSectionState();
}

class _AddProductSectionState extends State<_AddProductSection> {
  bool _allowAllSellers = false;
  List<Employee> _sellers = [];
  bool _loading = true;
  String? _error;
  bool _savingAll = false;
  int? _savingSellerId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final storesApi = context.read<StoresApi>();
      final employeesApi = context.read<EmployeesApi>();
      final results = await Future.wait([storesApi.getAddProductSettings(), employeesApi.list()]);
      if (!mounted) return;
      setState(() {
        _allowAllSellers = results[0] as bool;
        _sellers = (results[1] as List<Employee>).where((e) => e.roleCode == 'SELLER').toList();
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _toggleAll(bool value) async {
    setState(() => _savingAll = true);
    try {
      final result = await context.read<StoresApi>().updateAddProductSettings(value);
      if (!mounted) return;
      setState(() => _allowAllSellers = result);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingAll = false);
    }
  }

  Future<void> _toggleSeller(Employee seller, bool value) async {
    setState(() => _savingSellerId = seller.userId);
    try {
      await context.read<EmployeesApi>().updateAddProductPermission(seller.userId, value);
      if (!mounted) return;
      setState(() {
        _sellers = _sellers
            .map((s) => s.userId == seller.userId ? s.copyWith(canAddProduct: value) : s)
            .toList();
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _savingSellerId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Création de produit par un vendeur',
            subtitle: 'Par défaut, seul vous pouvez ajouter un produit au catalogue. Vous pouvez autoriser vos vendeurs à créer eux-mêmes de nouveaux produits — modifier ou désactiver une fiche existante reste toujours réservé à vous seul.',
            icon: Icons.add_box_outlined,
            iconColor: AppColors.emerald,
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            CheckboxListTile(
              value: _allowAllSellers,
              onChanged: _savingAll ? null : (value) => _toggleAll(value ?? false),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Autoriser tous les vendeurs', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
            if (_sellers.isEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Text("Aucun vendeur dans l'équipe pour l'instant.", style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
              )
            else
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Column(
                  children: [
                    for (final seller in _sellers)
                      CheckboxListTile(
                        value: _allowAllSellers || seller.canAddProduct,
                        onChanged: (_allowAllSellers || _savingSellerId == seller.userId) ? null : (value) => _toggleSeller(seller, value ?? false),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                        title: Text(seller.fullName, style: TextStyle(fontSize: 13, color: _allowAllSellers ? Colors.grey.shade400 : Colors.black87)),
                      ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

// --- Personnalisation du reçu -------------------------------------------

class _ReceiptSettingsSection extends StatefulWidget {
  const _ReceiptSettingsSection();

  @override
  State<_ReceiptSettingsSection> createState() => _ReceiptSettingsSectionState();
}

class _ReceiptSettingsSectionState extends State<_ReceiptSettingsSection> {
  ReceiptSettings _form = const ReceiptSettings(headerMessage: '', footerMessage: 'Merci de votre visite !', showAddress: false, showPhone: false, showSellerName: false);
  StoreContactInfo? _store;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  late final TextEditingController _headerController;
  late final TextEditingController _footerController;

  @override
  void initState() {
    super.initState();
    _headerController = TextEditingController();
    _footerController = TextEditingController(text: _form.footerMessage);
    _load();
  }

  @override
  void dispose() {
    _headerController.dispose();
    _footerController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final result = await context.read<StoresApi>().getReceiptSettings();
      if (!mounted) return;
      setState(() {
        _form = result.$1;
        _store = result.$2;
        _headerController.text = _form.headerMessage;
        _footerController.text = _form.footerMessage;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (mounted) {
        setState(() {
          _error = err.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _save() async {
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      final saved = await context.read<StoresApi>().updateReceiptSettings(_form.copyWith(headerMessage: _headerController.text, footerMessage: _footerController.text));
      if (!mounted) return;
      setState(() {
        _form = saved;
        _success = 'Réglages du reçu enregistrés.';
      });
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _success = null);
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _buildPreview() {
    final lines = <String>['═══════════════════'];
    if (_store?.name.isNotEmpty ?? false) lines.add(_store!.name);
    if (_form.showAddress && (_store?.address?.isNotEmpty ?? false)) lines.add(_store!.address!);
    if (_form.showPhone && (_store?.phone?.isNotEmpty ?? false)) lines.add(_store!.phone!);
    if (_headerController.text.isNotEmpty) lines.add(_headerController.text);
    lines.addAll(['═══════════════════', 'REÇU DE VENTE', '═══════════════════', '']);
    lines.add('Commande: ORD-2026-000123');
    lines.add('Date: 03/08/2026 15:00:00');
    if (_form.showSellerName) lines.add('Vendeur: nom complet');
    lines.addAll(['', '───────────────────', 'ARTICLES', '───────────────────']);
    lines.add('Produit exemple');
    lines.add('  2 x ${formatGNF(5000)} = ${formatGNF(10000)}');
    lines.add('───────────────────');
    lines.add('Sous-total:    ${formatGNF(10000)}');
    lines.add('Réduction:    -${formatGNF(0)}');
    lines.add('Taxes:        +${formatGNF(0)}');
    lines.add('═══════════════════');
    lines.add('TOTAL:         ${formatGNF(10000)}');
    lines.add('═══════════════════');
    lines.add('Paiement:      TOTAL');
    lines.addAll(['───────────────────', '']);
    lines.add(_footerController.text.isNotEmpty ? _footerController.text : 'Merci de votre visite !');
    return lines.join('\n');
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Personnaliser le reçu',
            subtitle: "Message d'en-tête/pied de page et informations affichées sur le reçu — l'aperçu se met à jour pendant que vous modifiez les réglages.",
            icon: Icons.receipt_long_outlined,
            iconColor: AppColors.emerald,
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
              child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...', style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            TextField(
              controller: _headerController,
              maxLength: 200,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: "Message d'en-tête (optionnel)", hintText: 'Ex : Bienvenue chez nous !', border: OutlineInputBorder(), isDense: true),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _footerController,
              maxLength: 200,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Message de pied de page', hintText: 'Merci de votre visite !', border: OutlineInputBorder(), isDense: true),
            ),
            CheckboxListTile(
              value: _form.showAddress,
              onChanged: (value) => setState(() => _form = _form.copyWith(showAddress: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text("Afficher l'adresse de la boutique", style: TextStyle(fontSize: 13)),
            ),
            CheckboxListTile(
              value: _form.showPhone,
              onChanged: (value) => setState(() => _form = _form.copyWith(showPhone: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Afficher le numéro de téléphone', style: TextStyle(fontSize: 13)),
            ),
            CheckboxListTile(
              value: _form.showSellerName,
              onChanged: (value) => setState(() => _form = _form.copyWith(showSellerName: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Afficher le nom du vendeur', style: TextStyle(fontSize: 13)),
            ),
            const SizedBox(height: 8),
            FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
            const SizedBox(height: 16),
            Text('APERÇU', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.3)),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
              child: Text(_buildPreview(), style: const TextStyle(fontFamily: 'monospace', fontSize: 11, height: 1.4)),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Facturation (stub) ---------------------------------------------------

class _BillingStub extends StatelessWidget {
  const _BillingStub();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.payments_outlined, color: Colors.grey.shade300, size: 26),
            const SizedBox(height: 8),
            Text('Reste à implémenter.', style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}
