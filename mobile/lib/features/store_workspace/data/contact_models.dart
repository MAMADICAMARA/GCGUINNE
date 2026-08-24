/// Modèles Contactez-nous — miroir de contact.service.js.
library;

class SocialLink {
  const SocialLink({required this.id, required this.label, required this.url, required this.iconKey});

  factory SocialLink.fromJson(Map<String, dynamic> json) => SocialLink(
        id: json['id'] as int,
        label: json['label'] as String,
        url: json['url'] as String,
        iconKey: json['iconKey'] as String? ?? 'OTHER',
      );

  final int id;
  final String label;
  final String url;
  final String iconKey;
}

class TutorialVideo {
  const TutorialVideo({required this.id, required this.title, required this.url});

  factory TutorialVideo.fromJson(Map<String, dynamic> json) => TutorialVideo(
        id: json['id'] as int,
        title: json['title'] as String,
        url: json['url'] as String,
      );

  final int id;
  final String title;
  final String url;
}
