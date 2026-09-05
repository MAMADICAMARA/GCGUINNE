import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/data/guinee_regions.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/share_file.dart';
import '../../../core/widgets/icon_badge.dart';
import '../../../state/auth_state.dart';
import '../../../state/update_state.dart';
import '../../account/data/stores_api.dart';
import '../../app_update/data/app_update_api.dart';
import '../data/orders_api.dart';
import '../data/settings_models.dart';
import '../data/subscription_payments_api.dart';
import 'products/image_picker_field.dart';
import 'settings/authorization_sheet.dart';
import 'settings/subscription_plans_page.dart';

/// Miroir de SettingsPage.jsx — réservé au Owner (déjà vérifié côté
/// serveur par requireRole('OWNER') sur toutes les routes /stores/* ici
/// utilisées). Regroupée en sections thématiques, chaque section gérant
/// son propre chargement/enregistrement — exactement comme les composants
/// React importés séparément côté web.
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  @override
  void initState() {
    super.initState();
    // §8 du cahier des charges "Système de notification de mise à jour" :
    // vérifier aussi à chaque ouverture des Paramètres, pas seulement au
    // lancement de l'app (main.dart) — échec silencieux, jamais bloquant.
    unawaited(context.read<UpdateState>().check(context.read<AppUpdateApi>()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _SettingsEntryCard(
            icon: Icons.workspace_premium_outlined,
            iconColor: Colors.amber.shade700,
            title: 'Abonnement',
            description: 'Statut de votre plan, et déclaration de paiement.',
            onTap: () => _showSettingsSheet(context,
                title: 'Abonnement',
                builder: (context) => const _SubscriptionSection(bare: true)),
          ),
          const SizedBox(height: 10),
          _SettingsEntryCard(
            icon: Icons.storefront_outlined,
            iconColor: AppColors.blue,
            title: 'Logo de la boutique',
            description:
                "L'image affichée sur vos reçus et dans l'application.",
            onTap: () => _showSettingsSheet(context,
                title: 'Logo de la boutique',
                builder: (context) => const _StoreLogoSection(bare: true)),
          ),
          const SizedBox(height: 10),
          _SettingsEntryCard(
            icon: Icons.store_outlined,
            iconColor: AppColors.blue,
            title: 'Informations générales',
            description: 'Nom, coordonnées et localisation de votre boutique.',
            onTap: () => _showSettingsSheet(context,
                title: 'Informations générales',
                builder: (context) => const _StoreInfoSection(bare: true)),
          ),
          const SizedBox(height: 10),
          _SettingsEntryCard(
            icon: Icons.category_outlined,
            iconColor: AppColors.blue,
            title: 'Type de boutique',
            description: 'Détermine les catégories de produits suggérées.',
            onTap: () => _showSettingsSheet(context,
                title: 'Type de boutique',
                builder: (context) => const _StoreTypeSection(bare: true)),
          ),
          const SizedBox(height: 10),
          _SettingsEntryCard(
            icon: Icons.share_outlined,
            iconColor: AppColors.violet,
            title: 'Partage & accès',
            description:
                'Codes de supervision, fournisseur et transfert de stock.',
            onTap: () => _showSettingsSheet(
              context,
              title: 'Partage & accès',
              builder: (context) => const Column(
                children: [
                  _ShareCodeCard(
                    shareCodeKind: _ShareCodeKind.supervision,
                    title: 'Code de supervision',
                    description:
                        "Donne une vue en lecture seule à un propriétaire multi-boutiques — aucun droit d'action (pas de caisse, pas de gestion produit/équipe).",
                  ),
                  SizedBox(height: 16),
                  _ShareCodeCard(
                    shareCodeKind: _ShareCodeKind.supplier,
                    title: 'Code fournisseur',
                    description:
                        'Permet à une autre boutique de vous ajouter comme fournisseur — elle voit uniquement votre catalogue (nom, image, catégorie), jamais vos prix ni stocks.',
                  ),
                  SizedBox(height: 16),
                  _ShareCodeCard(
                    shareCodeKind: _ShareCodeKind.transfer,
                    title: 'Code de transfert de stock',
                    description:
                        'À transmettre à une boutique du même type pour qu\'elle puisse vous envoyer du stock.',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          const AuthorizationCard(),
          const SizedBox(height: 10),
          _SettingsEntryCard(
            icon: Icons.receipt_long_outlined,
            iconColor: AppColors.emerald,
            title: 'Personnaliser le reçu',
            description:
                "Message d'en-tête/pied de page et informations affichées.",
            onTap: () => _showSettingsSheet(context,
                title: 'Personnaliser le reçu',
                builder: (context) =>
                    const _ReceiptSettingsSection(bare: true)),
          ),
          const SizedBox(height: 10),
          _SettingsEntryCard(
            icon: Icons.description_outlined,
            iconColor: Colors.grey.shade600,
            title: 'Facturation',
            description:
                'Taxe par défaut, informations légales, export comptable.',
            onTap: () => _showSettingsSheet(
              context,
              title: 'Facturation',
              builder: (context) => const Column(
                children: [
                  _BillingSettingsSection(),
                  SizedBox(height: 16),
                  _OrdersExportSection(),
                ],
              ),
            ),
          ),

          // Zone dangereuse — désactivation volontaire de la boutique
          // (§53_desactivation_boutique.sql, décidé en conversation). Reste
          // à part et toujours visible (décision explicite de
          // l'utilisateur), jamais cachée derrière un clic.
          const Padding(
            padding: EdgeInsets.only(top: 20, bottom: 12),
            child: Row(
              children: [
                Icon(Icons.power_settings_new, size: 16, color: Colors.red),
                SizedBox(width: 8),
                Text('Zone dangereuse',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ],
            ),
          ),
          const _DangerZoneSection(),
        ],
      ),
    );
  }
}

/// Ligne résumé cliquable qui ouvre le contenu complet d'une section dans un
/// sheet (§ décidé en conversation, page Paramètres trop longue à parcourir
/// pour un public peu à l'aise avec le numérique) — extrait du markup exact
/// de AuthorizationCard (authorization_sheet.dart), généralisé pour toutes
/// les sections. Miroir de SettingsEntryCard.jsx côté web.
class _SettingsEntryCard extends StatelessWidget {
  const _SettingsEntryCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade200)),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(description,
                        style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade500,
                            height: 1.3)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: Colors.grey.shade300),
            ],
          ),
        ),
      ),
    );
  }
}

