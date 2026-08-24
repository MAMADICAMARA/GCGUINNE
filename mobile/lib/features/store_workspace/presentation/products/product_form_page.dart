import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/catalog_api.dart';
import '../../data/pos_models.dart';
import '../../data/products_api.dart';
import 'image_picker_field.dart';

class _AttributeRow {
  _AttributeRow({this.key = '', this.value = ''});
  String key;
  String value;
}

class _TierRow {
  _TierRow({this.minQuantity = '', this.unitPrice = ''});
  String minQuantity;
  String unitPrice;
}

/// Miroir de ProductForm.jsx — création/édition d'un produit. Page à part
/// entière plutôt qu'une feuille modale : c'est un long formulaire à
/// plusieurs sections, plus confortable à faire défiler et à revenir en
/// arrière dessus (bouton retour natif) que dans une modale.
///
/// Sections volontairement séparées et titrées (Informations, Prix &
/// stock, Prix dégressif, Photo) plutôt qu'une liste plate de champs — un
/// formulaire long est plus facile à comprendre pour un public peu
/// technophile quand sa structure est visible d'un coup d'œil.
class ProductFormPage extends StatefulWidget {
  const ProductFormPage({super.key, this.product});

  final Product? product;

  @override
  State<ProductFormPage> createState() => _ProductFormPageState();
}

class _ProductFormPageState extends State<ProductFormPage> {
  bool get _isEdit => widget.product != null;

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _referenceController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _purchasePriceController;
  late final TextEditingController _sellingPriceController;
  late final TextEditingController _quantityController;
  late final TextEditingController _lowStockController;

  int? _categoryId;
  String? _imageUrl;
  List<ProductCategory> _categories = [];
  bool _loadingCategories = true;

