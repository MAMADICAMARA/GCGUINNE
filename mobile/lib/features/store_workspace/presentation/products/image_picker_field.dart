import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/uploads_api.dart';

/// Photo d'un produit — miroir fonctionnel d'ImageUploadField.jsx, mais
/// pensé mobile d'abord : appareil photo et galerie priment sur le collage
/// d'URL (gardé en repli, ex. reprendre le lien d'un fournisseur), bien
/// plus naturel qu'un champ texte pour un public peu à l'aise avec la
/// saisie sur téléphone.
class ImagePickerField extends StatefulWidget {
  const ImagePickerField({super.key, required this.imageUrl, required this.onChanged, this.uploadContext = 'products'});

  final String? imageUrl;
  final ValueChanged<String?> onChanged;

  /// Doit être l'une des valeurs de ALLOWED_CONTEXTS (uploads.controller.js)
  /// — sert uniquement à organiser le stockage, jamais de validation
  /// métier, mais un contexte hors liste retombe silencieusement sur "misc".
  final String uploadContext;

  @override
  State<ImagePickerField> createState() => _ImagePickerFieldState();
}

class _ImagePickerFieldState extends State<ImagePickerField> {
  bool _uploading = false;
  String? _error;

  Future<void> _pickAndUpload(ImageSource source) async {
    final uploadsApi = context.read<UploadsApi>();
    final picker = ImagePicker();
    XFile? file;
    try {
      file = await picker.pickImage(source: source, maxWidth: 1600, imageQuality: 85);
    } catch (err) {
      setState(() => _error = "Impossible d'accéder à ${source == ImageSource.camera ? "l'appareil photo" : 'la galerie'}.");
      return;
    }
    if (file == null) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final url = await uploadsApi.uploadImage(file, context: widget.uploadContext);
      widget.onChanged(url);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _showSourceSheet() {
    showModalBottomSheet(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text('Photo du produit', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Prendre une photo'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _pickAndUpload(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choisir depuis la galerie'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _pickAndUpload(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.link),
              title: const Text('Coller un lien'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _showUrlDialog();
              },
            ),
            if (widget.imageUrl != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Retirer la photo', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  widget.onChanged(null);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showUrlDialog() {
    final controller = TextEditingController(text: widget.imageUrl ?? '');
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Lien de l\'image'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(hintText: 'https://exemple.com/photo.jpg'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Annuler')),
          FilledButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              final url = controller.text.trim();
              widget.onChanged(url.isEmpty ? null : url);
            },
            child: const Text('Valider'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: _uploading ? null : _showSourceSheet,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade300),
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (widget.imageUrl != null && widget.imageUrl!.isNotEmpty)
                  Image.network(
                    widget.imageUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Icon(Icons.broken_image_outlined, color: Colors.grey.shade300),
                  )
                else
                  Icon(Icons.add_a_photo_outlined, color: Colors.grey.shade400, size: 28),
                if (_uploading)
                  Container(
                    color: Colors.black.withValues(alpha: 0.35),
                    child: const Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                      ),
                    ),
                  ),
                Positioned(
                  right: 4,
                  bottom: 4,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(color: primary, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                    child: const Icon(Icons.edit, size: 11, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 11.5)),
          ),
      ],
    );
  }
}
