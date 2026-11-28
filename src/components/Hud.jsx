import { LAPS } from '../game/constants'
import { RoughBox } from './sketch/RoughBox'

// In-race HUD in the game's hand-drawn style: rough.js paper panels with
// handwritten text. Values are written straight into the DOM by updateHud().

const Hud = ({ hud, phase, race }) => {
  const bind = (key) => (el) => { hud.current[key] = el }
  return (
    <div className={`hud sketchy ${phase}`}>
      <RoughBox className="panel pos" seed={11}><span ref={bind('pos')}>4<sup>th</sup><small>/6</small></span></RoughBox>
      <RoughBox className="panel lap" seed={12}>
        {race && <div><span>Race</span><b>{race}</b></div>}
        <div><span>Lap</span><b ref={bind('lap')}>1/{LAPS}</b></div>
        <div><span>Time</span><b ref={bind('time')}>0.00</b></div>
        <div><span>Best lap</span><b ref={bind('best')}>--</b></div>
      </RoughBox>
      <RoughBox className="panel board" seed={13}><ol ref={bind('board')} /></RoughBox>
      <div className="big" ref={bind('big')} />
      <div className="toast" ref={bind('surface')} />
      <RoughBox className="panel speed" seed={14} fill="#fff3c4"><span ref={bind('speed')}>0</span><small>km/h</small></RoughBox>
      <RoughBox className="panel help" seed={15}>W/↑ drive · S/↓ brake · A D/← → steer · SPACE drift → boost · R respawn · <b>Esc</b> pause</RoughBox>
    </div>
  )
}

export default Hud
