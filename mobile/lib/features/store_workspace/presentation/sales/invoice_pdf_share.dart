import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/orders_api.dart';

/// Facture PDF téléchargeable (§ cahier des charges "Facture PDF") — miroir
/// de utils/invoicePdf.js côté web (bouton "Télécharger la facture (PDF)").
/// Contrairement au web, il n'existe pas de "Téléchargements" sur mobile :
/// on écrit le PDF dans un dossier temporaire (nom de fichier correct,
/// requis par share_plus pour l'afficher dans la feuille de partage) puis on
/// ouvre le partage natif — l'utilisateur choisit "Enregistrer dans
/// Fichiers", l'envoyer par WhatsApp, l'imprimer, etc.
Future<void> shareInvoicePdf(
  BuildContext context, {
  required int orderId,
  required String orderNumber,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final bytes = await context.read<OrdersApi>().getInvoicePdf(orderId);
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/facture-$orderNumber.pdf');
    await file.writeAsBytes(bytes);
    await Share.shareXFiles([XFile(file.path, mimeType: 'application/pdf')], subject: 'Facture $orderNumber');
  } on ApiException catch (err) {
    messenger.showSnackBar(SnackBar(content: Text(err.message)));
  } catch (_) {
    messenger.showSnackBar(const SnackBar(content: Text('Impossible de générer la facture.')));
  }
}
