/// Miroir de l'objet `user` renvoyé par /auth/register et /auth/login.
/// phone/gender/birthDate sont absents des réponses register/login (elles
/// ne renvoient que id/fullName/email) mais présents sur PUT /auth/profile
/// (§ décidé en conversation, "tout modifiable sauf l'e-mail") — d'où leur
/// caractère optionnel ici plutôt que requis.
class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
    this.phone,
    this.gender,
    this.birthDate,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as int,
      fullName: json['fullName'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      gender: json['gender'] as String?,
      birthDate: json['birthDate'] as String?,
    );
  }

  final int id;
  final String fullName;
  final String email;
  final String? phone;
  final String? gender;
  final String? birthDate;

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        'email': email,
        'phone': phone,
        'gender': gender,
        'birthDate': birthDate,
      };
}