/// Squelette de sheet générique pour les sections de Paramètres (§ décidé
/// en conversation) — extrait du markup exact de _AuthorizationSheet
/// (authorization_sheet.dart) : DraggableScrollableSheet + SafeArea(top:
/// false) + en-tête titre/fermer + contenu scrollable, pour que chaque
/// nouvelle section s'ouvre dans le même habillage.
Future<void> _showSettingsSheet(
  BuildContext context, {
  required String title,
  required WidgetBuilder builder,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => SafeArea(
        top: false,
        child: Container(
          decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16)),
                    ),
                    IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  children: [builder(context)],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.margin, this.bare = false});

  final Widget child;
  final EdgeInsets? margin;

  /// true quand la section est affichée à l'intérieur d'un sheet dédié
  /// (§ décidé en conversation, page Paramètres trop longue) plutôt que sur
  /// la page elle-même : le sheet fournit déjà son propre conteneur, donc
  /// pas besoin du second encart blanc à bordure ici.
  final bool bare;

  @override
  Widget build(BuildContext context) {
    // Material(transparency) reste nécessaire même en mode bare : les
    // CheckboxListTile utilisés dans certaines sections ont besoin d'un
    // ancêtre Material du bon type pour que leurs éclaboussures d'encre
    // restent visibles (avertissement Flutter sinon, uniquement en debug —
    // release strippe l'assertion mais l'effet visuel manquant, lui,
    // resterait bien réel).
    if (bare) {
      return Material(type: MaterialType.transparency, child: child);
    }
    return Container(
      width: double.infinity,
      margin: margin,
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.grey.shade200)),
      clipBehavior: Clip.antiAlias,
      child: Material(
        type: MaterialType.transparency,
        child: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle(
      {required this.title, this.subtitle, this.icon, this.iconColor});

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final titleColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style:
                const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(subtitle!,
              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
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
  const _SubscriptionSection({this.bare = false});

  final bool bare;

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
      bare: widget.bare,
      child: _SubscriptionSectionBody(
        bare: widget.bare,
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
  const _SubscriptionSectionBody(
      {required this.plan,
      required this.error,
      required this.onOpenPayment,
      this.bare = false});

  final PlanStatus? plan;
  final String? error;
  final VoidCallback onOpenPayment;
  final bool bare;

  @override
  State<_SubscriptionSectionBody> createState() =>
      _SubscriptionSectionBodyState();
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
        if (!widget.bare)
          const _CardTitle(
            title: 'Abonnement',
            subtitle:
                'Activation/renouvellement manuel possible en contactant le support, ou déclarez vous-même un paiement (Orange Money, Mobile Money, PayCard) — vérifié par la plateforme avant activation.',
            icon: Icons.workspace_premium_outlined,
            iconColor: AppColors.violet,
          ),
        if (widget.error != null)
          Text(widget.error!,
              style: const TextStyle(color: Colors.red, fontSize: 13)),
        if (plan == null)
          Text('Chargement...',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
        else ...[
          _InfoRow(
              label: 'Plan actuel',
              value: plan.planName,
              valueColor:
                  plan.isEffectivelyFreemium ? Colors.amber.shade800 : null),
          if (plan.planExpiresAt != null)
            _InfoRow(
                label: plan.isEffectivelyFreemium ? 'Expiré le' : 'Expire le',
                value: formatDateTime(plan.planExpiresAt)),
          _InfoRow(
              label: 'Utilisateurs / boutique',
              value: '${plan.maxUsersPerStore}'),
          _InfoRow(
              label: "Superviser d'autres boutiques",
              value: plan.allowsSupervision ? 'Oui' : 'Non'),
          _InfoRow(
              label: 'Fournisseurs',
              value: plan.allowsSuppliers ? 'Oui' : 'Non'),
          _InfoRow(
              label: "Commandes d'achat (PREMIUM)",
              value: plan.allowsPurchaseOrders ? 'Oui' : 'Non'),
          if (plan.expired)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(
                'Votre abonnement ${plan.previousPlanName} a expiré — la boutique fonctionne actuellement avec le plan ${plan.planName}.',
                style: TextStyle(fontSize: 12, color: Colors.amber.shade800),
              ),
            ),
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.only(top: 12),
            decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.grey.shade100))),
            child: _loadingRequest
                ? const SizedBox.shrink()
                : (_latestRequest?.status == 'PENDING')
                    ? Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.blue.shade100)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Demande en attente de vérification',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12.5)),
                            const SizedBox(height: 3),
                            Text(
                              '${_latestRequest!.planName} — ${kPaymentMethodLabels[_latestRequest!.paymentMethod] ?? _latestRequest!.paymentMethod} — ${formatGNF(_latestRequest!.amountDeclared)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            Text(
                                'Référence : ${_latestRequest!.transactionReference}',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    color: Colors.blue.shade700)),
                            Text(
                                'Soumise le ${formatDateTime(_latestRequest!.createdAt)}',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    color: Colors.blue.shade700)),
                          ],
                        ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_latestRequest?.status == 'REJECTED')
                            Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                  color: Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(10)),
                              child: Text(
                                'Votre dernière demande (${_latestRequest!.planName}) a été refusée${_latestRequest!.rejectionReason != null ? " : ${_latestRequest!.rejectionReason}" : ""}. Vous pouvez en soumettre une nouvelle.',
                                style: const TextStyle(
                                    color: Colors.red, fontSize: 12),
                              ),
                            ),
                          FilledButton(
                            onPressed: widget.onOpenPayment,
                            child: Text(plan.isEffectivelyFreemium
                                ? "S'abonner"
                                : 'Renouveler / changer de plan'),
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
          Expanded(
              child: Text(label,
                  style:
                      TextStyle(fontSize: 12.5, color: Colors.grey.shade500))),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: valueColor)),
        ],
      ),
    );
  }
}

