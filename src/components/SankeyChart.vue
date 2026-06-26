<template>
  <template v-if="hasData">
  <div class="controls">
    <button
      v-for="p in participantOptions"
      :key="p"
      type="button"
      class="chip"
      :class="{ 'chip-active': highlightedParticipants.includes(p) }"
      @click="toggleParticipant(p)"
    >{{ p }}</button>
    <button
      v-if="highlightedParticipants.length"
      type="button"
      class="chip chip-clear"
      @click="highlightedParticipants = []"
    >✕ Alles wissen</button>
  </div>

  <div class="sankey" ref="chart"></div>
  </template>
  <EmptyState v-else-if="loaded"
    title="Nog geen inzendingen"
    message="Zodra deelnemers hun ploeg insturen, verschijnt hier de selectie-analyse." />
  <div v-else class="chart-loading">Laden…</div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRankingStore } from '@/stores/rankingStore'
import EmptyState from './EmptyState.vue'
import * as d3 from 'd3'

const chart = ref(null)
const store = useRankingStore()
const loaded = ref(false)

const hasData = computed(() => store.selections?.length > 0)

// 🔹 nieuw: lijst met te highlighten deelnemers
const highlightedParticipants = ref([])

// 🔹 helper om namen in UI te tonen
const fmtParticipantShort = d =>
  `${d.voornaam ?? ''} ${((d.achternaam ?? '').trim().charAt(0) || '')}.`.trim()

