import { useEffect } from 'react'

/**
 * Sets document.title to `{title} | CineConnect` and optionally sets meta tags.
 * Pass undefined to just show `CineConnect`.
 */
export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | CineConnect` : 'CineConnect'

    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]')
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.setAttribute('name', 'description')
        document.head.appendChild(metaDesc)
      }
      metaDesc.setAttribute('content', description)

      let ogDesc = document.querySelector('meta[property="og:description"]')
      if (!ogDesc) {
        ogDesc = document.createElement('meta')
        ogDesc.setAttribute('property', 'og:description')
        document.head.appendChild(ogDesc)
      }
      ogDesc.setAttribute('content', description)
    }

    return () => {
      document.title = 'CineConnect'
    }
  }, [title, description])
}

export const usePageMeta = usePageTitle