// --- Logo de la boutique ------------------------------------------------

class _StoreLogoSection extends StatefulWidget {
  const _StoreLogoSection({this.bare = false});

  final bool bare;

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
      bare: widget.bare,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!widget.bare)
            const _CardTitle(
              title: 'Logo de la boutique',
              subtitle:
                  'Collez un lien existant, ou envoyez directement un fichier depuis votre appareil.',
              icon: Icons.storefront_outlined,
              iconColor: AppColors.blue,
            ),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(_error!,
                  style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(_success!,
                  style:
                      TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            ImagePickerField(
              imageUrl: _logoUrl,
              uploadContext: 'stores/logos',
              onChanged: (url) => setState(() => _logoUrl = url),
            ),
            const SizedBox(height: 12),
            FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
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
  const _StoreInfoSection({this.bare = false});

  final bool bare;

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
  List<String> get _citiesForRegion => _isGuinee && _guineeRegion != null
      ? (kGuineeRegions[_guineeRegion!] ?? [])
      : [];

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
      final known = _guineeRegion != null
          ? (kGuineeRegions[_guineeRegion!] ?? [])
          : <String>[];
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

  String _resolvedRegion() =>
      _isGuinee ? (_guineeRegion ?? '') : _freeRegionController.text.trim();

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
      bare: widget.bare,
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!widget.bare)
            const _CardTitle(
              title: 'Informations générales',
              subtitle:
                  'Nom, coordonnées et localisation de votre boutique — modifiables à tout moment.',
              icon: Icons.storefront_outlined,
              iconColor: AppColors.blue,
            ),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(_error!,
                  style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(_success!,
                  style:
                      TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                  labelText: 'Nom de la boutique', isDense: true),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                  labelText: 'Numéro de la boutique', isDense: true),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _country,
              decoration:
                  const InputDecoration(labelText: 'Pays', isDense: true),
              items: [
                for (final c in kCountries)
                  DropdownMenuItem(value: c, child: Text(c))
              ],
              onChanged: _updateCountry,
            ),
            const SizedBox(height: 12),
            Text('Région administrative',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
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
              TextField(
                controller: _freeRegionController,
                decoration: const InputDecoration(
                    hintText: 'Région / province', isDense: true),
              ),
            const SizedBox(height: 12),
            Text('Ville',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
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
              TextField(
                controller: _freeCityController,
                decoration:
                    const InputDecoration(hintText: 'Ville', isDense: true),
              ),
            if (_isGuinee && _cityChoice == _kOtherCity) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _otherCityController,
                decoration: const InputDecoration(
                    labelText: 'Précisez la ville', isDense: true),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _addressController,
              decoration: const InputDecoration(
                  labelText: 'Adresse (quartier)',
                  hintText: 'Ex : Quartier Timbo, non loin du marché central',
                  isDense: true),
            ),
            const SizedBox(height: 14),
            FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
          ],
        ],
      ),
    );
  }
}

