import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_exception.dart';
import '../data/contact_api.dart';
import '../data/contact_models.dart';
import 'contact/tutorial_sheet.dart';

const _kOtherSubject = '__OTHER__';

const _kSocialIcons = {
  'WHATSAPP': Icons.chat_bubble_outline,
  'TELEGRAM': Icons.send_outlined,
  'PHONE': Icons.phone_outlined,
  'EMAIL': Icons.email_outlined,
  'OTHER': Icons.public,
};

/// Miroir de ContactPage.jsx. Jamais requireActiveStore côté serveur : un
/// compte sans boutique active peut aussi contacter la plateforme (utilisé
/// à la fois depuis l'espace compte et l'espace boutique, comme sur le web).
class ContactPage extends StatefulWidget {
  const ContactPage({super.key});

  @override
  State<ContactPage> createState() => _ContactPageState();
}

class _ContactPageState extends State<ContactPage> {
  List<String> _categories = [];
  String? _subjectChoice;
  final _customSubjectController = TextEditingController();
  final _messageController = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _success;

  List<SocialLink>? _links;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _loadLinks();
  }

  @override
  void dispose() {
    _customSubjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await context.read<ContactApi>().getSubjectCategories();
      if (!mounted) return;
      setState(() {
        _categories = categories;
        _subjectChoice = categories.isNotEmpty ? categories.first : _kOtherSubject;
      });
    } on ApiException catch (_) {
      // Silencieux : un menu vide reste utilisable via "Autre".
      if (mounted) setState(() => _subjectChoice = _kOtherSubject);
    }
  }

  Future<void> _loadLinks() async {
    try {
      final links = await context.read<ContactApi>().getSocialLinks();
      if (!mounted) return;
      setState(() => _links = links);
    } on ApiException catch (_) {
      // Section communauté simplement absente si le chargement échoue.
      if (mounted) setState(() => _links = []);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _success = null;
    });

    final subject = _subjectChoice == _kOtherSubject ? _customSubjectController.text.trim() : _subjectChoice ?? '';
    if (subject.isEmpty) {
      setState(() => _error = "Précisez l'objet de votre message.");
      return;
    }
    if (_messageController.text.trim().isEmpty) {
      setState(() => _error = "Décrivez votre demande avant de l'envoyer.");
      return;
    }

    setState(() => _submitting = true);
    try {
      await context.read<ContactApi>().createMessage(subject: subject, message: _messageController.text.trim());
      if (!mounted) return;
      setState(() {
        _success = 'Votre message a bien été envoyé — nous reviendrons vers vous rapidement.';
        _messageController.clear();
        _customSubjectController.clear();
        _subjectChoice = _categories.isNotEmpty ? _categories.first : _kOtherSubject;
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        Row(
          children: [
            Icon(Icons.help_outline, color: Theme.of(context).colorScheme.primary, size: 22),
            const SizedBox(width: 10),
            const Expanded(child: Text('Contactez-nous', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18))),
            OutlinedButton.icon(
              onPressed: () => showTutorialSheet(context),
              icon: const Icon(Icons.school_outlined, size: 16),
              label: const Text('Tutoriel', style: TextStyle(fontSize: 12)),
              style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Une question, un problème, une suggestion ? Écrivez-nous directement depuis cet écran.',
          style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              if (_success != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_success!, style: TextStyle(color: Colors.green.shade800, fontSize: 12.5)),
                ),
              DropdownButtonFormField<String>(
                initialValue: _subjectChoice,
                decoration: const InputDecoration(labelText: 'Objet', border: OutlineInputBorder(), isDense: true),
                items: [
                  for (final c in _categories) DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis)),
                  const DropdownMenuItem(value: _kOtherSubject, child: Text('Autre')),
                ],
                onChanged: (value) => setState(() => _subjectChoice = value),
              ),
              if (_subjectChoice == _kOtherSubject) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _customSubjectController,
                  decoration: const InputDecoration(labelText: "Précisez l'objet", hintText: 'Votre objet', border: OutlineInputBorder(), isDense: true),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: _messageController,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Votre message',
                  hintText: 'Décrivez votre problème ou votre question...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Envoi...' : 'Envoyer'),
              ),
            ],
          ),
        ),
        if (_links != null && _links!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.groups_outlined, color: Colors.indigo.shade400, size: 18),
                    const SizedBox(width: 8),
                    const Text('Rejoignez la communauté', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                  ],
                ),
                const SizedBox(height: 12),
                for (final link in _links!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      onTap: () => launchUrl(Uri.parse(link.url), mode: LaunchMode.externalApplication),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
                        child: Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(10)),
                              child: Icon(_kSocialIcons[link.iconKey] ?? Icons.public, size: 17, color: Colors.grey.shade700),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(link.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
