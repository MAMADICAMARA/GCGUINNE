import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/contact_api.dart';
import '../../data/contact_models.dart';

/// Miroir (partiel) de TutorialModal.jsx — vidéos configurées par le Super
/// Admin. Contrairement au web (lecture intégrée via <iframe> pour
/// YouTube/Vimeo), le mobile ouvre toujours la vidéo dans le navigateur/
/// l'appli dédiée — éviter une dépendance WebView pour cette seule
/// fonctionnalité secondaire.
void showTutorialSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (context) => const _TutorialSheet(),
  );
}

class _TutorialSheet extends StatefulWidget {
  const _TutorialSheet();

  @override
  State<_TutorialSheet> createState() => _TutorialSheetState();
}

class _TutorialSheetState extends State<_TutorialSheet> {
  List<TutorialVideo>? _videos;
  String? _error;
  int _activeIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final videos = await context.read<ContactApi>().getTutorialVideos();
      if (!mounted) return;
      setState(() => _videos = videos);
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final videos = _videos;
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Row(
            children: [
              Icon(Icons.school_outlined, color: Theme.of(context).colorScheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text('Tutoriel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 16),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))
          else if (videos == null)
            const Padding(padding: EdgeInsets.symmetric(vertical: 30), child: Center(child: CircularProgressIndicator()))
          else if (videos.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 30),
              child: Center(child: Text("Aucune vidéo tutoriel n'est configurée pour l'instant.", style: TextStyle(color: Colors.grey.shade500))),
            )
          else ...[
            if (videos.length > 1)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (var i = 0; i < videos.length; i++)
                    ChoiceChip(
                      label: Text(videos[i].title, style: const TextStyle(fontSize: 12)),
                      selected: i == _activeIndex,
                      onSelected: (_) => setState(() => _activeIndex = i),
                    ),
                ],
              ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  Text(videos[_activeIndex].title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    onPressed: () => launchUrl(Uri.parse(videos[_activeIndex].url), mode: LaunchMode.externalApplication),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white38)),
                    icon: const Icon(Icons.open_in_new, size: 16),
                    label: Text('Ouvrir "${videos[_activeIndex].title}"', overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
