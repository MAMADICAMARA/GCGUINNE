/// Modèle Notes — miroir de notes.service.js (§19_notes_boutique.sql).
library;

const kNoteColors = ['yellow', 'blue', 'green', 'pink', 'gray'];

class Note {
  const Note({
    required this.id,
    required this.title,
    required this.content,
    required this.color,
    required this.isPinned,
    required this.createdAt,
    required this.updatedAt,
    required this.authorName,
  });

  factory Note.fromJson(Map<String, dynamic> json) => Note(
        id: json['id'] as int,
        title: json['title'] as String?,
        content: json['content'] as String,
        color: json['color'] as String? ?? 'yellow',
        isPinned: json['isPinned'] as bool? ?? false,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
        authorName: json['authorName'] as String?,
      );

  final int id;
  final String? title;
  final String content;
  final String color;
  final bool isPinned;
  final String? createdAt;
  final String? updatedAt;
  final String? authorName;
}
