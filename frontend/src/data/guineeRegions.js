/**
 * Référentiel des 8 régions administratives de Guinée et de leurs
 * préfectures (utilisées ici comme "villes" pour la création de boutique).
 *
 * Remarque : ce référentiel est utile pour la Guinée uniquement. Si un
 * autre pays est sélectionné dans le formulaire, région et ville
 * redeviennent des champs texte libres (cf. StoreLocationFields.jsx).
 */
export const GUINEE_REGIONS = {
  Boké: ['Boké', 'Boffa', 'Fria', 'Gaoual', 'Koundara'],
  Conakry: ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'],
  Faranah: ['Faranah', 'Dabola', 'Dinguiraye', 'Kissidougou'],
  Kankan: ['Kankan', 'Kérouané', 'Kouroussa', 'Mandiana', 'Siguiri'],
  Kindia: ['Kindia', 'Coyah', 'Dubréka', 'Forécariah', 'Télimélé'],
  Labé: ['Labé', 'Koubia', 'Lélouma', 'Mali', 'Tougué'],
  Mamou: ['Mamou', 'Dalaba', 'Pita'],
  "N'Zérékoré": ["N'Zérékoré", 'Beyla', 'Guéckédou', 'Lola', 'Macenta', 'Yomou'],
};

export const GUINEE_REGION_NAMES = Object.keys(GUINEE_REGIONS);

/** Liste restreinte de pays pour l'instant (marché initial de la plateforme). */
export const COUNTRIES = ['Guinée', "Côte d'Ivoire", 'Sénégal', 'Mali', 'Autre'];