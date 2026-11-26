import { useProfile, CARS, UPGRADES } from '../game/profile'
import { useHub } from './hubStore'

// DOM overlay for the paddock: coins, crosshair, "Press E" prompt, toasts, and
// a start panel while the mouse isn't captured (click it to walk around).

export default function HubHud({ raceLabel }) {
  const profile = useProfile()
  const { prompt, toast, locked } = useHub()
  const car = CARS.find((c) => c.id === profile.car)
  return (
    <div className="hub-hud">
      <div className="panel coins"><i className="coin" />{profile.coins}<small>COINS</small></div>
      <div className="panel garage">
        <div><span>CAR</span><b>{car?.name}</b></div>
        <div><span>PAINT</span><b>{profile.paint}</b></div>
        {UPGRADES.map((u) => <div key={u.id}><span>{u.name.toUpperCase()}</span><b>{'■'.repeat(profile.upgrades[u.id])}{'□'.repeat(3 - profile.upgrades[u.id])}</b></div>)}
      </div>
      {locked && <div className="crosshair" />}
      {locked && prompt && <div className="prompt">{prompt}</div>}
      {toast && <div className={`hub-toast ${toast.good ? 'good' : 'bad'}`}>{toast.text}</div>}
      {!locked && (
        <div className="hub-start">
          <div className="card">
            <h2>The Paddock</h2>
            <p>Spend your race coins before <b>{raceLabel}</b>.</p>
            <ul>
              <li><b>North:</b> showroom: buy or pick your car</li>
              <li><b>West:</b> paint shop</li>
              <li><b>East:</b> upgrades (engine, tyres, boost)</li>
              <li><b>South:</b> walk through the Race Gate to race</li>
            </ul>
            <p className="keys">WASD walk · mouse look · Shift run · <b>E</b> buy / select · Esc frees the mouse</p>
            <button id="hub-lock">Click to walk around ▶</button>
          </div>
        </div>
      )}
    </div>
  )
}
