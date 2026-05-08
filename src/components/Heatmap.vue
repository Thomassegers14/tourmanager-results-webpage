<template>
  <div style="width: 100%;">
    <div class="select-container">
      <select v-model="mode">
        <option value="rank">Rank</option>
        <option value="stage_points">Punten</option>
        <option value="cumulative_points">Totaal punten</option>
      </select>
    </div>

    <div v-if="hasData" class="heatmap-container" ref="container">
      <svg ref="svg"></svg>
    </div>
    <div v-else>
      Loading...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { useRankingStore } from '@/stores/rankingStore'
import * as d3 from 'd3'

const container = ref(null)
const svg = ref(null)
const store = useRankingStore()
const mode = ref('rank')

const cellSize = 30

// Check of data beschikbaar is
const hasData = computed(() => store.rankings?.length > 0)

onMounted(async () => {
  await store.fetchRankings()
  if (hasData.value) drawHeatmap()

  // ✅ Resize listener toevoegen
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  // ✅ Event listener opruimen
  window.removeEventListener('resize', handleResize)
})

watch([() => store.rankings, mode], async () => {
  if (!hasData.value) return
  await nextTick()
  drawHeatmap()
})

function handleResize() {
  if (hasData.value) drawHeatmap()
}


function drawHeatmap() {
  if (!store.rankings?.length) return

  // Unieke rijders voor Y-as
  const riders = Array.from(
    new Set(store.rankings.map(r => `${r.voornaam} ${r.achternaam}`))
  )

  // Container breedte responsive
  const containerWidth = container.value.clientWidth
  const svgWidth = containerWidth

  const margin = { top: 48, right: 0, bottom: 0, left: containerWidth > 768 ? 200 : 140 }

  // Bepaal stages waarvoor data beschikbaar is
  const availableStages = new Set(store.rankings.map(d => d.stage))

  // Max stage uit de data
  const maxAvailableStage = d3.max(store.rankings, d => d.stage) || 1

  // Stage 1 t/m 22 (final gc)
  let stages = Array.from({ length: 22 }, (_, i) => i + 1)

  // Responsive filter: op kleine schermen laatste 5 beschikbare
  if (containerWidth < 768) {
    if (maxAvailableStage >= 5) {
      stages = stages.filter(s => s > maxAvailableStage - 5 && s <= maxAvailableStage)
    } else {
      stages = stages.filter(s => s > maxAvailableStage - 5 && s <= 5)
    }
  }


  const svgHeight = riders.length * cellSize + margin.top + margin.bottom
  const cellWidth = (svgWidth - margin.left - margin.right) / stages.length

  // --- color scales voorbereiden ---

  let colorScaleStages, colorScale22

  if (mode.value === 'stage_points') {
    // Alle waarden behalve stage 22
    const valuesStages1to21 = store.rankings
      .filter(d => d.stage !== 22)
      .map(d => d[mode.value])
      .filter(v => v != null)

    const minValStages = d3.min(valuesStages1to21) || 0
    const maxValStages = d3.max(valuesStages1to21) || 1
    const extentStages = [minValStages, maxValStages]

    // Waarden van alleen stage 22
    const valuesStage22 = store.rankings
      .filter(d => d.stage === 22)
      .map(d => d[mode.value])
      .filter(v => v != null)

    const minVal22 = d3.min(valuesStage22) ?? minValStages
    const maxVal22 = d3.max(valuesStage22) ?? maxValStages
    const extent22 = [minVal22, maxVal22]

    colorScaleStages = d3.scaleLinear()
      .domain([extentStages[0], (extentStages[0] + extentStages[1]) / 3, extentStages[1]])
      .range(["#004C5C", "#A7E6EC", "orange"])
      .interpolate(d3.interpolateRgb)

    colorScale22 = d3.scaleLinear()
      .domain([extent22[0], (extent22[0] + extent22[1]) / 3, extent22[1]])
      .range(["#004C5C", "#A7E6EC", "orange"])
      .interpolate(d3.interpolateRgb)

  } else {
    // fallback: alle stages samen
    const values = store.rankings.map(d => d[mode.value]).filter(v => v != null)
    const minVal = d3.min(values) || 0
    const maxVal = d3.max(values) || 1
    const extent = mode.value === 'rank' ? [maxVal, minVal] : [minVal, maxVal]

    colorScaleStages = colorScale22 = d3.scaleLinear()
      .domain([extent[0], (extent[0] + extent[1]) / 3, extent[1]])
      .range(["#004C5C", "#A7E6EC", "orange"])
      .interpolate(d3.interpolateRgb)
  }

  // Maak data array
  const data = []
  riders.forEach((riderName, row) => {
    stages.forEach((stageNum, col) => {
      const entry = store.rankings.find(
        r => `${r.voornaam} ${r.achternaam}` === riderName && r.stage === stageNum
      )
      data.push({
        rider: riderName,
        stage: stageNum,
        value: entry?.[mode.value] ?? null, // null betekent geen data
        row,
        col
      })
    })
  })

  // SVG setup
  const svgEl = d3.select(svg.value)
    .attr('width', svgWidth)
    .attr('height', svgHeight)

  svgEl.selectAll('*').remove()

  // Cells tekenen
  svgEl.selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'cell')
    .attr('x', d => margin.left + d.col * cellWidth)
    .attr('y', d => margin.top + d.row * cellSize)
    .attr('width', cellWidth)
    .attr('height', cellSize)
    .attr('fill', 'var(--background)') // startkleur of neutraal
    .transition()
    .duration(800) // duur van de animatie
    .delay(d => (d.row * 12 + d.col * 24) * 1.2)
    .attr('fill', d => {
      if (d.value === null) return 'var(--secondary)'
      if (mode.value === 'stage_points' && d.stage === 22) {
        return colorScale22(d.value)
      }
      return colorScaleStages(d.value)
    })



  // Waarden als labels op cell
  svgEl.selectAll('text.cell-value')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'cell-value')
    .attr('x', d => margin.left + d.col * cellWidth + cellWidth / 2)
    .attr('y', d => margin.top + d.row * cellSize + cellSize / 2)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .style('opacity', 0)
    .text(d => d.value === null ? '' : d.value)
    .transition()
    .duration(800)
    .delay(d => (d.row + d.col) * 25)
    .style('opacity', 1)

  const interval = 5
  const yTicks = [1, ...Array.from({ length: Math.floor((riders.length) / interval) }, (_, i) => (i + 1) * interval)]


  svgEl.selectAll('.y-tick')
    .data(yTicks)
    .enter()
    .append('line')
    .attr('class', 'y-tick')
    .attr('x1', 0)
    .attr('x2', 26)
    .attr('y1', d => margin.top + (d - 1) * cellSize + 3)
    .attr('y2', d => margin.top + (d - 1) * cellSize + 3)
    .attr('stroke-width', 1)

  svgEl.selectAll('text.y-tick-label')
    .data(yTicks)
    .enter()
    .append('text')
    .attr('class', 'y-tick-label')
    .attr('x', 0)
    .attr('y', d => margin.top + (d - 1) * cellSize + cellSize / 2)
    .attr('text-anchor', 'start')
    .attr('alignment-baseline', 'middle')
    .text(d => `#${d}`)


  // Y-as labels
  svgEl.selectAll('text.rider')
    .data(riders)
    .enter()
    .append('text')
    .attr('x', margin.left - 10)
    .attr('y', (_, i) => margin.top + i * cellSize + cellSize / 2)
    .attr('class', 'y-label')
    .attr('text-anchor', 'end')
    .attr('alignment-baseline', 'middle')
    .text(d => d)

  const bgWidth = cellWidth * 0.8
  const bgHeight = cellSize * 0.8
  const xOffset = (cellWidth - bgWidth) / 2
  const yOffset = margin.top - cellSize + (cellSize - bgHeight) / 2

  svgEl.selectAll('rect.stage-bg')
    .data(stages)
    .enter()
    .append('rect')
    .attr('class', d => availableStages.has(d) ? 'stage-bg stage-bg-selected' : 'stage bg')
    .attr('x', (_, i) => margin.left + i * cellWidth + xOffset)
    .attr('y', yOffset)
    .attr('width', bgWidth)
    .attr('height', bgHeight)
    .attr('rx', 3)   // horizontale border-radius
    .attr('ry', 5)   // verticale border-radius
    .attr('fill', d => availableStages.has(d) ? 'black' : 'none')
    .lower()

  // X-as labels
  svgEl.selectAll('text.stage')
    .data(stages)
    .enter()
    .append('text')
    .attr('class', 'stage-value')
    .attr('x', (_, i) => margin.left + i * cellWidth + cellWidth / 2)
    .attr('y', margin.top - 14)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .attr('fill', d => availableStages.has(d) ? 'white' : 'black')
    .text(d => d === 22 ? 'final' : d)


}

</script>

<style scoped>
:deep(.select-container) {
  display: flex;
  justify-content: center;
  align-content: center;
}

:deep(.cell) {
  stroke: var(--background);
  stroke-width: 0.5;
}

:deep(.cell-value) {
  fill: white;
  font-size: 0.65rem;
  letter-spacing: 0.05rem;
  font-weight: var(--font-weight-light);
}

:deep(.y-label) {
  font-size: var(--text-xs);

  @media (min-width: 768px) {
    font-size: var(--text-base);
  }
}

:deep(.y-tick) {
  stroke: var(--muted-foreground);
  stroke-width: 1px;
}

:deep(.y-tick-label) {
  font-weight: var(--font-weight-light);
  font-size: var(--text-xs);
}

:deep(.stage-value) {
  font-size: var(--text-xs);
  text-transform: uppercase;
}

:deep(.stage-bg) {
  fill: black;
  rx: 3;
  ry: 3;
}
</style>