// --- Type de boutique -----------------------------------------------------

class _StoreTypeSection extends StatefulWidget {
  const _StoreTypeSection({this.bare = false});

  final bool bare;

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
      final results = await Future.wait(
          [storesApi.getStoreType(), storesApi.listStoreTypes()]);
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
      final result =
          await context.read<StoresApi>().adoptStoreType(_selectedId!);
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
      bare: widget.bare,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!widget.bare)
            const _CardTitle(
              title: 'Type de boutique',
              subtitle:
                  "Détermine les catégories de produits suggérées. Une boutique ne peut avoir qu'un seul type — le choix est définitif une fois enregistré.",
              icon: Icons.category_outlined,
              iconColor: AppColors.amber,
            ),
          if (_error != null)
            Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(_success!,
                  style:
                      TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else if (_storeTypeId != null)
            Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 13, color: Colors.black87),
                children: [
                  const TextSpan(text: 'Type : '),
                  TextSpan(
                      text: _storeTypeLabel,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            )
          else ...[
            Text("Aucun type défini pour l'instant.",
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            const SizedBox(height: 10),
            DropdownButtonFormField<int>(
              initialValue: _selectedId,
              decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  isDense: true,
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10)),
              hint: const Text('Choisir un type...'),
              items: [
                for (final t in _allTypes)
                  DropdownMenuItem(value: t.id, child: Text(t.label))
              ],
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

enum _ShareCodeKind { supervision, supplier, transfer }

class _ShareCodeCard extends StatefulWidget {
  const _ShareCodeCard(
      {required this.shareCodeKind,
      required this.title,
      required this.description});

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
      final String? code;
      switch (widget.shareCodeKind) {
        case _ShareCodeKind.supervision:
          code = await storesApi.getSupervisionCode();
          break;
        case _ShareCodeKind.supplier:
          code = await storesApi.getSupplierCode();
          break;
        case _ShareCodeKind.transfer:
          code = await storesApi.getTransferCode();
          break;
      }
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
    final storesApi = context.read<StoresApi>();
    final String warning;
    switch (widget.shareCodeKind) {
      case _ShareCodeKind.supervision:
        warning =
            "L'ancien ne pourra plus être utilisé pour ajouter de nouveaux superviseurs (ceux déjà ajoutés gardent leur accès).";
        break;
      case _ShareCodeKind.supplier:
        warning =
            "L'ancien ne pourra plus être utilisé pour ajouter de nouveaux clients (ceux déjà ajoutés gardent leur accès à votre catalogue).";
        break;
      case _ShareCodeKind.transfer:
        warning =
            "L'ancien ne pourra plus être utilisé pour recevoir de nouveaux transferts de stock.";
        break;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Régénérer le code ?'),
        content: Text(warning),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Annuler')),
          FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Régénérer')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _regenerating = true);
    try {
      final String newCode;
      switch (widget.shareCodeKind) {
        case _ShareCodeKind.supervision:
          newCode = await storesApi.regenerateSupervisionCode();
          break;
        case _ShareCodeKind.supplier:
          newCode = await storesApi.regenerateSupplierCode();
          break;
        case _ShareCodeKind.transfer:
          newCode = await storesApi.regenerateTransferCode();
          break;
      }
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
            icon: switch (widget.shareCodeKind) {
              _ShareCodeKind.supervision => Icons.visibility_outlined,
              _ShareCodeKind.supplier => Icons.local_shipping_outlined,
              _ShareCodeKind.transfer => Icons.swap_horiz_outlined,
            },
            iconColor: switch (widget.shareCodeKind) {
              _ShareCodeKind.supervision => AppColors.blue,
              _ShareCodeKind.supplier => AppColors.teal,
              _ShareCodeKind.transfer => AppColors.amber,
            },
          ),
          if (_error != null)
            Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_loading)
            Text('Chargement...',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade200)),
                    child: Text(_code ?? '—',
                        style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w600,
                            fontSize: 13.5)),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                    onPressed: _copy,
                    child: Text(_copied ? 'Copié !' : 'Copier',
                        style: const TextStyle(fontSize: 12))),
              ],
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: _regenerating ? null : _regenerate,
              child: Text(
                _regenerating ? 'Régénération...' : 'Régénérer le code',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.red.shade400),
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
  const _ReceiptSettingsSection({this.bare = false});

  final bool bare;

  @override
  State<_ReceiptSettingsSection> createState() =>
      _ReceiptSettingsSectionState();
}

