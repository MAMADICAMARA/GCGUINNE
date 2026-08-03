/// Exception levée pour toute erreur renvoyée par l'API.
///
/// Miroir côté mobile du format d'erreur normalisé du backend :
///   { "error": { "code": "...", "message": "..." } }
/// (voir backend/src/middlewares/errorHandler.js)
class ApiException implements Exception {
  const ApiException({
    required this.message,
    required this.code,
    this.statusCode,
  });

  final String message;
  final String code;
  final int? statusCode;

  @override
  String toString() => message;
}
