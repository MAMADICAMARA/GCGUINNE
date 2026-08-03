/// Miroir d'un élément du tableau `stores` renvoyé par /auth/login,
/// /auth/register, /stores/mine et /stores (création).
///
/// Porte à la fois les infos de la boutique et le rôle de l'utilisateur
/// courant dans cette boutique (cf. table user_store côté backend).
class StoreRef {
  const StoreRef({
    required this.id,
    required this.name,
    required this.roleCode,
    this.city,
    this.category,
    this.isDefaultStore = false,
  });

  factory StoreRef.fromJson(Map<String, dynamic> json) {
    return StoreRef(
      id: json['id'] as int,
      name: json['name'] as String,
      roleCode: json['roleCode'] as String,
      city: json['city'] as String?,
      category: json['category'] as String?,
      isDefaultStore: json['isDefaultStore'] as bool? ?? false,
    );
  }

  final int id;
  final String name;
  final String roleCode;
  final String? city;
  final String? category;
  final bool isDefaultStore;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'roleCode': roleCode,
        'city': city,
        'category': category,
        'isDefaultStore': isDefaultStore,
      };
}
