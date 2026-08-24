/// Miroir de frontend/src/utils/format.js — mêmes règles d'affichage
/// (GNF sans décimales avec séparateur de milliers, dates JJ/MM/AAAA).
///
/// Formatage écrit à la main plutôt qu'avec `intl`'s NumberFormat/DateFormat
/// en locale 'fr_FR' : ces derniers exigent un appel d'initialisation des
/// données de locale au démarrage (`initializeDateFormatting`), sans quoi
/// ils lèvent une exception à l'exécution — un risque évitable ici puisque
/// le format voulu (JJ/MM/AAAA, espace comme séparateur de milliers) est
/// trivial à reproduire sans dépendance à cet état global.
library;

num? _asNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

DateTime? _asLocalDate(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.toLocal();
  final parsed = DateTime.tryParse(value.toString());
  return parsed?.toLocal();
}

String _pad2(int n) => n.toString().padLeft(2, '0');

/// 450000 -> "450 000 GNF". Retourne "—" si la valeur est absente/invalide.
String formatGNF(Object? amount) {
  final value = _asNum(amount);
  if (value == null) return '—';
  final rounded = value.round();
  final isNegative = rounded < 0;
  final digits = rounded.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return '${isNegative ? '-' : ''}$buffer GNF';
}

/// "2026-08-11T00:00:00.000Z" -> "11/08/2026". Retourne "—" si absent/invalide.
String formatDate(Object? value) {
  final date = _asLocalDate(value);
  if (date == null) return '—';
  return '${_pad2(date.day)}/${_pad2(date.month)}/${date.year}';
}

/// Idem formatDate, avec l'heure locale en plus ("11/08/2026 14:32").
String formatDateTime(Object? value) {
  final date = _asLocalDate(value);
  if (date == null) return '—';
  return '${formatDate(date)} ${_pad2(date.hour)}:${_pad2(date.minute)}';
}
