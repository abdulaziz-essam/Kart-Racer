import { LAPS } from '../game/constants'

const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th')

export function updateHud({ hudElements, field, finishOrderCache, player, playerKart, raceState, currentLap, racing }) {
  if (hudElements.speed && raceState.hudT > 0.06) {
    raceState.hudT = 0
    finishOrderCache.current = [...field].sort((a, b) => {
      if (a.st.finished && b.st.finished) return a.st.finishTime - b.st.finishTime
      if (a.st.finished !== b.st.finished) return a.st.finished ? -1 : 1
      return b.st.progress - a.st.progress
    })
    const playerPlace = finishOrderCache.current.indexOf(player) + 1
    hudElements.speed.textContent = Math.round(Math.abs(playerKart.speed) * 3.6)
    hudElements.pos.innerHTML = `${playerPlace}<sup>${ordinal(playerPlace).slice(String(playerPlace).length)}</sup><small>/${field.length}</small>`
    hudElements.lap.textContent = `${currentLap}/${LAPS}`
    hudElements.time.textContent = racing ? ((playerKart.finished ? playerKart.finishTime : raceState.t - raceState.raceStart)).toFixed(2) : '0.00'
    hudElements.best.textContent = raceState.best == null ? '--' : raceState.best.toFixed(2)
    hudElements.surface.textContent = playerKart.boost > 0 ? '🔥 BOOST!' : playerKart.drifting ? (playerKart.driftTime > 0.8 ? '✨ Release to boost!' : '💨 Drifting…') : playerKart.surface === 'grass' ? '🌱 Off track!' : ''
    hudElements.surface.style.opacity = hudElements.surface.textContent ? 1 : 0
    let bigMessage = ''
    if (raceState.phase === 'countdown') bigMessage = raceState.t < 0.6 ? '' : String(Math.max(1, 3 - Math.floor((raceState.t - 0.6) / 1.2)))
    else if (playerKart.finished) bigMessage = 'FINISH!'
    else if (raceState.t - raceState.raceStart < 1) bigMessage = 'GO!'
    else if (raceState.flash && raceState.t < raceState.flash.until) bigMessage = raceState.flash.text
    if (hudElements.big.textContent !== bigMessage) { hudElements.big.textContent = bigMessage; hudElements.big.classList.remove('pop'); void hudElements.big.offsetWidth; if (bigMessage) hudElements.big.classList.add('pop') }
    hudElements.board.innerHTML = finishOrderCache.current.map((racer, i) => `<li class="${racer.player ? 'me' : ''}"><i style="background:${racer.paint || '#1239d6'}"></i>${i + 1}. ${racer.name}</li>`).join('')
  }
}
