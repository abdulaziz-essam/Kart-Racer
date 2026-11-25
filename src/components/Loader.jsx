import { useProgress } from '@react-three/drei'

const Loader = () => {
  const { progress, active } = useProgress()
  if (!active) return null
  return (
    <div className="loading">
      <div>Loading track… {Math.round(progress)}%</div>
    </div>
  )
}

export default Loader
