import { Component, eventListener } from '@a11d/lit'

/** A component whose focus goes to the native control in its shadow root. */
export abstract class Control extends Component {
	static override readonly shadowRootOptions: ShadowRootInit = { ...Component.shadowRootOptions, delegatesFocus: true }

	private readonly internals = this.attachInternals()

	// A dialog looks for its autofocus delegate when it opens, which can be before this control has rendered one.
	protected override initialized() {
		if (this.autofocus) {
			this.focus()
		}
	}

	// `:focus-visible` stops at the shadow root, so a context that draws the ring around the control (the entry
	// editor's rows) reads `:state(focus-visible)` on the host instead.
	@eventListener('focusin')
	@eventListener('focusout')
	protected handleFocusChange(e: FocusEvent) {
		const visible = e.type === 'focusin' && !!(this.renderRoot as ShadowRoot).activeElement?.matches(':focus-visible')
		this.internals.states[visible ? 'add' : 'delete']('focus-visible')
	}
}
