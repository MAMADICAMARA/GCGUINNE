import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Écrit des octets reçus du serveur dans un fichier temporaire nommé
/// correctement puis ouvre le partage natif — utilisé partout où le mobile
/// doit "télécharger" un document généré côté serveur (Facture PDF, export
/// comptable...). Il n'existe pas de "Téléchargements" sur mobile comme sur
/// le web : l'utilisateur choisit "Enregistrer dans Fichiers", l'envoyer
/// par WhatsApp, l'imprimer, etc. depuis la feuille de partage.
Future<void> shareBytesAsFile(Uint8List bytes, {required String fileName, required String mimeType, String? subject}) async {
  final tempDir = await getTemporaryDirectory();
  final file = File('${tempDir.path}/$fileName');
  await file.writeAsBytes(bytes);
  await Share.shareXFiles([XFile(file.path, mimeType: mimeType)], subject: subject);
}
