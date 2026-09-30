import type { Modifier } from '@dnd-kit/core';

/** Verschieben nur vertikal (ersetzt @dnd-kit/modifiers). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });
