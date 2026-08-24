/// Modèles Clients — miroir de customers.service.js.
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

int _parseInt(Object? value) => (value as num).toInt();

class Customer {
  const Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.totalSpent,
    required this.balanceDue,
    this.createdAt,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: json['id'] as int,
        name: json['name'] as String,
        phone: json['phone'] as String?,
        totalSpent: _parseNum(json['totalSpent']) ?? 0,
        balanceDue: _parseNum(json['balanceDue']) ?? 0,
        createdAt: json['createdAt'] as String?,
      );

  final int id;
  final String name;
  final String? phone;
  final num totalSpent;
  final num balanceDue;
  final String? createdAt;
}

class CustomerListResult {
  const CustomerListResult({required this.customers, required this.total, required this.page, required this.pages});

  factory CustomerListResult.fromJson(Map<String, dynamic> json) => CustomerListResult(
        customers: (json['customers'] as List<dynamic>? ?? []).map((e) => Customer.fromJson(e as Map<String, dynamic>)).toList(),
        total: (json['total'] as num).toInt(),
        page: (json['page'] as num).toInt(),
        pages: (json['pages'] as num).toInt(),
      );

  final List<Customer> customers;
  final int total;
  final int page;
  final int pages;
}

class CustomerOrderItem {
  const CustomerOrderItem({required this.productName, required this.quantity, required this.unitPrice});

  factory CustomerOrderItem.fromJson(Map<String, dynamic> json) => CustomerOrderItem(
        productName: json['productName'] as String,
        quantity: _parseInt(json['quantity']),
        unitPrice: _parseNum(json['unitPrice']) ?? 0,
      );

  final String productName;
  final int quantity;
  final num unitPrice;
}

class CustomerOrder {
  const CustomerOrder({
    required this.orderId,
    required this.orderNumber,
    required this.createdAt,
    required this.totalAmount,
    required this.amountPaid,
    required this.paymentStatus,
    required this.status,
    required this.sellerName,
    required this.items,
  });

  factory CustomerOrder.fromJson(Map<String, dynamic> json) => CustomerOrder(
        orderId: json['orderId'] as int,
        orderNumber: json['orderNumber'] as String,
        createdAt: json['createdAt'] as String?,
        totalAmount: _parseNum(json['totalAmount']) ?? 0,
        amountPaid: _parseNum(json['amountPaid']) ?? 0,
        paymentStatus: json['paymentStatus'] as String,
        status: json['status'] as String,
        sellerName: json['sellerName'] as String?,
        items: (json['items'] as List<dynamic>? ?? []).map((e) => CustomerOrderItem.fromJson(e as Map<String, dynamic>)).toList(),
      );

  final int orderId;
  final String orderNumber;
  final String? createdAt;
  final num totalAmount;
  final num amountPaid;
  final String paymentStatus;
  final String status;
  final String? sellerName;
  final List<CustomerOrderItem> items;
}

class CustomerOrderHistory {
  const CustomerOrderHistory({required this.customer, required this.orders});

  factory CustomerOrderHistory.fromJson(Map<String, dynamic> json) => CustomerOrderHistory(
        customer: Customer.fromJson(json['customer'] as Map<String, dynamic>),
        orders: (json['orders'] as List<dynamic>? ?? []).map((e) => CustomerOrder.fromJson(e as Map<String, dynamic>)).toList(),
      );

  final Customer customer;
  final List<CustomerOrder> orders;
}

class CustomerPayment {
  const CustomerPayment({required this.id, required this.amount, required this.createdAt, required this.sellerName});

  factory CustomerPayment.fromJson(Map<String, dynamic> json) => CustomerPayment(
        id: json['id'] as int,
        amount: _parseNum(json['amount']) ?? 0,
        createdAt: json['createdAt'] as String?,
        sellerName: json['sellerName'] as String?,
      );

  final int id;
  final num amount;
  final String? createdAt;
  final String? sellerName;
}
