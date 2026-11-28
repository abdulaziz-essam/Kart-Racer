import { RoughBox, RoughButton } from './sketch/RoughBox'

// Hand-drawn pause menu (Esc during a race or on the Test Track).
export default function PauseMenu({ practice, onResume, onRestart, onQuit }) {
  return (
    <div className="pause" role="dialog" aria-label="Paused">
      <RoughBox className="card" seed={21}>
        <h2>Paused</h2>
        <p>{practice ? 'Test Track · practice laps' : 'The other racers are waiting…'}</p>
        <RoughButton onClick={onResume} autoFocus seed={22}>Resume ▶</RoughButton>
        <RoughButton onClick={onRestart} fill="#9ad17a" seed={23}>{practice ? 'Reset lap ↺' : 'Restart race ↺'}</RoughButton>
        <RoughButton onClick={onQuit} fill="#cfe8ff" seed={24}>Back to the map 🗺</RoughButton>
      </RoughBox>
    </div>
  )
}
