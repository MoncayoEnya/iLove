import { FiHeart } from 'react-icons/fi'

const SIZES = {
  sm: { box: 'w-6 h-6', icon: 12 },
  md: { box: 'w-8 h-8', icon: 15 },
  lg: { box: 'w-[34px] h-[34px]', icon: 16 },
}

export default function Logo({ size = 'md', className = '' }) {
  const { box, icon } = SIZES[size] || SIZES.md
  return (
    <div
      className={`${box} rounded-full bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep flex-shrink-0 ${className}`}
    >
      <FiHeart size={icon} strokeWidth={2.4} fill="currentColor" />
    </div>
  )
}
