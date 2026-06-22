/**
 * ==============================================================
 * Fichier :
 * index.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';
import { borderRadius } from './radius';

export const theme = {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
};

export type Theme = typeof theme;