  late List<_AttributeRow> _attributes;
  late List<_TierRow> _tiers;

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _nameController = TextEditingController(text: p?.name ?? '');
    _referenceController = TextEditingController(text: p?.reference ?? '');
    _descriptionController = TextEditingController(text: p?.description ?? '');
    _purchasePriceController = TextEditingController(text: p != null ? _trimNum(p.purchasePrice) : '');
    _sellingPriceController = TextEditingController(text: p != null ? _trimNum(p.sellingPrice) : '');
    _quantityController = TextEditingController(text: p != null ? '${p.quantity}' : '');
    _lowStockController = TextEditingController(text: p != null ? '${p.lowStockThreshold}' : '5');
    _categoryId = p?.categoryId;
    _imageUrl = p?.imageUrl;
    _attributes = p != null && p.attributes.isNotEmpty
        ? p.attributes.entries.map((e) => _AttributeRow(key: e.key, value: e.value)).toList()
        : [_AttributeRow()];
    _tiers = p != null ? p.priceTiers.map((t) => _TierRow(minQuantity: '${t.minQuantity}', unitPrice: _trimNum(t.unitPrice))).toList() : [];
    _loadCategories();
  }

  String _trimNum(num value) => value == value.roundToDouble() ? value.toInt().toString() : value.toString();

  Future<void> _loadCategories() async {
    try {
      final categories = await context.read<CatalogApi>().listCategories();
      if (!mounted) return;
      setState(() {
        _categories = categories;
        _loadingCategories = false;
      });
    } on ApiException {
      if (mounted) setState(() => _loadingCategories = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _referenceController.dispose();
    _descriptionController.dispose();
    _purchasePriceController.dispose();
    _sellingPriceController.dispose();
    _quantityController.dispose();
    _lowStockController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });

    final attributes = <String, String>{};
    for (final row in _attributes) {
      final key = row.key.trim();
      if (key.isNotEmpty) attributes[key] = row.value.trim();
    }

    final priceTiers = <PriceTier>[];
    for (final row in _tiers) {
      final minQty = int.tryParse(row.minQuantity.trim());
      final unitPrice = num.tryParse(row.unitPrice.trim());
      if (minQty != null && unitPrice != null) {
        priceTiers.add(PriceTier(minQuantity: minQty, unitPrice: unitPrice));
      }
    }

    final productsApi = context.read<ProductsApi>();
    try {
      if (_isEdit) {
        await productsApi.update(
          id: widget.product!.id,
          name: _nameController.text.trim(),
          categoryId: _categoryId,
          reference: _referenceController.text.trim().isEmpty ? null : _referenceController.text.trim(),
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
          purchasePrice: num.parse(_purchasePriceController.text),
          sellingPrice: num.parse(_sellingPriceController.text),
          lowStockThreshold: int.tryParse(_lowStockController.text) ?? 0,
          imageUrl: _imageUrl,
          attributes: attributes,
          priceTiers: priceTiers,
        );
      } else {
        await productsApi.create(
          name: _nameController.text.trim(),
          categoryId: _categoryId,
          reference: _referenceController.text.trim().isEmpty ? null : _referenceController.text.trim(),
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
          purchasePrice: num.parse(_purchasePriceController.text),
          sellingPrice: num.parse(_sellingPriceController.text),
          quantity: int.tryParse(_quantityController.text) ?? 0,
          lowStockThreshold: int.tryParse(_lowStockController.text) ?? 0,
          imageUrl: _imageUrl,
          attributes: attributes,
          priceTiers: priceTiers,
        );
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'Modifier le produit' : 'Nouveau produit')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ),
            _FormSection(
              icon: Icons.info_outline,
              title: 'Informations générales',
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Nom du produit', hintText: 'Écran iPhone 13', border: OutlineInputBorder()),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Le nom du produit est requis.' : null,
                ),
                const SizedBox(height: 12),
                _loadingCategories
                    ? const LinearProgressIndicator()
                    : DropdownButtonFormField<int?>(
                        initialValue: _categoryId,
                        decoration: const InputDecoration(labelText: 'Catégorie', border: OutlineInputBorder()),
                        items: [
                          const DropdownMenuItem<int?>(value: null, child: Text('Aucune')),
                          for (final category in _categories) DropdownMenuItem<int?>(value: category.id, child: Text(category.name)),
                        ],
                        onChanged: (value) => setState(() => _categoryId = value),
                      ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _referenceController,
                  decoration: const InputDecoration(
                    labelText: 'Référence (optionnel)',
                    hintText: 'SKU-001',
                    helperText: 'Doit être unique. Pour un modèle partagé entre plusieurs pièces, utilisez un attribut plus bas.',
                    helperMaxLines: 2,
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descriptionController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Description (optionnel)', border: OutlineInputBorder(), alignLabelWithHint: true),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _FormSection(
              icon: Icons.tune,
              title: 'Attributs (optionnel)',
              subtitle: 'Ex : modèle, couleur... Peuvent être partagés entre plusieurs produits.',
              trailing: TextButton(
                onPressed: () => setState(() => _attributes.add(_AttributeRow())),
                child: const Text('+ Ajouter'),
              ),
              children: [
                for (var i = 0; i < _attributes.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            initialValue: _attributes[i].key,
                            decoration: const InputDecoration(hintText: 'Clé (modèle)', isDense: true, border: OutlineInputBorder()),
                            onChanged: (v) => _attributes[i].key = v,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextFormField(
                            initialValue: _attributes[i].value,
                            decoration: const InputDecoration(hintText: 'Valeur (BG6)', isDense: true, border: OutlineInputBorder()),
                            onChanged: (v) => _attributes[i].value = v,
                          ),
                        ),
                        IconButton(
                          onPressed: () => setState(() => _attributes.removeAt(i)),
                          icon: const Icon(Icons.close, size: 18),
                          color: Colors.grey,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            _FormSection(
              icon: Icons.sell_outlined,
              title: 'Prix & stock',
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _purchasePriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: false),
                        decoration: const InputDecoration(labelText: "Prix d'achat (GNF)", border: OutlineInputBorder()),
                        validator: (v) => (num.tryParse(v ?? '') == null) ? 'Requis' : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _sellingPriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: false),
                        decoration: const InputDecoration(labelText: 'Prix de vente (GNF)', border: OutlineInputBorder()),
                        validator: (v) => (num.tryParse(v ?? '') == null) ? 'Requis' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _isEdit
                          ? TextFormField(
                              controller: _quantityController,
                              enabled: false,
                              decoration: const InputDecoration(
                                labelText: 'Stock actuel',
                                helperText: 'Non modifiable ici — utilisez un ajustement de stock.',
                                helperMaxLines: 2,
                                border: OutlineInputBorder(),
                              ),
                            )
                          : TextFormField(
                              controller: _quantityController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(labelText: 'Stock initial', border: OutlineInputBorder()),
                              validator: (v) => (int.tryParse(v ?? '') == null) ? 'Requis' : null,
                            ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _lowStockController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: "Seuil d'alerte", border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            _FormSection(
              icon: Icons.percent,
              title: 'Prix dégressif par quantité (optionnel)',
              subtitle: 'Ex : à partir de 10 unités, 85 000 GNF/unité. Le prix baisse à chaque palier, jamais l\'inverse.',
              trailing: TextButton(
                onPressed: () => setState(() => _tiers.add(_TierRow())),
                child: const Text('+ Palier'),
              ),
              children: [
                for (var i = 0; i < _tiers.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        const Text('Dès', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        const SizedBox(width: 6),
                        SizedBox(
                          width: 60,
                          child: TextFormField(
                            initialValue: _tiers[i].minQuantity,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(hintText: '10', isDense: true, border: OutlineInputBorder()),
                            onChanged: (v) => _tiers[i].minQuantity = v,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text('u. →', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: TextFormField(
                            initialValue: _tiers[i].unitPrice,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(hintText: '85000 GNF/u.', isDense: true, border: OutlineInputBorder()),
                            onChanged: (v) => _tiers[i].unitPrice = v,
                          ),
                        ),
                        IconButton(
                          onPressed: () => setState(() => _tiers.removeAt(i)),
                          icon: const Icon(Icons.close, size: 18),
                          color: Colors.grey,
                        ),
                      ],
                    ),
                  ),
                if (_tiers.isEmpty)
                  Text('Aucun palier — le prix de vente normal s\'applique toujours.', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ],
            ),
            const SizedBox(height: 16),
            _FormSection(
              icon: Icons.photo_camera_outlined,
              title: 'Photo (optionnel)',
              children: [
                ImagePickerField(imageUrl: _imageUrl, onChanged: (url) => setState(() => _imageUrl = url)),
              ],
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            child: Text(_submitting ? 'Enregistrement...' : (_isEdit ? 'Enregistrer' : 'Créer le produit')),
          ),
        ),
      ),
    );
  }
}

class _FormSection extends StatelessWidget {
  const _FormSection({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    required this.children,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 17, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
              if (trailing != null) trailing!,
            ],
          ),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(subtitle!, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
            ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}
