import './choiceButton.css'

export function ChoiceButton(props: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      className="choiceButton"
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.label}
    </button>
  )
}
