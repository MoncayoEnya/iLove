// Helpers for song links: recognise Spotify / YouTube URLs, build the free
// public embed player for them, and look up the title + cover art from a
// pasted link — all without API keys (public oEmbed endpoints).

export function parseMusicLink(url) {
  if (!url) return null
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
  )
  if (yt) {
    const id = yt[1]
    return {
      type: 'youtube',
      id,
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1`,
      cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }
  }
  const sp = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]+)/)
  if (sp) {
    const [, kind, id] = sp
    return {
      type: 'spotify',
      kind,
      id,
      embedUrl: `https://open.spotify.com/embed/${kind}/${id}?autoplay=1`,
      height: kind === 'track' || kind === 'episode' ? 152 : 352,
      cover: null, // Spotify needs a lookup (see fetchLinkInfo)
    }
  }
  return null
}

async function getJson(url, ms = 6000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(String(res.status))
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

// YouTube titles are usually "Artist - Song (Official Video)"; split that
// into a clean title and artist where we can.
function cleanYouTube(title = '', author = '') {
  const tidy = (s) =>
    s
      .replace(/\s*[([](official|lyric|lyrics|audio|music video|video|mv|visualizer|hd|4k)[^)\]]*[)\]]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  const parts = title.split(/\s[-–—]\s/)
  if (parts.length >= 2) return { title: tidy(parts.slice(1).join(' - ')), artist: tidy(parts[0]) }
  return {
    title: tidy(title),
    artist: author.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim(),
  }
}

const cache = new Map()

// Look up { title, artist, cover } for a Spotify/YouTube link. Tries the
// platform's own oEmbed first, then noembed.com as a fallback. Resolves to
// whatever it could find (possibly just a cover), never throws.
export async function fetchLinkInfo(url) {
  const link = parseMusicLink(url)
  if (!link) return null
  if (cache.has(url)) return cache.get(url)

  const result = { title: '', artist: '', cover: link.cover || '' }
  const endpoints =
    link.type === 'spotify'
      ? [`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`]
      : [`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`]
  endpoints.push(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)

  for (const endpoint of endpoints) {
    try {
      const data = await getJson(endpoint)
      if (data?.error) continue
      if (link.type === 'youtube') {
        Object.assign(result, cleanYouTube(data.title, data.author_name))
      } else {
        result.title = data.title || ''
        if (data.thumbnail_url) result.cover = data.thumbnail_url
      }
      break
    } catch {
      // try the next endpoint
    }
  }
  cache.set(url, result)
  return result
}