class _ReceiptSettingsSectionState extends State<_ReceiptSettingsSection> {
  ReceiptSettings _form = const ReceiptSettings(
    headerMessage: '',
    footerMessage: 'Merci de votre visite !',
    showAddress: false,
    showPhone: false,
    showSellerName: false,
    showSignature: false,
    signatureLabel: 'Signature',
    invoiceTitle: 'FACTURE',
  );
  StoreContactInfo? _store;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  late final TextEditingController _headerController;
  late final TextEditingController _footerController;
  late final TextEditingController _signatureLabelController;
  late final TextEditingController _invoiceTitleController;

  @override
  void initState() {
    super.initState();
    _headerController = TextEditingController();
    _footerController = TextEditingController(text: _form.footerMessage);
    _signatureLabelController =
        TextEditingController(text: _form.signatureLabel);
    _invoiceTitleController = TextEditingController(text: _form.invoiceTitle);
    _load();
  }

  @override
  void dispose() {
    _headerController.dispose();
    _footerController.dispose();
    _signatureLabelController.dispose();
    _invoiceTitleController.dispose();
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
        _signatureLabelController.text = _form.signatureLabel;
        _invoiceTitleController.text = _form.invoiceTitle;
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
      final saved =
          await context.read<StoresApi>().updateReceiptSettings(_form.copyWith(
                headerMessage: _headerController.text,
                footerMessage: _footerController.text,
                signatureLabel: _signatureLabelController.text,
                invoiceTitle: _invoiceTitleController.text,
              ));
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
    if (_form.showAddress && (_store?.address?.isNotEmpty ?? false))
      lines.add(_store!.address!);
    if (_form.showPhone && (_store?.phone?.isNotEmpty ?? false))
      lines.add(_store!.phone!);
    if (_headerController.text.isNotEmpty) lines.add(_headerController.text);
    lines.addAll(
        ['═══════════════════', 'REÇU DE VENTE', '═══════════════════', '']);
    lines.add('Commande: ORD-2026-000123');
    lines.add('Date: 03/08/2026 15:00:00');
    if (_form.showSellerName) lines.add('Vendeur: nom complet');
    lines
        .addAll(['', '───────────────────', 'ARTICLES', '───────────────────']);
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
    lines.add(_footerController.text.isNotEmpty
        ? _footerController.text
        : 'Merci de votre visite !');
    return lines.join('\n');
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      bare: widget.bare,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!widget.bare)
            const _CardTitle(
              title: 'Personnaliser le reçu',
              subtitle:
                  "Message d'en-tête/pied de page et informations affichées sur le reçu — l'aperçu se met à jour pendant que vous modifiez les réglages.",
              icon: Icons.receipt_long_outlined,
              iconColor: AppColors.emerald,
            ),
          if (_error != null)
            Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          if (_success != null)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10)),
              child: Text(_success!,
                  style:
                      TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
            ),
          if (_loading)
            Text('Chargement...',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13))
          else ...[
            TextField(
              controller: _headerController,
              maxLength: 200,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                  labelText: "Message d'en-tête (optionnel)",
                  hintText: 'Ex : Bienvenue chez nous !',
                  border: OutlineInputBorder(),
                  isDense: true),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _footerController,
              maxLength: 200,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                  labelText: 'Message de pied de page',
                  hintText: 'Merci de votre visite !',
                  border: OutlineInputBorder(),
                  isDense: true),
            ),
            CheckboxListTile(
              value: _form.showAddress,
              onChanged: (value) => setState(
                  () => _form = _form.copyWith(showAddress: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text("Afficher l'adresse de la boutique",
                  style: TextStyle(fontSize: 13)),
            ),
            CheckboxListTile(
              value: _form.showPhone,
              onChanged: (value) => setState(
                  () => _form = _form.copyWith(showPhone: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Afficher le numéro de téléphone',
                  style: TextStyle(fontSize: 13)),
            ),
            CheckboxListTile(
              value: _form.showSellerName,
              onChanged: (value) => setState(
                  () => _form = _form.copyWith(showSellerName: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Afficher le nom du vendeur',
                  style: TextStyle(fontSize: 13)),
            ),
            const SizedBox(height: 14),
            Container(height: 1, color: Colors.grey.shade200),
            const SizedBox(height: 14),
            Text(
              "S'applique à la mise en page de la Facture PDF (bouton « Télécharger la facture "
              '(PDF) » après une vente).',
              style: TextStyle(
                  fontSize: 11.5, color: Colors.grey.shade500, height: 1.35),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _invoiceTitleController,
              maxLength: 40,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(
                  fontWeight: FontWeight.w800, letterSpacing: 0.4),
              decoration: const InputDecoration(
                labelText: 'Titre de la facture',
                hintText: 'FACTURE',
                helperText:
                    'Affiché en gros caractères gras en haut de la facture. Ex : « Vente accessoire ».',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 10),
            CheckboxListTile(
              value: _form.showSignature,
              onChanged: (value) => setState(
                  () => _form = _form.copyWith(showSignature: value ?? false)),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: const Text('Réserver un espace signature (facture)',
                  style: TextStyle(fontSize: 13)),
            ),
            if (_form.showSignature) ...[
              const SizedBox(height: 4),
              TextField(
                controller: _signatureLabelController,
                maxLength: 60,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                    labelText: 'Libellé de la signature',
                    hintText: 'Signature',
                    border: OutlineInputBorder(),
                    isDense: true),
              ),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 8),
            FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
            const SizedBox(height: 16),
            Text('APERÇU',
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade500,
                    letterSpacing: 0.3)),
            const SizedBox(height: 6),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade200)),
              child: Text(_buildPreview(),
                  style: const TextStyle(
                      fontFamily: 'monospace', fontSize: 11, height: 1.4)),
            ),
          ],
        ],
      ),
    );
  }
}

