/**
 * Formatage des numéros de téléphone locaux avec espaces selon le pays (Frontend uniquement).
 * Le backend reçoit toujours le numéro nettoyé sans espaces (+22997000000).
 */

export function formatPhoneNumber(rawText: string, countryCode: string = 'BJ'): string {
  if (!rawText) return '';
  
  // Conserver uniquement les chiffres
  const digits = rawText.replace(/\D/g, '');
  if (!digits) return '';

  if (countryCode === 'SN') {
    // Sénégal (9 chiffres) : 77 123 45 67
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 5));
    if (digits.length > 5) parts.push(digits.slice(5, 7));
    if (digits.length > 7) parts.push(digits.slice(7, 9));
    return parts.join(' ');
  }

  if (countryCode === 'CM') {
    // Cameroun (9 chiffres) : 6 70 12 34 56
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 1));
    if (digits.length > 1) parts.push(digits.slice(1, 3));
    if (digits.length > 3) parts.push(digits.slice(3, 5));
    if (digits.length > 5) parts.push(digits.slice(5, 7));
    if (digits.length > 7) parts.push(digits.slice(7, 9));
    return parts.join(' ');
  }

  if (countryCode === 'NG') {
    // Nigeria (10 chiffres) : 0801 234 5678
    const parts = [];
    if (digits.length > 0) parts.push(digits.slice(0, 4));
    if (digits.length > 4) parts.push(digits.slice(4, 7));
    if (digits.length > 7) parts.push(digits.slice(7, 11));
    return parts.join(' ');
  }

  // Par défaut (Bénin, Togo, Côte d'Ivoire, Burkina Faso, Niger, Gabon, France, etc.) :
  // Paquets de 2 chiffres (ex: 01 95 95 95 95 ou 97 00 00 00)
  const parts = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(' ');
}

export function cleanPhoneNumber(formattedText: string): string {
  return formattedText.replace(/\D/g, '');
}
