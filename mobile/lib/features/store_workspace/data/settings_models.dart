/// Modèles Paramètres — miroir de stores.service.js / subscriptionPayments.service.js
/// (§8 du cahier des charges).
library;

class ReceiptSettings {
  const ReceiptSettings({
    required this.headerMessage,
    required this.footerMessage,
    required this.showAddress,
    required this.showPhone,
    required this.showSellerName,
    required this.showSignature,
    required this.signatureLabel,
    required this.invoiceTitle,
  });

  factory ReceiptSettings.fromJson(Map<String, dynamic> json) => ReceiptSettings(
        headerMessage: json['headerMessage'] as String? ?? '',
        footerMessage: json['footerMessage'] as String? ?? 'Merci de votre visite !',
        showAddress: json['showAddress'] as bool? ?? false,
        showPhone: json['showPhone'] as bool? ?? false,
        showSellerName: json['showSellerName'] as bool? ?? false,
        showSignature: json['showSignature'] as bool? ?? false,
        signatureLabel: json['signatureLabel'] as String? ?? 'Signature',
        invoiceTitle: json['invoiceTitle'] as String? ?? 'FACTURE',
      );

  final String headerMessage;
  final String footerMessage;
  final bool showAddress;
  final bool showPhone;
  final bool showSellerName;
  final bool showSignature;
  final String signatureLabel;
  final String invoiceTitle;

  ReceiptSettings copyWith({
    String? headerMessage,
    String? footerMessage,
    bool? showAddress,
    bool? showPhone,
    bool? showSellerName,
    bool? showSignature,
    String? signatureLabel,
    String? invoiceTitle,
  }) =>
      ReceiptSettings(
        headerMessage: headerMessage ?? this.headerMessage,
        footerMessage: footerMessage ?? this.footerMessage,
        showAddress: showAddress ?? this.showAddress,
        showPhone: showPhone ?? this.showPhone,
        showSellerName: showSellerName ?? this.showSellerName,
        showSignature: showSignature ?? this.showSignature,
        signatureLabel: signatureLabel ?? this.signatureLabel,
        invoiceTitle: invoiceTitle ?? this.invoiceTitle,
      );

  Map<String, dynamic> toJson() => {
        'headerMessage': headerMessage,
        'footerMessage': footerMessage,
        'showAddress': showAddress,
        'showPhone': showPhone,
        'showSellerName': showSellerName,
        'showSignature': showSignature,
        'signatureLabel': signatureLabel,
        'invoiceTitle': invoiceTitle,
      };
}

/// Réglages "Facturation" (§42_facturation_boutique.sql, décidé en
/// conversation) — miroir de GET/PUT /stores/billing-settings. Regroupe taux
/// de taxe par défaut, informations légales et numérotation de facture
/// dédiée dans un même formulaire, même principe que ReceiptSettings.
class BillingSettings {
  const BillingSettings({
    required this.defaultTaxPercent,
    required this.legalRccm,
    required this.legalNif,
    required this.legalTaxRegime,
    required this.invoiceNumberingEnabled,
    required this.invoicePrefix,
  });

  factory BillingSettings.fromJson(Map<String, dynamic> json) => BillingSettings(
        defaultTaxPercent: (json['defaultTaxPercent'] as num?) ?? 0,
        legalRccm: json['legalRccm'] as String? ?? '',
        legalNif: json['legalNif'] as String? ?? '',
        legalTaxRegime: json['legalTaxRegime'] as String? ?? '',
        invoiceNumberingEnabled: json['invoiceNumberingEnabled'] as bool? ?? false,
        invoicePrefix: json['invoicePrefix'] as String? ?? 'FACT-',
      );

  final num defaultTaxPercent;
  final String legalRccm;
  final String legalNif;
  final String legalTaxRegime;
  final bool invoiceNumberingEnabled;
  final String invoicePrefix;

  BillingSettings copyWith({
    num? defaultTaxPercent,
    String? legalRccm,
    String? legalNif,
    String? legalTaxRegime,
    bool? invoiceNumberingEnabled,
    String? invoicePrefix,
  }) =>
      BillingSettings(
        defaultTaxPercent: defaultTaxPercent ?? this.defaultTaxPercent,
        legalRccm: legalRccm ?? this.legalRccm,
        legalNif: legalNif ?? this.legalNif,
        legalTaxRegime: legalTaxRegime ?? this.legalTaxRegime,
        invoiceNumberingEnabled: invoiceNumberingEnabled ?? this.invoiceNumberingEnabled,
        invoicePrefix: invoicePrefix ?? this.invoicePrefix,
      );

  Map<String, dynamic> toJson() => {
        'defaultTaxPercent': defaultTaxPercent,
        'legalRccm': legalRccm,
        'legalNif': legalNif,
        'legalTaxRegime': legalTaxRegime,
        'invoiceNumberingEnabled': invoiceNumberingEnabled,
        'invoicePrefix': invoicePrefix,
      };
}

/// Informations générales de la boutique (§ décidé en conversation, "tout
/// modifiable sauf l'e-mail") — miroir de GET/PUT /stores/info. Distinct de
/// StoreContactInfo ci-dessous (sous-ensemble en lecture seule utilisé par
/// l'aperçu du reçu) : celui-ci porte les champs éditables au complet, y
/// compris la localisation.
class StoreInfo {
  const StoreInfo({
    required this.name,
    required this.address,
    required this.phone,
    required this.region,
    required this.city,
    required this.country,
  });