// --- Facturation (§42_facturation_boutique.sql) ---------------------------
// Miroir de BillingSettingsSection.jsx — même patron exact que
// _ReceiptSettingsSection juste au-dessus.

class _BillingSettingsSection extends StatefulWidget {
  const _BillingSettingsSection();

  @override
  State<_BillingSettingsSection> createState() =>
      _BillingSettingsSectionState();
}

class _BillingSettingsSectionState extends State<_BillingSettingsSection> {
  BillingSettings _form = const BillingSettings(
    defaultTaxPercent: 0,
    legalRccm: '',
    legalNif: '',
    legalTaxRegime: '',
    invoiceNumberingEnabled: false,
    invoicePrefix: 'FACT-',
  );
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  late final TextEditingController _taxController;
  late final TextEditingController _rccmController;
  late final TextEditingController _nifController;
  late final TextEditingController _taxRegimeController;
  late final TextEditingController _invoicePrefixController;

  @override
  void initState() {
    super.initState();
    _taxController =
        TextEditingController(text: _form.defaultTaxPercent.toString());
    _rccmController = TextEditingController();
    _nifController = TextEditingController();
    _taxRegimeController = TextEditingController();
    _invoicePrefixController = TextEditingController(text: _form.invoicePrefix);
    _load();
  }

