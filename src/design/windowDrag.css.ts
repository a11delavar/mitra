import { css, unsafeCSS } from '@a11d/lit'

/**
 * Window Controls Overlay titlebar drag region and top-layer overlay exemption styles.
 */
export const windowDragHandle = unsafeCSS`
	-webkit-app-region: drag;

	:where(& *) {
		-webkit-app-region: no-drag;
	}
`

export const windowDragStyles = css`
	@media (display-mode: window-controls-overlay) {
		:where(:popover-open, dialog:open) {
			-webkit-app-region: no-drag;
		}
	}
`
