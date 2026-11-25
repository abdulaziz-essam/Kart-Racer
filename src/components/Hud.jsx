import { LAPS } from '../game/constants'

const Hud = ({ hud, phase }) => {
  const bind = (key) => (el) => { hud.current[key] = el }
  return (
    <div className={`hud ${phase}`}>
      <div className="panel pos" ref={bind('pos')}>4<sup>th</sup><small>/6</small></div>
      <div className="panel lap">
        <div><span>LAP</span><b ref={bind('lap')}>1/{LAPS}</b></div>
        <div><span>TIME</span><b ref={bind('time')}>0.00</b></div>
        <div><span>BEST LAP</span><b ref={bind('best')}>--</b></div>
      </div>
      <ol className="panel board" ref={bind('board')} />
      <div className="big" ref={bind('big')} />
      <div className="toast" ref={bind('surface')} />
      <div className="panel speed"><span ref={bind('speed')}>0</span><small>KM/H</small></div>
      <div className="panel help">W/↑ drive · S/↓ brake · A D/← → steer · hold SPACE to drift, release to boost · R respawn</div>
    </div>
  )
}

export default Hud
