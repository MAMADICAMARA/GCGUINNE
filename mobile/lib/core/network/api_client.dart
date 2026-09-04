import 'package:dio/dio.dart';

import 'api_exception.dart';

/// Client HTTP centralisé, miroir de frontend/src/services/apiClient.js.
///
/// - Injecte automatiquement le jeton d'authentification dans chaque
///   requête (via [getToken], pour ne pas dépendre directement de
///   AuthState et éviter tout import circulaire).
/// - Convertit systématiquement les erreurs backend (format
///   { error: { code, message } }) en [ApiException] exploitable par
///   l'UI, plutôt que de laisser fuir une DioException brute.
/// - Signale les 401 via [onUnauthorized] pour que l'appelant (main.dart)
///   déclenche une déconnexion propre.
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.getToken,
    required this.onUnauthorized,
  }) {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        // § décidé en conversation, suite à un cas réel signalé — le
        // réseau mobile (loin des serveurs, connexions instables) tolère
        // mal un délai aussi court que les 10s/15s d'origine : une
        // poignée de main TLS un peu lente suffisait à déclencher l'erreur
        // réseau alors que le serveur répondait normalement. Reste borné
        // (jamais un blocage infini) mais plus tolérant.
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        contentType: 'application/json',
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            onUnauthorized();
          }

          // Une seule tentative de ré-essai automatique, uniquement pour
          // les erreurs réseau transitoires (jamais pour une vraie erreur
          // serveur/4xx/5xx) — § décidé en conversation : un utilisateur
          // peu à l'aise avec la technologie ne doit pas voir une erreur
          // effrayante pour un simple aléa de connexion mobile qui se
          // serait résolu de lui-même une seconde plus tard. Le drapeau
          // `retried` évite toute boucle infinie.
          final isTransient = error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.receiveTimeout;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;

          if (isTransient && !alreadyRetried) {
            try {
              await Future<void>.delayed(const Duration(seconds: 2));
              final retryOptions = error.requestOptions
                ..extra['retried'] = true;
              final response = await _dio.fetch<dynamic>(retryOptions);
              return handler.resolve(response);
            } catch (_) {
              // La seconde tentative a échoué aussi — on laisse tomber et
              // remonte l'erreur d'origine normalement, ci-dessous.
            }
          }

          handler.next(error);
        },
      ),
    );
  }

  final String baseUrl;
  final String? Function() getToken;
  final void Function() onUnauthorized;
  late final Dio _dio;

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: query,
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (err) {
      throw _mapError(err);
    }
  }

  /// Réponse binaire brute (PDF, image...) — miroir de `responseType: 'blob'`
  /// côté web (cf. utils/invoicePdf.js). Un éventuel corps d'erreur JSON
  /// arrive ici sous forme d'octets bruts (jamais décodé, `responseType`
  /// s'applique à toute la requête) : [_mapError] retombe alors sur son
  /// message générique plutôt que le vrai message serveur, seul compromis
  /// de cette approche.
  Future<List<int>> getBytes(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await _dio.get<List<int>>(
        path,
        queryParameters: query,
        options: Options(responseType: ResponseType.bytes),
      );
      return response.data ?? <int>[];
    } on DioException catch (err) {
      throw _mapError(err);
    }
  }

  Future<Map<String, dynamic>> post(String path, {Object? data}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(path, data: data);
      return response.data ?? <String, dynamic>{};
    } on DioException catch (err) {
      throw _mapError(err);
    }
  }

  Future<Map<String, dynamic>> put(String path, {Object? data}) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(path, data: data);
      return response.data ?? <String, dynamic>{};
    } on DioException catch (err) {
      throw _mapError(err);
    }
  }

  Future<Map<String, dynamic>> patch(String path, {Object? data}) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(path, data: data);
      return response.data ?? <String, dynamic>{};
    } on DioException catch (err) {
      throw _mapError(err);
    }
  }

  Future<Map<String, dynamic>> delete(String path) async {
    try {
      final response = await _dio.delete<Map<String, dynamic>>(path);
      return response.data ?? <String, dynamic>{};
    } on DioException catch (err) {
      throw _mapError(err);
    }
  }

  ApiException _mapError(DioException err) {
    final data = err.response?.data;
    if (data is Map<String, dynamic> && data['error'] is Map) {
      final error = data['error'] as Map<String, dynamic>;
      return ApiException(
        message: error['message'] as String? ?? 'Une erreur est survenue.',
        code: error['code'] as String? ?? 'UNKNOWN_ERROR',
        statusCode: err.response?.statusCode,
      );
    }

    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.receiveTimeout) {
      return const ApiException(
        message: 'Connexion au serveur impossible. Vérifiez votre connexion internet et réessayez.',
        code: 'NETWORK_ERROR',
      );
    }

    return ApiException(
      message: 'Une erreur inattendue est survenue.',
      code: 'UNKNOWN_ERROR',
      statusCode: err.response?.statusCode,
    );
  }
}