  factory StoreInfo.fromJson(Map<String, dynamic> json) => StoreInfo(
        name: json['name'] as String? ?? '',
        address: json['address'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        region: json['region'] as String? ?? '',
        city: json['city'] as String? ?? '',
        country: json['country'] as String? ?? 'Guinée',
      );

  final String name;
  final String address;
  final String phone;
  final String region;
  final String city;
  final String country;

  Map<String, dynamic> toJson() => {
        'name': name,
        'address': address,
        'phone': phone,
        'region': region,
        'city': city,
        'country': country,
      };

  StoreInfo copyWith({String? name, String? address, String? phone, String? region, String? city, String? country}) =>
      StoreInfo(
        name: name ?? this.name,
        address: address ?? this.address,
        phone: phone ?? this.phone,
        region: region ?? this.region,
        city: city ?? this.city,
        country: country ?? this.country,
      );
}

class StoreContactInfo {
  const StoreContactInfo({required this.name, required this.address, required this.phone});

  factory StoreContactInfo.fromJson(Map<String, dynamic> json) => StoreContactInfo(
        name: json['name'] as String? ?? '',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
      );

  final String name;
  final String? address;
  final String? phone;
}

class StoreTypeOption {
  const StoreTypeOption({required this.id, required this.label, required this.categories});

  factory StoreTypeOption.fromJson(Map<String, dynamic> json) => StoreTypeOption(
        id: json['id'] as int,
        label: json['label'] as String,
        categories: (json['categories'] as List<dynamic>? ?? [])
            .map((e) => (e as Map<String, dynamic>)['name'] as String)
            .toList(),
      );

  final int id;
  final String label;
  final List<String> categories;
}

class SubscriptionPlanOption {
  const SubscriptionPlanOption({
    required this.id,
    required this.name,
    required this.price,
    required this.maxUsersPerStore,
    required this.maxProductsPerStore,
    required this.allowsSupervision,
    required this.allowsSuppliers,
    required this.allowsPurchaseOrders,
    required this.allowsMarketplace,
    required this.allowsStockTransfer,
  });

  factory SubscriptionPlanOption.fromJson(Map<String, dynamic> json) => SubscriptionPlanOption(
        id: json['id'] as int,
        name: json['name'] as String,
        price: (json['price'] as num?) ?? 0,
        maxUsersPerStore: json['maxUsersPerStore'] as int? ?? 1,
        maxProductsPerStore: json['maxProductsPerStore'] as int? ?? 1,
        allowsSupervision: json['allowsSupervision'] as bool? ?? false,
        allowsSuppliers: json['allowsSuppliers'] as bool? ?? false,
        allowsPurchaseOrders: json['allowsPurchaseOrders'] as bool? ?? false,
        allowsMarketplace: json['allowsMarketplace'] as bool? ?? false,
        allowsStockTransfer: json['allowsStockTransfer'] as bool? ?? false,
      );

  final int id;
  final String name;
  final num price;
  final int maxUsersPerStore;
  final int maxProductsPerStore;
  final bool allowsSupervision;
  final bool allowsSuppliers;
  final bool allowsPurchaseOrders;
  final bool allowsMarketplace;
  final bool allowsStockTransfer;
}

class PaymentSettings {
  const PaymentSettings({
    required this.orangeMoneyNumber,
    required this.mobileMoneyNumber,
    required this.paycardInfo,
    required this.contactPhone,
    required this.contactWhatsapp,
    required this.contactEmail,
  });

  factory PaymentSettings.fromJson(Map<String, dynamic> json) => PaymentSettings(
        orangeMoneyNumber: json['orangeMoneyNumber'] as String?,
        mobileMoneyNumber: json['mobileMoneyNumber'] as String?,
        paycardInfo: json['paycardInfo'] as String?,
        contactPhone: json['contactPhone'] as String?,
        contactWhatsapp: json['contactWhatsapp'] as String?,
        contactEmail: json['contactEmail'] as String?,
      );

  final String? orangeMoneyNumber;
  final String? mobileMoneyNumber;
  final String? paycardInfo;
  final String? contactPhone;
  final String? contactWhatsapp;
  final String? contactEmail;
}

class SubscriptionOptions {
  const SubscriptionOptions({required this.plans, required this.paymentSettings, required this.renewalDays});

  factory SubscriptionOptions.fromJson(Map<String, dynamic> json) => SubscriptionOptions(
        plans: (json['plans'] as List<dynamic>? ?? []).map((e) => SubscriptionPlanOption.fromJson(e as Map<String, dynamic>)).toList(),
        paymentSettings: PaymentSettings.fromJson(json['paymentSettings'] as Map<String, dynamic>? ?? {}),
        renewalDays: json['renewalDays'] as int? ?? 30,
      );

  final List<SubscriptionPlanOption> plans;
  final PaymentSettings paymentSettings;
  final int renewalDays;
}

const kPaymentMethodLabels = {'ORANGE_MONEY': 'Orange Money', 'MOBILE_MONEY': 'Mobile Money', 'PAYCARD': 'PayCard'};

class SubscriptionRequest {
  const SubscriptionRequest({
    required this.id,
    required this.status,
    required this.planName,
    required this.paymentMethod,
    required this.transactionReference,
    required this.amountDeclared,
    required this.rejectionReason,
    required this.createdAt,
  });

  factory SubscriptionRequest.fromJson(Map<String, dynamic> json) => SubscriptionRequest(
        id: json['id'] as int,
        status: json['status'] as String,
        planName: json['planName'] as String? ?? '',
        paymentMethod: json['paymentMethod'] as String? ?? '',
        transactionReference: json['transactionReference'] as String?,
        amountDeclared: (json['amountDeclared'] as num?) ?? 0,
        rejectionReason: json['rejectionReason'] as String?,
        createdAt: json['createdAt'] as String?,
      );

  final int id;
  final String status;
  final String planName;
  final String paymentMethod;
  final String? transactionReference;
  final num amountDeclared;
  final String? rejectionReason;
  final String? createdAt;
}
