import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/network/api_client.dart';

/// Miroir de uploads.routes.js (POST /uploads/image, multipart) — jamais
/// appelé directement via ApiClient.post() (qui fixe Content-Type: JSON par
/// défaut) : dio bascule automatiquement en multipart/form-data dès que
/// `data` est une [FormData], donc rien à surcharger manuellement ici.
class UploadsApi {
  const UploadsApi(this._client);

  final ApiClient _client;

  Future<String> uploadImage(XFile file, {required String context}) async {
    final bytes = await file.readAsBytes();
    final formData = FormData.fromMap({
      'context': context,
      'image': MultipartFile.fromBytes(bytes, filename: file.name),
    });
    final data = await _client.post('/uploads/image', data: formData);
    return data['url'] as String;
  }
}