  @override
  void dispose() {
    _taxController.dispose();
    _rccmController.dispose();
    _nifController.dispose();
    _taxRegimeController.dispose();
    _invoicePrefixController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final result = await context.read<StoresApi>().getBillingSettings();
      if (!mounted) return;
      setState(() {
        _form = result;
        _taxController.text = _formatTax(result.defaultTaxPercent);
        _rccmController.text = result.legalRccm;
        _nifController.text = result.legalNif;
        _taxRegimeController.text = result.legalTaxRegime;
        _invoicePrefixController.text = result.invoicePrefix;
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

  String _formatTax(num value) => value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toString();

  Future<void> _save() async {
    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      final taxValue =
          num.tryParse(_taxController.text.replaceAll(',', '.')) ?? 0;
      final saved =
          await context.read<StoresApi>().updateBillingSettings(_form.copyWith(
                defaultTaxPercent: taxValue,
                legalRccm: _rccmController.text,
                legalNif: _nifController.text,
                legalTaxRegime: _taxRegimeController.text,
                invoicePrefix: _invoicePrefixController.text,
              ));
      if (!mounted) return;
      setState(() {
        _form = saved;
        _taxController.text = _formatTax(saved.defaultTaxPercent);
        _rccmController.text = saved.legalRccm;
        _nifController.text = saved.legalNif;
        _taxRegimeController.text = saved.legalTaxRegime;
        _invoicePrefixController.text = saved.invoicePrefix;
        _success = 'Réglages de facturation enregistrés.';
      });
      // Reflète immédiatement le nouveau taux dans AuthState.activeStore —
      // sans ça, la Caisse repartirait de l'ancien taux jusqu'au prochain
      // changement de boutique. Même principe que BillingSettingsSection.jsx.
      context
          .read<AuthState>()
          .updateActiveStoreDefaultTaxPercent(saved.defaultTaxPercent);
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
    if (_loading) {
      return const _Card(
          child: Text('Chargement...',
              style: TextStyle(color: Colors.grey, fontSize: 13)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(_error!,
                style: const TextStyle(color: Colors.red, fontSize: 12.5)),
          ),
        if (_success != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(10)),
            child: Text(_success!,
                style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
          ),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _CardTitle(
                title: 'Taxe par défaut',
                subtitle:
                    "Taux appliqué automatiquement à l'ouverture d'une nouvelle vente en Caisse — toujours modifiable au cas par cas pour une vente précise.",
                icon: Icons.percent_outlined,
                iconColor: AppColors.blue,
              ),
              SizedBox(
                width: 160,
                child: TextField(
                  controller: _taxController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Taux de taxe par défaut',
                    suffixText: '%',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _CardTitle(
                title: 'Informations légales',
                subtitle:
                    'Affichées sur la Facture PDF, sous les coordonnées de la boutique.',
                icon: Icons.gavel_outlined,
                iconColor: AppColors.blue,
              ),
              TextField(
                controller: _rccmController,
                maxLength: 60,
                decoration: const InputDecoration(
                    labelText: 'RCCM',
                    hintText: 'Ex : GC-2024-B-1234',
                    border: OutlineInputBorder(),
                    isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _nifController,
                maxLength: 60,
                decoration: const InputDecoration(
                    labelText: 'NIF',
                    hintText: 'Ex : 123456789',
                    border: OutlineInputBorder(),
                    isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _taxRegimeController,
                maxLength: 60,
                decoration: const InputDecoration(
                    labelText: 'Régime fiscal',
                    hintText: 'Ex : Réel simplifié',
                    border: OutlineInputBorder(),
                    isDense: true),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _CardTitle(
                title: 'Numérotation de facture',
                subtitle:
                    'Par défaut, la Facture PDF reprend le numéro de la vente (ex : ORD-2026-000032). Active une numérotation dédiée, séquentielle et indépendante, si ta comptabilité en a besoin.',
                icon: Icons.tag_outlined,
                iconColor: AppColors.blue,
              ),
              CheckboxListTile(
                value: _form.invoiceNumberingEnabled,
                onChanged: (value) => setState(() => _form =
                    _form.copyWith(invoiceNumberingEnabled: value ?? false)),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                dense: true,
                title: const Text('Activer la numérotation dédiée des factures',
                    style: TextStyle(fontSize: 13)),
              ),
              if (_form.invoiceNumberingEnabled) ...[
                const SizedBox(height: 4),
                SizedBox(
                  width: 200,
                  child: TextField(
                    controller: _invoicePrefixController,
                    maxLength: 20,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                        labelText: 'Préfixe',
                        hintText: 'FACT-',
                        border: OutlineInputBorder(),
                        isDense: true),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Ex : « ${_invoicePrefixController.text.isEmpty ? 'FACT-' : _invoicePrefixController.text}000001 »',
                  style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Enregistrement...' : 'Enregistrer')),
      ],
    );
  }
}

// --- Zone dangereuse : désactivation volontaire de la boutique
// (§53_desactivation_boutique.sql, décidé en conversation) — miroir de la
// carte "Zone dangereuse" de SettingsPage.jsx côté web. Réactivable plus
// tard par l'Owner lui-même depuis MyStorePage.dart ("Ma Boutique").

class _DangerZoneSection extends StatefulWidget {
  const _DangerZoneSection();

  @override
  State<_DangerZoneSection> createState() => _DangerZoneSectionState();
}

class _DangerZoneSectionState extends State<_DangerZoneSection> {
  bool _deactivating = false;
  String? _error;

  Future<void> _deactivate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Désactiver votre boutique ?'),
        content: const Text(
          'Elle deviendra inaccessible (à vous et à votre équipe) jusqu\'à ce que vous la réactiviez depuis "Mes boutiques". Aucune donnée ne sera supprimée.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Annuler')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade500),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Désactiver'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _error = null;
      _deactivating = true;
    });
    try {
      await context.read<StoresApi>().deactivateStore();
      if (!mounted) return;
      context.read<AuthState>().clearActiveStore();
      context.go('/account/store');
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _deactivating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.red.shade50.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.red.shade200),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Désactiver ma boutique',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
          const SizedBox(height: 4),
          Text(
            "Rend votre boutique inaccessible (à vous et à votre équipe) jusqu'à réactivation. Aucune donnée n'est supprimée. Utile si vous souhaitez, par exemple, rejoindre une autre boutique en tant que Vendeur — un même compte ne peut pas occuper les deux rôles à la fois.",
            style: TextStyle(
                fontSize: 12, color: Colors.grey.shade600, height: 1.35),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red.shade100)),
              child: Text(_error!,
                  style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _deactivating ? null : _deactivate,
            style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red.shade600,
                side: BorderSide(color: Colors.red.shade300)),
            icon: const Icon(Icons.power_settings_new, size: 16),
            label: Text(
                _deactivating ? 'Désactivation…' : 'Désactiver ma boutique'),
          ),
        ],
      ),
    );
  }
}

// --- Export comptable (§42_facturation_boutique.sql) — miroir de
// OrdersExportSection.jsx. Téléchargement direct (pas de formulaire à
// enregistrer, contrairement aux deux sections ci-dessus).

class _OrdersExportSection extends StatefulWidget {
  const _OrdersExportSection();

