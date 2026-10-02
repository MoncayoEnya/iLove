import { useEffect, useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Map of your shared places. No npm install needed: Leaflet (the open-source
// map library) and OpenStreetMap tiles load on demand the first time the
// map is opened.
//
// Places only store a typed address, so each one is looked up once with
// OpenStreetMap's free geocoder (Nominatim, max 1 lookup per second as its
// rules require) and the coordinates are saved back onto the place
// (lat/lng) so it never needs looking up again.

const LEAFLET_VERSION = '1.9.4'
const PIN_COLORS = {
  'date-spot': '#1c7a63',
  restaurant: '#a33d6b',
  outdoor: '#3f7a3f',
  'travel-goal': '#b0591c',
  favorite: '#8a6416',
  other: '#9a8a9c',
}

let leafletPromise = null
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`
    js.async = true
    js.onload = () => resolve(window.L)
    js.onerror = () => {
      leafletPromise = null
      reject(new Error('Map failed to load'))
    }
    document.head.appendChild(js)
  })
  return leafletPromise
}

async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('geocode failed')
  const data = await res.json()
  if (!data[0]) return null
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export default function PlacesMap({ coupleId, places }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [locating, setLocating] = useState(0)

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return
        const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([20, 0], 2)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)
        layerRef.current = L.layerGroup().addTo(map)
        mapRef.current = map
        setStatus('ready')
        setTimeout(() => map.invalidateSize(), 50)
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Look up coordinates for places that don't have them yet.
  useEffect(() => {
    if (!coupleId) return undefined
    let cancelled = false
    const todo = places.filter((p) => p.address && p.lat == null && !p.geoFailed)
    if (!todo.length) return undefined
    ;(async () => {
      setLocating(todo.length)
      for (const p of todo) {
        if (cancelled) break
        try {
          const hit = await geocode(p.address)
          await updateDoc(
            doc(db, 'couples', coupleId, 'sharedPlaces', p.id),
            hit ? { lat: hit.lat, lng: hit.lng } : { geoFailed: true }
          )
        } catch {
          /* offline or rate-limited — try again next time */
        }
        setLocating((n) => Math.max(0, n - 1))
        await sleep(1100)
      }
    })()
    return () => {
      cancelled = true
    }
    // Only re-run when the set of places needing lookup changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, places.map((p) => `${p.id}:${p.lat ?? ''}:${p.geoFailed ? 1 : 0}`).join('|')])

  // Draw pins.
  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (status !== 'ready' || !L || !map || !layerRef.current) return
    layerRef.current.clearLayers()
    const located = places.filter((p) => p.lat != null && p.lng != null)
    located.forEach((p) => {
      const color = PIN_COLORS[p.category] || PIN_COLORS.other
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.3)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26],
      })
      const img = p.imageUrl
        ? `<img src="${escapeHtml(p.imageUrl)}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px" />`
        : ''
      L.marker([p.lat, p.lng], { icon })
        .addTo(layerRef.current)
        .bindPopup(
          `<div style="min-width:160px">${img}<strong>${escapeHtml(p.name)}</strong><br/><span style="color:#7a6a7c;font-size:12px">${escapeHtml(p.address)}</span></div>`
        )
    })
    if (located.length === 1) map.setView([located[0].lat, located[0].lng], 13)
    else if (located.length > 1) map.fitBounds(located.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 14 })
  }, [places, status])

  const noAddress = places.filter((p) => !p.address).length
  const failed = places.filter((p) => p.geoFailed).length

  return (
    <div data-lv-off className="bg-white border border-black/10 rounded-2xl overflow-hidden">
      <div ref={elRef} className="w-full h-[420px] sm:h-[520px] relative z-0 bg-[#efe9f0]">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#9a8a9c]">Loading map…</div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#9b3b3b] px-6 text-center">
            The map couldn't load. Check your connection and try again.
          </div>
        )}
      </div>
      {(locating > 0 || noAddress > 0 || failed > 0) && (
        <div className="px-4 py-2.5 text-xs text-[#9a8a9c] border-t border-black/10 flex flex-wrap gap-x-4 gap-y-1">
          {locating > 0 && <span>Finding {locating} place{locating === 1 ? '' : 's'} on the map…</span>}
          {noAddress > 0 && (
            <span>
              {noAddress} place{noAddress === 1 ? " has" : 's have'} no address, so {noAddress === 1 ? "it isn't" : "they aren't"} pinned.
            </span>
          )}
          {failed > 0 && (
            <span>
              {failed} address{failed === 1 ? '' : 'es'} couldn't be found.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