// 🔹 opties voor de multiselect (unieke deelnemers)
const participantOptions = computed(() => {
  if (!store.selections?.length) return []
  return Array.from(new Set(store.selections.map(fmtParticipantShort))).sort(d3.ascending)
})

  function formatRiderName(fullName) {
    const parts = fullName.trim().split(' ')
    if (parts.length < 2) return fullName
    parts.pop()
    const lastName = parts.join(' ').toLowerCase()
    return lastName.replace(/(^|\s|-)(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase())
  }

onMounted(async () => {
  window.addEventListener('resize', handleResize)
  if (!store.selections?.length) await store.fetchSelections()
  loaded.value = true
  drawChord()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// 🔹 voeg highlightedParticipants toe zodat een wijziging meteen rendert
watch([() => store.selections, highlightedParticipants], async () => {
  await nextTick()
  drawChord()
})

function toggleParticipant(p) {
  const idx = highlightedParticipants.value.indexOf(p)
  if (idx >= 0) {
    highlightedParticipants.value = highlightedParticipants.value.filter((_, i) => i !== idx)
  } else {
    highlightedParticipants.value = [...highlightedParticipants.value, p]
  }
}

function handleResize() {
  drawChord()
}

function drawChord() {
  const el = chart.value
  if (!el || !store.selections?.length) return

  d3.select(el).selectAll('*').remove()

  const data = store.selections
  const width = el.clientWidth || 800
  const height = el.clientHeight || 800
  const innerRadius = Math.min(width, height) * (width > 600 ? 0.4 : 0.25)
  const outerRadius = innerRadius + (width > 600 ? 9 : 3)

  const participants = Array.from(new Set(data.map(d => fmtParticipantShort(d))))
  const riders = Array.from(new Set(data.map(d => formatRiderName(d.rider_name))))
  const inactiveRiders = new Set(
    data.filter(d => !d.active).map(d => formatRiderName(d.rider_name))
  )

  const dummyCount = width > 600 ? 24 : 9
  const dummyBefore = Array.from({ length: dummyCount }, (_, i) => `gap-before-${i}`)
  const dummyAfter = Array.from({ length: dummyCount }, (_, i) => `gap-after-${i}`)

  const allNodes = [...dummyBefore, ...participants, ...dummyAfter, ...riders]
  const n = allNodes.length
  const index = new Map(allNodes.map((d, i) => [d, i]))

  const matrix = Array.from({ length: n }, () => Array(n).fill(0))
  data.forEach(d => {
    const p = fmtParticipantShort(d)
    const r = formatRiderName(d.rider_name)
    matrix[index.get(p)][index.get(r)]++
    matrix[index.get(r)][index.get(p)]++
  })

  const chord = d3.chord().padAngle(width > 600 ? 0.02 : 0.01)(matrix)

  const svg = d3.select(el).append('svg')
    .attr('viewBox', [-width / 2, -height / 2, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet') // ✅ zorgt dat chart meeschalend is
    .classed('sankey-svg', true)

  const group = svg.append('g')
    .selectAll('g')
    .data(chord.groups)
    .join('g')

  const arcGen = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius)

  const nodes = group.append('path')
  .filter(d => !allNodes[d.index].startsWith('gap'))
  .attr('d', arcGen)
  .attr('class', d => {
    const name = allNodes[d.index]
    if (inactiveRiders.has(name)) return 'sankey-node sankey-node-inactive'
    const isHighlighted = highlightedParticipants.value.includes(name)
    return isHighlighted ? 'sankey-node sankey-node-highlighted' : 'sankey-node'
  })

const labels = group.append('text')
  .filter(d => !allNodes[d.index].startsWith('gap'))
  .each(d => { d.angle = (d.startAngle + d.endAngle) / 2 })
  .attr('dy', '.35em')
  .attr('transform', d => `
    rotate(${(d.angle * 180 / Math.PI - 90)})
    translate(${outerRadius + 5})
    ${d.angle > Math.PI ? 'rotate(180)' : ''}
  `)
  .attr('text-anchor', d => d.angle > Math.PI ? 'end' : 'start')
  .attr('class', d => {
    const name = allNodes[d.index]
    if (inactiveRiders.has(name)) return 'sankey-label sankey-label-inactive'
    const isHighlighted = highlightedParticipants.value.includes(name)
    return isHighlighted ? 'sankey-label sankey-label-highlighted' : 'sankey-label'
  })
  .text(d => allNodes[d.index])

const ribbons = svg.append('g')
  .attr('fill-opacity', 0.7)
  .selectAll('path')
  .data(chord)
  .join('path')
  .filter(d => !allNodes[d.source.index].startsWith('gap') && !allNodes[d.target.index].startsWith('gap'))
  .attr('d', d3.ribbon().radius(innerRadius))
  .attr('class', d => {
    const s = allNodes[d.source.index]
    const t = allNodes[d.target.index]
    if (inactiveRiders.has(s) || inactiveRiders.has(t)) return 'sankey-link sankey-link-inactive'
    const isHighlighted = highlightedParticipants.value.includes(s) || highlightedParticipants.value.includes(t)
    return isHighlighted ? 'sankey-link sankey-link-highlighted' : 'sankey-link'
  })

  // Chords
  ribbons
    .filter(d => !allNodes[d.source.index].startsWith('gap') && !allNodes[d.target.index].startsWith('gap'))
    .attr('d', d3.ribbon().radius(innerRadius));

  function isConnected(i, nodeIndex) {
    return ribbons.data().some(r =>
      (r.source.index === i && r.target.index === nodeIndex) ||
      (r.target.index === i && r.source.index === nodeIndex)
    )
  }

  function applySelection() {
    const selected = highlightedParticipants.value
    if (!selected.length) {
      nodes.classed('sankey-node-highlighted', false).classed('sankey-node-faded', false)
      ribbons.classed('sankey-link-highlighted', false).classed('sankey-link-faded', false)
      labels.classed('sankey-label-highlighted', false).classed('sankey-label-faded', false)
      return
    }
    const selectedIndices = new Set(selected.map(p => index.get(p)).filter(i => i != null))

    nodes.classed('sankey-node-faded', true).classed('sankey-node-highlighted', false)
    ribbons.classed('sankey-link-faded', true).classed('sankey-link-highlighted', false)
    labels.classed('sankey-label-faded', true).classed('sankey-label-highlighted', false)

    nodes.each(function(d) {
      if (selectedIndices.has(d.index) || [...selectedIndices].some(i => isConnected(i, d.index))) {
        d3.select(this).classed('sankey-node-highlighted', true).classed('sankey-node-faded', false)
      }
    })

    ribbons.each(function(d) {
      if ([...selectedIndices].some(i => d.source.index === i || d.target.index === i)) {
        d3.select(this).classed('sankey-link-highlighted', true).classed('sankey-link-faded', false)
      }
    })

    labels.each(function(d) {
      if (selectedIndices.has(d.index) || [...selectedIndices].some(i => isConnected(i, d.index))) {
        d3.select(this).classed('sankey-label-highlighted', true).classed('sankey-label-faded', false)
      }
    })
  }

  // Hover interactiviteit
  group.on('mouseover', function (event, d) {
    const i = d.index
    nodes.classed('sankey-node-faded', true)
    nodes.filter(l => l.index === i || isConnected(i, l.index)).classed('sankey-node-highlighted', true)
    ribbons.classed('sankey-link-faded', true)
    ribbons.filter(r => r.source.index === i || r.target.index === i).classed('sankey-link-highlighted', true)
    labels.classed('sankey-label-faded', true)
    labels.filter(l => l.index === i || isConnected(i, l.index)).classed('sankey-label-highlighted', true)
  })

  group.on('mouseout', function () {
    applySelection()
  })

  applySelection()
}


</script>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.chip {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--primary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: background 150ms, color 150ms;

  &:hover {
    border-color: var(--primary);
  }
}

.chip-active {
  background: var(--primary);
  color: var(--background);
  border-color: var(--primary);
}

.chip-clear {
  color: var(--muted-foreground);
  border-color: var(--border);

  &:hover {
    color: var(--primary);
  }
}

.sankey {
  width: 100%;
  height: 80vh;
}

:deep(.sankey-label) {
  font-size: var(--text-xs);
  fill: var(--primary);
  cursor: pointer;
  transition: fill 200ms;
}

:deep(.sankey-node) {
  fill: var(--primary);
}

:deep(.sankey-node-faded) {
  fill: var(--secondary);
}

:deep(.sankey-node-highlighted) {
  fill: var(--primary);
}

:deep(.sankey-label-faded) {
  fill: var(--secondary);
}

:deep(.sankey-label-highlighted) {
  font-weight: bold;
  fill: var(--primary);
}

:deep(.sankey-node-inactive) {
  fill: var(--muted-foreground);
  opacity: 0.3;
}

:deep(.sankey-label-inactive) {
  fill: var(--muted-foreground);
  opacity: 0.5;
}

:deep(.sankey-link) {
  fill: var(--muted-foreground);
  stroke: var(--muted-foreground);
  opacity: 0.4;
  mix-blend-mode: multiply;
  transition: fill 200ms;
}

:deep(.sankey-link-inactive) {
  fill: var(--muted-foreground);
  stroke: var(--muted-foreground);
  opacity: 0.2;
}

:deep(.sankey-link-faded) {
  fill: var(--secondary);
  stroke: var(--secondary);
  opacity: 0.2;
}

:deep(.sankey-link-highlighted) {
  fill: #52B4C7;
  stroke: #52B4C7;
  opacity: 0.8;
}

:deep(.sankey-link-highlighted-secondary) {
  fill: orange;
  stroke: orange;
  opacity: 0.8;
}
</style>
