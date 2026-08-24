import '../../../core/network/api_client.dart';

/// Miroir de la partie "auth" de frontend/src/services/apiClient.js.
class AuthApi {
  const AuthApi(this._client);

  final ApiClient _client;

  /// Inscription (compte seul, sans boutique — cf. §4.1 du cahier des
  /// charges). Le compte est créé PENDING_VERIFICATION — contrairement à
  /// login(), ne retourne PAS de jeton de connexion (juste
  /// {email, message}) : l'appelant doit enchaîner sur verifyEmail() une
  /// fois le code reçu par e-mail entré.
  Future<Map<String, dynamic>> register({
    required String fullName,
    required String email,
    required String password,
    required String passwordConfirm,
    required String phone,
    required String gender,
    required String birthDate,
  }) {
    return _client.post('/auth/register', data: {
      'fullName': fullName,
      'email': email,
      'password': password,
      'passwordConfirm': passwordConfirm,
      'phone': phone,
      'gender': gender,
      'birthDate': birthDate,
    });
  }

  /// Valide le code à 6 chiffres reçu par e-mail — passe le compte en
  /// ACTIVE. Retourne { token, user, stores }, comme login().
  Future<Map<String, dynamic>> verifyEmail({required String email, required String code}) {
    return _client.post('/auth/verify-email', data: {'email': email, 'code': code});
  }

  /// Renvoie un nouveau code de vérification — réponse volontairement
  /// générique côté serveur (compte introuvable, déjà vérifié, ou renvoi
  /// réussi ne se distinguent jamais ici).
  Future<Map<String, dynamic>> resendVerificationCode(String email) {
    return _client.post('/auth/resend-verification-code', data: {'email': email});
  }

  /// Connexion. Retourne { token, user, stores }.
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) {
    return _client.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
  }

  /// Change la boutique active. Retourne { token, activeStore }.
  Future<Map<String, dynamic>> switchStore(int storeId) {
    return _client.post('/auth/switch-store', data: {'storeId': storeId});
  }

  /// Étape 1 du mot de passe oublié (§6.2). Réponse volontairement
  /// générique — identique que l'e-mail existe ou non (jamais révéler si
  /// un code a réellement été envoyé) : l'appelant passe TOUJOURS à
  /// l'étape suivante après un envoi réussi.
  Future<Map<String, dynamic>> requestPasswordReset(String email) {
    return _client.post('/auth/request-password-reset', data: {'email': email});
  }

  /// Étape 2 — finalise la réinitialisation avec le code reçu par e-mail.
  /// Pas de connexion automatique (contrairement à verifyEmail) :
  /// l'utilisateur doit se reconnecter avec son nouveau mot de passe.
  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String code,
    required String newPassword,
    required String newPasswordConfirm,
  }) {
    return _client.post('/auth/reset-password', data: {
      'email': email,
      'code': code,
      'newPassword': newPassword,
      'newPasswordConfirm': newPasswordConfirm,
    });
  }
}
