import { useEffect } from 'react'

/**
 * Sets document.title to `{title} | CineConnect`.
 * Pass undefined to just show `CineConnect`.
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | CineConnect` : 'CineConnect'
    return () => { document.title = 'CineConnect' }
  }, [title])
}
