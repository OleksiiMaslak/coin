import '../styles/resultPopup.css'

/**
 * Lightweight toast-style status message (used for results and errors).
 */
export function ResultPopup(props: { visible: boolean; message: string | null }) {
  return (
    <div className={`popupRoot ${props.visible ? 'popupVisible' : ''}`} aria-live="polite">
      <div className="popupCard" role="status">
        {props.message ?? ''}
      </div>
    </div>
  )
}
