import type { FC } from 'react'
import classNames from 'classnames'
import style from './style.module.css'

export type AppIconProps = {
  size?: 'xs' | 'tiny' | 'small' | 'medium' | 'large'
  rounded?: boolean
  icon?: string
  background?: string
  className?: string
}

const AppIcon: FC<AppIconProps> = ({
  size = 'medium',
  rounded = false,
  background,
  className,
}) => {
  return (
    <span
      className={classNames(
        style.appIcon,
        size !== 'medium' && style[size],
        rounded && style.rounded,
        className ?? '',
      )}
      style={{
        background,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" fill="none">
        <circle cx="25" cy="25" r="25" fill="#CAF53D" />
        <path fill="#24868F" fill-rule="evenodd" d="M25 44.57C14.19 44.57 5.43 35.81 5.43 25S14.19 5.43 25 5.43 44.57 14.19 44.57 25 35.81 44.57 25 44.57Zm18.33-18.96h-4.27a.61.61 0 0 1 0-1.22h4.27c-.32-9.65-8.08-17.41-17.73-17.73v4.27a.61.61 0 0 1-1.22 0V6.66c-9.65.32-17.41 8.08-17.73 17.73h4.27a.61.61 0 0 1 0 1.22H6.66c.32 9.65 8.08 17.41 17.73 17.73v-4.27a.61.61 0 0 1 1.22 0v4.27c9.65-.32 17.41-8.08 17.73-17.73ZM28.9 20.76a.61.61 0 0 1 .32.31l6.12 13.46c.23.51-.3 1.04-.81.81l-13.46-6.12a.61.61 0 0 1-.31-.32l-6.12-13.46c-.23-.51.3-1.04.81-.81l13.46 6.12Zm-.43 1.62-6.09 6.09 11.17 5.08-5.08-11.17Zm-.87-.87-11.17-5.08 5.08 11.17 6.09-6.09Z" clip-rule="evenodd" />
      </svg>
    </span>
  )
}

export default AppIcon
