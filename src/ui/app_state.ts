// Central application state and the cached reflection table.

import { Store } from './store'
import { BeamConfig, DetectorConfig, Reflection, Sample, ScanSegment } from '@/physics/types'
import { ReflectionTable } from '@/physics/reflection'
import {
  AppSettings,
  defaultSettings,
  loadBeam,
  loadDetector,
  loadSamples,
  loadSegments,
  loadSettings,
  saveBeam,
  saveDetector,
  saveSamples,
  saveSegments,
  saveSettings,
} from '@/data/storage'
import { defaultBeam, defaultDetector, demoSamples } from '@/data/demo_samples'
import { generateReflections } from '@/physics/reflection'

export type PageId =
  | 'samples'
  | 'cell'
  | 'strategy'
  | 'diffraction'
  | 'reciprocal'
  | 'settings'

export interface AppState {
  page: PageId
  samples: Sample[]
  selectedSampleId: string
  segments: ScanSegment[]
  beam: BeamConfig
  detector: DetectorConfig
  settings: AppSettings
  // Timeline position of the diffraction view.
  stageAngleDeg: number
  stage: 'omega' | 'phi'
  tableVersion: number
}

export interface CachedTable {
  sampleId: string
  table: ReflectionTable
}

const initialSamples = loadSamples(demoSamples)
const initialSegments = loadSegments()

export const appStore = new Store<AppState>({
  page: 'diffraction',
  samples: initialSamples,
  selectedSampleId: initialSamples[0]?.id ?? '',
  segments:
    initialSegments.length > 0
      ? initialSegments
      : [
          {
            id: 'seg-default',
            axis: 'omega',
            startDeg: -60,
            endDeg: 120,
            stepDeg: 0.5,
            exposureSec: 2,
          },
        ],
  beam: loadBeam(defaultBeam),
  detector: loadDetector(defaultDetector),
  settings: loadSettings(),
  stageAngleDeg: 0,
  stage: 'omega',
  tableVersion: 0,
})

let cached: CachedTable | null = null

export const selectedSample = (): Sample => {
  const s = appStore.value
  return s.samples.find((x) => x.id === s.selectedSampleId) ?? s.samples[0]
}

// Rebuild (or reuse) the reflection table for the currently selected sample.
// Geometry changes bump tableVersion so renderers know to refresh buffers.
export const reflectionTable = (): ReflectionTable => {
  const state = appStore.value
  const sample = selectedSample()
  const signature = `${sample.id}:${state.tableVersion}:${state.beam.wavelengthA}:${state.beam.beamStopMm}:${sample.mosaicity}:${sample.wavelengthSpread}`
  if (cached && cached.sampleId === signature) return cached.table
  const table = generateReflections(sample, {
    beam: state.beam,
    ewald: {
      wavelengthA: state.beam.wavelengthA,
      mosaicityDeg: sample.mosaicity,
      wavelengthSpread: sample.wavelengthSpread,
    },
  })
  cached = { sampleId: signature, table }
  return table
}

export const invalidateTable = (): void => {
  cached = null
  appStore.set({ tableVersion: appStore.value.tableVersion + 1 })
}

// Persistent mutators: change state, persist, invalidate derived geometry.
export const updateSample = (id: string, patch: Partial<Sample>): void => {
  const samples = appStore.value.samples.map((s) => (s.id === id ? { ...s, ...patch } : s))
  appStore.set({ samples })
  saveSamples(samples)
  invalidateTable()
}

export const addSample = (sample: Sample): void => {
  appStore.update((s) => ({ ...s, samples: [...s.samples, sample], selectedSampleId: sample.id }))
  saveSamples(appStore.value.samples)
  invalidateTable()
}

export const removeSample = (id: string): void => {
  const samples = appStore.value.samples.filter((s) => s.id !== id)
  const nextId = samples[0]?.id ?? ''
  appStore.update((s) => ({ ...s, samples, selectedSampleId: nextId }))
  saveSamples(samples)
  invalidateTable()
}

export const selectSample = (id: string): void => {
  appStore.set({ selectedSampleId: id, stageAngleDeg: 0 })
  invalidateTable()
}

export const persistSegments = (segments: ScanSegment[]): void => {
  appStore.set({ segments })
  saveSegments(segments)
}

export const persistBeam = (beam: BeamConfig): void => {
  appStore.set({ beam })
  saveBeam(beam)
  invalidateTable()
}

export const persistDetector = (detector: DetectorConfig): void => {
  appStore.set({ detector })
  saveDetector(detector)
}

export const persistSettings = (settings: AppSettings): void => {
  appStore.set({ settings })
  saveSettings(settings)
}

export const restoreDemoData = (): void => {
  appStore.set({
    samples: demoSamples,
    selectedSampleId: demoSamples[0].id,
    beam: defaultBeam,
    detector: defaultDetector,
    settings: defaultSettings,
  })
  saveSamples(demoSamples)
  saveBeam(defaultBeam)
  saveDetector(defaultDetector)
  saveSettings(defaultSettings)
  invalidateTable()
}

export const allReflections = (): Reflection[] => reflectionTable().reflections
