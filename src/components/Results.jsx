import { RACERS } from '../game/constants'

const ordinalSuffix = (n) => ['th', 'st', 'nd', 'rd'][n] || 'th'

const Results = ({ results, onRestart }) => {
  const finishedNames = new Set(results.map((r) => r.name))
  const waiting = RACERS.filter((r) => !finishedNames.has(r.name))
  const me = results.findIndex((r) => r.player) + 1
  return (
    <div className="results">
      <div className="card">
        <h1>{me === 1 ? '🏆 You win!' : me ? `You finished ${me}${ordinalSuffix(me)}` : 'Race over'}</h1>
        <ol>
          {results.map((r, i) => (
            <li key={r.name} className={r.player ? 'me' : ''}>
              <span className="n">{i + 1}</span>
              <i style={{ background: r.paint || '#1239d6' }} />
              {r.name}
              <b>{r.time.toFixed(2)}s</b>
            </li>
          ))}
          {waiting.map((r) => (
            <li key={r.name} className="wait">
              <span className="n">–</span>
              <i style={{ background: r.paint || '#1239d6' }} />
              {r.name}
              <b>racing…</b>
            </li>
          ))}
        </ol>
        <button onClick={onRestart}>Race again</button>
      </div>
    </div>
  )
}

export default Results
