/// Modèles Équipe — miroir de employees.service.js (§4.3 du cahier des charges).
library;

const kRoleLabels = {'OWNER': 'Propriétaire', 'SELLER': 'Vendeur'};

class Employee {
  const Employee({
    required this.userId,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.roleCode,
    required this.isDefaultStore,
    required this.joinedAt,
    required this.canVoidReturn,
    required this.canEditPrice,
    required this.canAddProduct,
    required this.canManageStock,
    required this.canManageSuppliers,
    required this.canManagePurchases,
  });

  factory Employee.fromJson(Map<String, dynamic> json) => Employee(
        userId: json['userId'] as int,
        fullName: json['fullName'] as String,
        email: json['email'] as String,
        phone: json['phone'] as String?,
        roleCode: json['roleCode'] as String,
        isDefaultStore: json['isDefaultStore'] as bool? ?? false,
        joinedAt: json['joinedAt'] as String?,
        canVoidReturn: json['canVoidReturn'] as bool? ?? false,
        canEditPrice: json['canEditPrice'] as bool? ?? false,
        canAddProduct: json['canAddProduct'] as bool? ?? false,
        canManageStock: json['canManageStock'] as bool? ?? false,
        canManageSuppliers: json['canManageSuppliers'] as bool? ?? false,
        canManagePurchases: json['canManagePurchases'] as bool? ?? false,
      );

  final int userId;
  final String fullName;
  final String email;
  final String? phone;
  final String roleCode;
  final bool isDefaultStore;
  final String? joinedAt;
  final bool canVoidReturn;
  final bool canEditPrice;
  final bool canAddProduct;
  final bool canManageStock;
  final bool canManageSuppliers;
  final bool canManagePurchases;

  Employee copyWith({
    bool? canVoidReturn,
    bool? canEditPrice,
    bool? canAddProduct,
    bool? canManageStock,
    bool? canManageSuppliers,
    bool? canManagePurchases,
  }) =>
      Employee(
        userId: userId,
        fullName: fullName,
        email: email,
        phone: phone,
        roleCode: roleCode,
        isDefaultStore: isDefaultStore,
        joinedAt: joinedAt,
        canVoidReturn: canVoidReturn ?? this.canVoidReturn,
        canEditPrice: canEditPrice ?? this.canEditPrice,
        canAddProduct: canAddProduct ?? this.canAddProduct,
        canManageStock: canManageStock ?? this.canManageStock,
        canManageSuppliers: canManageSuppliers ?? this.canManageSuppliers,
        canManagePurchases: canManagePurchases ?? this.canManagePurchases,
      );
}

class EmployeeInvitation {
  const EmployeeInvitation({required this.id, required this.email, required this.roleCode, required this.createdAt});

  factory EmployeeInvitation.fromJson(Map<String, dynamic> json) => EmployeeInvitation(
        id: json['id'] as int,
        email: json['email'] as String,
        roleCode: json['roleCode'] as String,
        createdAt: json['createdAt'] as String?,
      );

  final int id;
  final String email;
  final String roleCode;
  final String? createdAt;
}

/// Résultat de l'ajout — deux cas distincts côté serveur, cf.
/// employees.service.js#addEmployee.
class AddEmployeeResult {
  const AddEmployeeResult({required this.email, required this.fullName, required this.roleCode, required this.invitationPending});

  factory AddEmployeeResult.fromJson(Map<String, dynamic> json) => AddEmployeeResult(
        email: json['email'] as String,
        fullName: json['fullName'] as String?,
        roleCode: json['roleCode'] as String,
        invitationPending: json['invitationPending'] as bool? ?? false,
      );

  final String email;
  final String? fullName;
  final String roleCode;
  final bool invitationPending;
}
