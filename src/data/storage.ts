// Local persistence: structured records in localStorage, frame images in
// IndexedDB. No network calls exist anywhere in the application.

import { BeamConfig, DetectorConfig, Sample, ScanSegment } from '@/physics/types'

const KEY_SAMPLES = 'xdp.samples.v1'
const KEY_SEGMENTS = 'xdp.segments.v1'
const KEY_BEAM = 'xdp.beam.v1'
const KEY_DETECTOR = 'xdp.detector.v1'
const KEY_SETTINGS = 'xdp.settings.v1'
const DB_NAME = 'xdp-frames'
const DB_VERSION = 1
const STORE = 'frames'

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const loadSamples = (fallback: Sample[]): Sample[] => read(KEY_SAMPLES, fallback)
export const saveSamples = (samples: Sample[]): void => write(KEY_SAMPLES, samples)

export const loadSegments = (): ScanSegment[] => read(KEY_SEGMENTS, [])
export const saveSegments = (segments: ScanSegment[]): void => write(KEY_SEGMENTS, segments)

export const loadBeam = (fallback: BeamConfig): BeamConfig => read(KEY_BEAM, fallback)
export const saveBeam = (beam: BeamConfig): void => write(KEY_BEAM, beam)

export const loadDetector = (fallback: DetectorConfig): DetectorConfig =>
  read(KEY_DETECTOR, fallback)
export const saveDetector = (det: DetectorConfig): void => write(KEY_DETECTOR, det)

export interface AppSettings {
  readoutSec: number
  overheadSec: number
  defaultResolutionA: number
  theme: 'dark' | 'light'
  showFriedelPairs: boolean
}

export const defaultSettings: AppSettings = {
  readoutSec: 0.6,
  overheadSec: 3,
  defaultResolutionA: 0.8,
  theme: 'dark',
  showFriedelPairs: false,
}

export const loadSettings = (): AppSettings => ({
  ...defaultSettings,
  ...read<Partial<AppSettings>>(KEY_SETTINGS, {}),
})
export const saveSettings = (settings: AppSettings): void => write(KEY_SETTINGS, settings)

export const resetAll = (): void => {
  for (const key of [KEY_SAMPLES, KEY_SEGMENTS, KEY_BEAM, KEY_DETECTOR, KEY_SETTINGS]) {
    localStorage.removeItem(key)
  }
}

// IndexedDB helpers for imported experimental frames (blob storage).
const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('sampleId', 'sampleId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

export interface StoredFrame {
  id: string
  sampleId: string
  blob: Blob
  width: number
  height: number
  importedAt: number
}

export const saveFrame = async (frame: StoredFrame): Promise<void> => {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(frame)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export const loadFrames = async (sampleId: string): Promise<StoredFrame[]> => {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('sampleId').getAll(sampleId)
    req.onsuccess = () => resolve(req.result as StoredFrame[])
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export const deleteFrame = async (id: string): Promise<void> => {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
