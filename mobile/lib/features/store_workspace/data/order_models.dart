/// Modèles pour l'Historique des ventes — miroir de orders.service.js
/// (getOrders, getOrderById).
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

int _parseInt(Object? value) => (value as num).toInt();

const kOrderStatusLabels = {
  'PAID': 'Payée',
  'RETURNED': 'Retournée',
  'PARTIALLY_RETURNED': 'Partiellement retournée',
  'VOIDED': 'Annulée',
};

const kPaymentStatusLabels = {
  'PAID': 'Total',
  'PARTIALLY_PAID': 'Partiel',
  'PENDING': 'Non payé',
};

const kPaymentMethodLabels = {
  'CASH': 'Espèces',
  'MOBILE_MONEY': 'Mobile Money',
  'CARD': 'Carte',
  'OTHER': 'Autre',
};

class OrderSummary {
  const OrderSummary({
    required this.id,
    required this.orderNumber,
    required this.totalAmount,
    required this.status,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.createdAt,
    required this.sellerName,
    required this.customerName,
    this.amountPaid,
  });

  factory OrderSummary.fromJson(Map<String, dynamic> json) => OrderSummary(
        id: json['id'] as int,
        orderNumber: json['orderNumber'] as String,
        totalAmount: _parseNum(json['totalAmount']) ?? 0,
        status: json['status'] as String,
        paymentMethod: json['paymentMethod'] as String,
        paymentStatus: json['paymentStatus'] as String,
        createdAt: json['createdAt'] as String?,
        sellerName: json['sellerName'] as String?,
        customerName: json['customerName'] as String?,
        amountPaid: _parseNum(json['amountPaid']),
      );

  final int id;
  final String orderNumber;
  final num totalAmount;
  final String status;
  final String paymentMethod;
  final String paymentStatus;
  final String? createdAt;
  final String? sellerName;
  final String? customerName;
  // Absent des écrans qui ne l'utilisaient pas jusqu'ici (Historique des
  // ventes) — ajouté pour Supervision, qui calcule le "reste à payer"
  // comme le web (o.amountPaid ?? o.totalAmount).
  final num? amountPaid;

  num get remaining => totalAmount - (amountPaid ?? totalAmount);
}

class OrderListResult {
  const OrderListResult({required this.orders, required this.total, required this.page, required this.pages});

  factory OrderListResult.fromJson(Map<String, dynamic> json) => OrderListResult(
        orders: (json['orders'] as List<dynamic>? ?? []).map((e) => OrderSummary.fromJson(e as Map<String, dynamic>)).toList(),
        total: (json['total'] as num).toInt(),
        page: (json['page'] as num).toInt(),
        pages: (json['pages'] as num).toInt(),
      );

  final List<OrderSummary> orders;
  final int total;
  final int page;
  final int pages;
}

class OrderItemDetail {
  const OrderItemDetail({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.returnedQuantity,
  });

  factory OrderItemDetail.fromJson(Map<String, dynamic> json) => OrderItemDetail(
        id: json['id'] as int,
        productId: json['productId'] as int,
        productName: json['productName'] as String,
        quantity: _parseInt(json['quantity']),
        unitPrice: _parseNum(json['unitPrice']) ?? 0,
        returnedQuantity: _parseInt(json['returnedQuantity']),
      );

  final int id;
  final int productId;
  final String productName;
  final int quantity;
  final num unitPrice;
  final int returnedQuantity;

  int get availableToReturn => quantity - returnedQuantity;
}

class OrderDetail {
  const OrderDetail({
    required this.id,
    required this.orderNumber,
    required this.totalAmount,
    required this.discountAmount,
    required this.taxAmount,
    required this.status,
    required this.paymentMethod,
    required this.amountPaid,
    required this.paymentStatus,
    required this.createdAt,
    required this.sellerName,
    required this.customerName,
    required this.items,
  });

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    final order = json['order'] as Map<String, dynamic>;
    return OrderDetail(
      id: order['id'] as int,
      orderNumber: order['orderNumber'] as String,
      totalAmount: _parseNum(order['totalAmount']) ?? 0,
      discountAmount: _parseNum(order['discountAmount']) ?? 0,
      taxAmount: _parseNum(order['taxAmount']) ?? 0,
      status: order['status'] as String,
      paymentMethod: order['paymentMethod'] as String,
      amountPaid: _parseNum(order['amountPaid']) ?? 0,
      paymentStatus: order['paymentStatus'] as String,
      createdAt: order['createdAt'] as String?,
      sellerName: order['sellerName'] as String?,
      customerName: order['customerName'] as String?,
      items: (json['items'] as List<dynamic>? ?? []).map((e) => OrderItemDetail.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  final int id;
  final String orderNumber;
  final num totalAmount;
  final num discountAmount;
  final num taxAmount;
  final String status;
  final String paymentMethod;
  final num amountPaid;
  final String paymentStatus;
  final String? createdAt;
  final String? sellerName;
  final String? customerName;
  final List<OrderItemDetail> items;

  bool get hasReturnableItems => items.any((item) => item.availableToReturn > 0);
}
