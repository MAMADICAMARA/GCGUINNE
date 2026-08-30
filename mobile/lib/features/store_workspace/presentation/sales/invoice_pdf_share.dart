import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../core/utils/share_file.dart';
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
    await shareBytesAsFile(bytes, fileName: 'facture-$orderNumber.pdf', mimeType: 'application/pdf', subject: 'Facture $orderNumber');
  } on ApiException catch (err) {
    messenger.showSnackBar(SnackBar(content: Text(err.message)));
  } catch (_) {
    messenger.showSnackBar(const SnackBar(content: Text('Impossible de générer la facture.')));
  }
}
