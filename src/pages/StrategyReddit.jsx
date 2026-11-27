import { Link } from 'react-router-dom'
import RedditListeningPlan from '../components/strategy/RedditListeningPlan'
import './education.css'

export default function StrategyReddit() {
  return (
    <div className="education-shell mx-auto flex max-w-7xl gap-6">
      <div className="min-w-0 w-full max-w-4xl flex-1 px-6 py-6">
        <Link to="/strategy" className="inline-flex items-center text-sm font-medium text-brand-orange hover:underline">
          Strategy 2027
        </Link>
        <RedditListeningPlan />
      </div>
    </div>
  )
}
