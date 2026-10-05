import { useEffect } from 'react'

/**
 * Head helper for the CineConnect Landing page.
 * Sets title, meta description, Open Graph, Twitter tags, and injects JSON-LD Organization schema.
 */
export function useLandingMeta() {
  useEffect(() => {
    const originalTitle = document.title
    document.title = 'CineConnect — Hire film crew that fits the job, not just the title.'

    const metaDescription =
      'Hire film crew that fits the job, not just the title. CineConnect connects production houses with cast and crew using 7-signal match scoring, verified credits, and direct communication.'

    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attrName, attrValue)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMetaTag('name', 'description', metaDescription)
    setMetaTag('property', 'og:title', 'CineConnect — Film Crew Hiring & Cast Matching')
    setMetaTag('property', 'og:description', metaDescription)
    setMetaTag('property', 'og:type', 'website')
    setMetaTag('property', 'og:url', 'https://cineconnect.app/')
    setMetaTag('name', 'twitter:card', 'summary_large_image')
    setMetaTag('name', 'twitter:title', 'CineConnect — Film Crew Hiring & Cast Matching')
    setMetaTag('name', 'twitter:description', metaDescription)

    // JSON-LD Organization Schema
    const jsonLdId = 'cineconnect-landing-jsonld'
    let scriptTag = document.getElementById(jsonLdId) as HTMLScriptElement | null
    if (!scriptTag) {
      scriptTag = document.createElement('script')
      scriptTag.id = jsonLdId
      scriptTag.type = 'application/ld+json'
      document.head.appendChild(scriptTag)
    }

    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'CineConnect',
      url: 'https://cineconnect.app',
      logo: 'https://cineconnect.app/vite.svg',
      description: metaDescription,
      sameAs: [
        'https://twitter.com/cineconnect',
      ],
    }

    scriptTag.textContent = JSON.stringify(orgSchema)

    return () => {
      document.title = originalTitle || 'CineConnect'
      const existingScript = document.getElementById(jsonLdId)
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript)
      }
    }
  }, [])
}
