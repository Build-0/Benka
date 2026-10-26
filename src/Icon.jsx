import { PATHS } from './iconpaths.js'

export default function Icon({ n, className = '' }) {
  return (
    <svg
      className={'ti ' + className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[n] || '' }}
    />
  )
}
