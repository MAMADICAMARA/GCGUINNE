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
  });

  factory ReceiptSettings.fromJson(Map<String, dynamic> json) => ReceiptSettings(
        headerMessage: json['headerMessage'] as String? ?? '',
        footerMessage: json['footerMessage'] as String? ?? 'Merci de votre visite !',
        showAddress: json['showAddress'] as bool? ?? false,
        showPhone: json['showPhone'] as bool? ?? false,
        showSellerName: json['showSellerName'] as bool? ?? false,
      );

  final String headerMessage;
  final String footerMessage;
  final bool showAddress;
  final bool showPhone;
  final bool showSellerName;

  ReceiptSettings copyWith({
    String? headerMessage,
    String? footerMessage,
    bool? showAddress,
    bool? showPhone,
    bool? showSellerName,
  }) =>
      ReceiptSettings(
        headerMessage: headerMessage ?? this.headerMessage,
        footerMessage: footerMessage ?? this.footerMessage,
        showAddress: showAddress ?? this.showAddress,
        showPhone: showPhone ?? this.showPhone,
        showSellerName: showSellerName ?? this.showSellerName,
      );

  Map<String, dynamic> toJson() => {
        'headerMessage': headerMessage,
        'footerMessage': footerMessage,
        'showAddress': showAddress,
        'showPhone': showPhone,
        'showSellerName': showSellerName,
      };
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
    required this.allowsSupervision,
    required this.allowsSuppliers,
    required this.allowsPurchaseOrders,
  });

  factory SubscriptionPlanOption.fromJson(Map<String, dynamic> json) => SubscriptionPlanOption(
        id: json['id'] as int,
        name: json['name'] as String,
        price: (json['price'] as num?) ?? 0,
        maxUsersPerStore: json['maxUsersPerStore'] as int? ?? 1,
        allowsSupervision: json['allowsSupervision'] as bool? ?? false,
        allowsSuppliers: json['allowsSuppliers'] as bool? ?? false,
        allowsPurchaseOrders: json['allowsPurchaseOrders'] as bool? ?? false,
      );

  final int id;
  final String name;
  final num price;
  final int maxUsersPerStore;
  final bool allowsSupervision;
  final bool allowsSuppliers;
  final bool allowsPurchaseOrders;
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
