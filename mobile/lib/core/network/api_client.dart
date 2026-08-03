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
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
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
        onError: (error, handler) {
          if (error.response?.statusCode == 401) {
            onUnauthorized();
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
        err.type == DioExceptionType.connectionError) {
      return const ApiException(
        message:
            "Impossible de joindre le serveur. Vérifiez votre connexion et l'adresse de l'API (AppConfig.apiBaseUrl).",
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
