/**
 * Les questions suggérées par le chat, selon le profil et la langue.
 *
 * Un clic les ENVOIE : chacune a donc été passée par la vraie recherche du
 * chat, sans appel au modèle (backend, `scripts/eval/comparer_mistral.py
 * --dry-run --questions-libres`, le 2026-10-11), et n'est gardée que si les
 * premiers extraits viennent du bon texte. Le corpus n'a ni Code du travail
 * ni Actes uniformes OHADA : « Licenciement abusif » et « Création
 * d'entreprise », les anciennes puces, n'y trouvaient pas de réponse.
 *
 * Textes visés : Code pénal (loi 2016/007), Constitution (loi 96/06), état
 * civil (loi 2024/016), données personnelles (loi 2024/017), enseignement
 * supérieur (loi 2023/007), Code des marchés publics (décret 2018/366),
 * incitations à l'investissement (ordonnance 2025/002), fiscalité locale (loi
 * 2024/020).
 *
 * Seuls des imports de type : le spec e2e importe ce fichier directement.
 */

import type { Language } from '$lib/stores/language';
import type { Persona } from '$lib/stores/persona';

type CleSuggestions = Persona | 'general';

export const SUGGESTIONS: Record<Language, Record<CleSuggestions, readonly string[]>> = {
  fr: {
    citoyen: [
      "Comment déclarer la naissance d'un enfant ?",
      'Quelles sont les sanctions du harcèlement sexuel ?',
      'Quand peut-on invoquer la légitime défense ?',
      'Quels droits ai-je sur mes données personnelles ?',
    ],
    'étudiant': [
      "Comment la loi pénale s'applique-t-elle dans le temps ?",
      'Quelle différence entre tentative et complicité en droit pénal ?',
      'Comment est élu le Président de la République ?',
      "Quels droits la loi d'orientation de l'enseignement supérieur reconnaît-elle aux étudiants ?",
    ],
    avocat: [
      "Quels sont les éléments constitutifs de l'abus de confiance ?",
      'Quels sont les éléments constitutifs de la corruption ?',
      "Quelles voies de recours contre l'attribution d'un marché public ?",
      'À quelles conditions un transfert de données personnelles hors du Cameroun est-il permis ?',
    ],
    entrepreneur: [
      'Quelles incitations fiscales pour un nouvel investissement au Cameroun ?',
      'Quelles obligations la loi sur les données personnelles impose-t-elle à une entreprise ?',
      "Comment se déroule un appel d'offres pour un marché public ?",
      'Qui doit payer la patente et comment est-elle calculée ?',
    ],
    general: [
      "Comment déclarer la naissance d'un enfant ?",
      'Quelles sanctions pour la corruption ?',
      'Quelles incitations pour investir au Cameroun ?',
    ],
  },
  en: {
    citoyen: [
      "How do I register a child's birth?",
      'What are the penalties for sexual harassment?',
      'When can self-defence be invoked?',
      'What rights do I have over my personal data?',
    ],
    'étudiant': [
      'How does criminal law apply over time?',
      'What is the difference between attempt and complicity in criminal law?',
      'How is the President of the Republic elected?',
      'What rights does the higher education orientation law give students?',
    ],
    avocat: [
      'What are the constituent elements of breach of trust?',
      'What are the constituent elements of corruption?',
      'What remedies are available against the award of a public contract?',
      'Under what conditions may personal data be transferred outside Cameroon?',
    ],
    entrepreneur: [
      'What tax incentives apply to a new investment in Cameroon?',
      'What obligations does the personal data law place on a business?',
      'How does a public procurement tender work?',
      'Who must pay the business licence tax, and how is it calculated?',
    ],
    general: [
      "How do I register a child's birth?",
      'What are the penalties for corruption?',
      'What incentives exist for investing in Cameroon?',
    ],
  },
};

/** Les suggestions d'un profil (`null` : profil général) dans une langue. */
export function suggestionsPour(persona: Persona | null, langue: Language): readonly string[] {
  return SUGGESTIONS[langue][persona ?? 'general'];
}
