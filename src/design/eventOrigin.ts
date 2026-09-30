const field = 'input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit], [type=reset], [type=color], [type=file]), textarea, select, [contenteditable]:not([contenteditable=false]), [role=spinbutton], [role=combobox], [role=textbox]'
const control = `${field}, input, button, a[href], [role=button], [role=menuitem], [role=option], [role=switch]`

/** The elements an event passed on its way to the listener, shadow roots included: a component's host would otherwise stand in for the control inside it. */
function path(event: Event) {
	const path = event.composedPath()
	const end = path.indexOf(event.currentTarget!)
	return (end < 0 ? path : path.slice(0, end)).filter(node => node instanceof Element)
}

/** Whether the event started where keys are typed: a text field, or a segment or combobox inside a component. */
export function startedInField(event: Event) {
	return path(event).some(element => element.matches(field))
}

/** Whether the event started on a control (a field, a button, a link), which keeps its clicks and keys to itself. */
export function startedOnControl(event: Event) {
	return path(event).some(element => element.matches(control))
}
