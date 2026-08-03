/// Miroir de l'objet `user` renvoyé par /auth/register et /auth/login.
class AppUser {
  const AppUser({
    required this.id,
    required this.fullName,
    required this.email,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as int,
      fullName: json['fullName'] as String,
      email: json['email'] as String,
    );
  }

  final int id;
  final String fullName;
  final String email;

  Map<String, dynamic> toJson() => {
        'id': id,
        'fullName': fullName,
        'email': email,
      };
}
