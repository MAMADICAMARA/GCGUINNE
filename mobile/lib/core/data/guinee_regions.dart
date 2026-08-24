/// Miroir de frontend/src/data/guineeRegions.js — référentiel des 8 régions
/// administratives de Guinée et de leurs préfectures (utilisées comme
/// "villes" pour la création de boutique). Utile pour la Guinée uniquement
/// — pour un autre pays, région et ville redeviennent des champs texte
/// libres (cf. my_store_page.dart).
const Map<String, List<String>> kGuineeRegions = {
  'Boké': ['Boké', 'Boffa', 'Fria', 'Gaoual', 'Koundara'],
  'Conakry': ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'],
  'Faranah': ['Faranah', 'Dabola', 'Dinguiraye', 'Kissidougou'],
  'Kankan': ['Kankan', 'Kérouané', 'Kouroussa', 'Mandiana', 'Siguiri'],
  'Kindia': ['Kindia', 'Coyah', 'Dubréka', 'Forécariah', 'Télimélé'],
  'Labé': ['Labé', 'Koubia', 'Lélouma', 'Mali', 'Tougué'],
  'Mamou': ['Mamou', 'Dalaba', 'Pita'],
  "N'Zérékoré": ["N'Zérékoré", 'Beyla', 'Guéckédou', 'Lola', 'Macenta', 'Yomou'],
};

final List<String> kGuineeRegionNames = kGuineeRegions.keys.toList();

/// Liste restreinte de pays pour l'instant (marché initial de la plateforme).
const List<String> kCountries = ['Guinée', "Côte d'Ivoire", 'Sénégal', 'Mali', 'Autre'];