  @override
  State<_OrdersExportSection> createState() => _OrdersExportSectionState();
}

class _OrdersExportSectionState extends State<_OrdersExportSection> {
  late DateTime _startDate;
  late DateTime _endDate;
  bool _downloading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, 1);
    _endDate = DateTime(now.year, now.month, now.day);
  }

  String _formatDate(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
        context: context,
        initialDate: _startDate,
        firstDate: DateTime(2020),
        lastDate: _endDate);
    if (picked != null) setState(() => _startDate = picked);
  }

  Future<void> _pickEndDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
        context: context,
        initialDate: _endDate,
        firstDate: _startDate,
        lastDate: DateTime(now.year, now.month, now.day));
    if (picked != null) setState(() => _endDate = picked);
  }

  String _isoDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Future<void> _handleExport() async {
    setState(() {
      _error = null;
      _downloading = true;
    });
    try {
      // endDate est une borne EXCLUSIVE côté serveur (même convention que
      // OrdersApi.list) — on ajoute un jour pour inclure le jour choisi.
      final endExclusive = _endDate.add(const Duration(days: 1));
      final bytes = await context.read<OrdersApi>().exportCsv(
          startDate: _isoDate(_startDate), endDate: _isoDate(endExclusive));
      await shareBytesAsFile(bytes,
          fileName: 'export-ventes.csv',
          mimeType: 'text/csv',
          subject: 'Export des ventes');
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } catch (_) {
      setState(() => _error = "Impossible de générer l'export.");
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle(
            title: 'Export comptable',
            subtitle:
                'Exporte les ventes de la période choisie au format CSV (compatible Excel), à donner à ton comptable.',
            icon: Icons.file_download_outlined,
            iconColor: AppColors.blue,
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(_error!,
                  style: const TextStyle(color: Colors.red, fontSize: 12.5)),
            ),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton.icon(
                onPressed: _pickStartDate,
                icon: const Icon(Icons.calendar_today_outlined, size: 15),
                label: Text('Du ${_formatDate(_startDate)}'),
              ),
              OutlinedButton.icon(
                onPressed: _pickEndDate,
                icon: const Icon(Icons.calendar_today_outlined, size: 15),
                label: Text('Au ${_formatDate(_endDate)}'),
              ),
              FilledButton(
                onPressed: _downloading ? null : _handleExport,
                child: Text(_downloading ? 'Génération...' : 'Exporter (CSV)'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
