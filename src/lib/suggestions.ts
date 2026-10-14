/**
 * Les questions suggérées par le chat, selon le profil et la langue.
 *
 * Un clic les ENVOIE : chacune a donc été passée par la vraie recherche du
 * chat, sans appel au modèle, puis relue par un juge et contestée par un
 * sceptique sur ses 8 extraits réels (2026-10-14, trois tours). Elle n'est
 * gardée que si les premiers extraits viennent du bon texte, en vigueur.
 *
 * Textes visés : Code du travail (loi 92/007), Code pénal (loi 2016/007),
 * Code de procédure pénale (loi 2005/007), cybersécurité (loi 2010/012),
 * Actes uniformes OHADA (sociétés et GIE, droit commercial général,
 * recouvrement), incitations à l'investissement (ordonnance 2025/002),
 * Constitution et Code électoral.
 *
 * Écartées faute d'un texte à jour dans le corpus :
 * - la déclaration de naissance : le Code civil ajouté reproduit les règles de
 *   l'ordonnance 81/02, abrogée par la loi 2024/016 (30 jours au lieu de 90) ;
 * - le titre foncier : le décret 76/165 est dans sa rédaction de 1976, sans le
 *   décret n°2005/481 qui réécrit la procédure ;
 * - le capital minimum de la SARL : la loi camerounaise n°2016/014 déroge à
 *   l'Acte uniforme et n'est pas dans le corpus ;
 * - la patente en anglais : « business licence tax » ramène la contribution
 *   des licences, une autre taxe.
 *
 * Seuls des imports de type : le spec e2e importe ce fichier directement.
 */

import type { Language } from '$lib/stores/language';
import type { Persona } from '$lib/stores/persona';

type CleSuggestions = Persona | 'general';

export const SUGGESTIONS: Record<Language, Record<CleSuggestions, readonly string[]>> = {
  fr: {
    citoyen: [
      'Quelles indemnités en cas de licenciement abusif ?',
      "Que risque l'auteur d'une escroquerie sur internet ?",
      'Quels sont mes droits en garde à vue ?',
      'Quand peut-on invoquer la légitime défense ?',
    ],
    'étudiant': [
      'Quelle différence entre tentative et complicité en droit pénal ?',
      'Comment est élu le Président de la République ?',
      "Qu'est-ce qui distingue un contrat de travail à durée déterminée d'un contrat à durée indéterminée ?",
      "Qu'est-ce qu'un groupement d'intérêt économique ?",
    ],
    avocat: [
      "Quels sont les éléments constitutifs de l'abus de confiance ?",
      "Quelles peines pour l'accès non autorisé à un système d'information ?",
      'Comment former opposition à une injonction de payer en droit OHADA ?',
      'Quelle est la durée maximale de la garde à vue ?',
    ],
    entrepreneur: [
      "Quels avantages fiscaux l'ordonnance de 2025 accorde-t-elle à un nouvel investissement ?",
      'Quelles pièces justificatives pour immatriculer une société commerciale ?',
      "Quelles obligations pour l'employeur lors d'une embauche ?",
      'Comment obtenir une injonction de payer pour une facture impayée ?',
    ],
    general: [
      'Quelles indemnités en cas de licenciement abusif ?',
      'Quels sont mes droits en garde à vue ?',
      "Que risque l'auteur d'une escroquerie sur internet ?",
    ],
  },
  en: {
    citoyen: [
      'What compensation is due for unfair dismissal?',
      'What does the Penal Code say about obtaining money by false pretences on the internet?',
      'What are my rights in police custody?',
      'When can self-defence be invoked?',
    ],
    'étudiant': [
      'What is the difference between attempt and complicity in criminal law?',
      'How is the President of the Republic elected?',
      'What distinguishes a fixed-term employment contract from an open-ended one?',
      'What is an economic interest group under OHADA law?',
    ],
    avocat: [
      'What are the constituent elements of the offence of breach of trust under the Penal Code?',
      'How does the law punish unauthorised access to a computer system?',
      'How is an OHADA injunction to pay obtained and opposed?',
      'What is the maximum length of police custody?',
    ],
    entrepreneur: [
      'What tax incentives does the 2025 investment incentives ordinance grant to a new investment?',
      'How do I register a company in the trade and personal property credit register?',
      "What are the employer's obligations when hiring under the Labour Code?",
      'How can I make a customer pay an unpaid invoice?',
    ],
    general: [
      'What compensation is due for unfair dismissal?',
      'What are my rights in police custody?',
      'What does the Penal Code say about obtaining money by false pretences on the internet?',
    ],
  },
};

/** Les suggestions d'un profil (`null` : profil général) dans une langue. */
export function suggestionsPour(persona: Persona | null, langue: Language): readonly string[] {
  return SUGGESTIONS[langue][persona ?? 'general'];
}
