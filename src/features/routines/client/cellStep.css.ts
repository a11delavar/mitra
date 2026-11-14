import { css } from '@a11d/lit'
import { evenStep } from '#design'

/**
 * How far one cell of a routine's strip or grid is from the next: a cell at least 8px across and its gap, a whole even step,
 * so every cell starts at the same place within a screen pixel and paints like the next on any screen.
 */
export const cellStep = css`round(up, 10px, ${evenStep})`
