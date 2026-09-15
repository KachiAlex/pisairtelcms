import { FieldValue } from 'firebase-admin/firestore'

import { db } from '../lib/firestore'
import { COLLECTIONS } from '../lib/firestore-collections'
import {
  getHierarchyLevels,
  sanitizeHierarchyLevelInputs,
  type HierarchyLevelDefinition,
} from '../lib/services/branch-hierarchy'

interface BackfillStats {
  scanned: number
  skipped: number
  updated: number
  invalid: number
}

const MAX_BATCH_SIZE = 400 // leave headroom below Firestore limit

const stats: BackfillStats = {
  scanned: 0,
  skipped: 0,
  updated: 0,
  invalid: 0,
}

const normalizeDefinitions = (
  rawLevels: unknown,
  fallbackSource: { hierarchyLevelLabels?: Record<string, string> }
): { levels: HierarchyLevelDefinition[]; reason: 'missing' | 'invalid' } | null => {
  if (!Array.isArray(rawLevels) || rawLevels.length === 0) {
    return {
      levels: getHierarchyLevels(fallbackSource),
      reason: 'missing',
    }
  }

  const sanitized = sanitizeHierarchyLevelInputs(rawLevels)
  if ('error' in sanitized) {
    return {
      levels: getHierarchyLevels(fallbackSource),
      reason: 'invalid',
    }
  }

  // Ensure order values are normalized (sanitize already enforces), but compare with raw
  const incoming = sanitized.value
  const equal = Array.isArray(rawLevels)
    ? compareLevels(rawLevels as HierarchyLevelDefinition[], incoming)
    : false
  if (equal) {
    return null
  }

  return {
    levels: incoming,
    reason: 'invalid',
  }
}

const compareLevels = (
  a: HierarchyLevelDefinition[],
  b: HierarchyLevelDefinition[]
): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (!left || !right) return false
    if (left.key !== right.key) return false
    if ((left.label ?? '').trim() !== (right.label ?? '').trim()) return false
    if (Number(left.order ?? i) !== Number(right.order ?? i)) return false
  }
  return true
}

const toStoredLevels = (levels: HierarchyLevelDefinition[]): HierarchyLevelDefinition[] =>
  levels.map((level, index) => ({
    key: level.key,
    label: level.label,
    order: index,
  }))

async function backfillHierarchyLevels() {
  console.log('🔍 Scanning churches for hierarchy level backfill...')
  const snapshot = await db.collection(COLLECTIONS.churches).get()
  const updates: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = []

  for (const doc of snapshot.docs) {
    stats.scanned++
    const data = doc.data() ?? {}
    const existingLevels = data.hierarchyLevels
    const fallbackSource = {
      hierarchyLevelLabels: data.hierarchyLevelLabels ?? undefined,
      hierarchyLevels: existingLevels,
    }

    const result = normalizeDefinitions(existingLevels, fallbackSource)

    if (!result) {
      stats.skipped++
      continue
    }

    if (result.reason === 'invalid') {
      stats.invalid++
    }

    updates.push({
      ref: doc.ref,
      data: {
        hierarchyLevels: toStoredLevels(result.levels),
        updatedAt: FieldValue.serverTimestamp(),
      },
    })

    if (updates.length >= MAX_BATCH_SIZE) {
      await flushBatch(updates)
    }
  }

  if (updates.length > 0) {
    await flushBatch(updates)
  }

  console.log('\n✅ Backfill complete!')
  console.table(stats)
}

const flushBatch = async (
  queue: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }>
) => {
  if (queue.length === 0) return
  const batch = db.batch()
  queue.splice(0).forEach(({ ref, data }) => {
    batch.update(ref, data)
    stats.updated++
  })
  await batch.commit()
}

if (require.main === module) {
  backfillHierarchyLevels()
    .then(() => {
      console.log('\nRun finished successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error)
      process.exit(1)
    })
}
