/**
 * Formatage et nettoyage des immatriculations selon les normes du Bénin (ANATT).
 *
 * Exemples de formats officiels Bénin :
 * - Format moderne : AQ 1234 RB
 * - Format avec série : 1 A 1234 RB
 * - Format alternatif : 1234 RB / 9876-RB-BJ
 *
 * Règle de saisie :
 * - Tout en MAJUSCULES.
 * - Autorise A-Z, 0-9, espaces et tirets (-).
 */
export function formatBeninLicensePlate(text: string): string {
  if (!text) return '';
  return text.toUpperCase().replace(/[^A-Z0-9\s-]/g, '');
}
