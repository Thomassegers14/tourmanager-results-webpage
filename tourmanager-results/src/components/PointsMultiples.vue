<template>
    <div class="multiples" ref="container">
        <div v-for="participant in participants" :key="participant.name" class="multiple">
            <p class="graph-title">{{ participant.name }}</p>
            <p class="graph-subtitle">{{ participant.totalPoints }}ptn</p>
            <svg class="chart"></svg>
            <div class="tooltip" style="display:none; position:absolute;"></div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import { useRankingStore } from '@/stores/rankingStore'

const store = useRankingStore()
const container = ref(null)
const participants = ref([])

let resizeObserver = null

function formatRiderName(fullName) {
    const parts = fullName.trim().split(' ')
    if (parts.length < 2) return fullName
    const firstName = parts.pop()
    const lastName = parts.join(' ').toLowerCase()
    return lastName.replace(/(^|\s|-)(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase())
}

onMounted(async () => {
    if (!store.selections?.length) await store.fetchSelections()
    if (!store.points?.length) await store.fetchPoints()
    updateParticipants()
    drawCharts()

    resizeObserver = new ResizeObserver(() => drawCharts())
    if (container.value) resizeObserver.observe(container.value)
})

onBeforeUnmount(() => {
    if (resizeObserver && container.value) {
        resizeObserver.unobserve(container.value)
    }
})

watch([() => store.selections, () => store.points], async () => {
    await nextTick()
    updateParticipants()
    drawCharts()
})

function updateParticipants() {
    const fmtParticipantShort = d =>
        `${d.voornaam ?? ''} ${d.achternaam ?? ''}`.trim()

    const rawParticipants = Array.from(
        new Set(store.selections.map(fmtParticipantShort))
    )

    const lastStage = d3.max(store.points, d => d.stage)

    participants.value = rawParticipants.map(name => {
        const selectedRiders = store.selections
            .filter(s => fmtParticipantShort(s) === name)
            .map(s => s.rider_name)

        const totalPoints = store.points
            .filter(p => selectedRiders.includes(p.rider_name) && p.stage === lastStage)
            .reduce((sum, p) => sum + p.cumulative_points, 0)

        return { name, totalPoints, selectedRiders }
    })

    participants.value.sort((a, b) => d3.descending(a.totalPoints, b.totalPoints))
}

function drawCharts() {
    if (!store.selections?.length || !store.points?.length) return
    if (!participants.value.length) return

    const points = store.points
    const lastStage = d3.max(points, d => d.stage)

    // Verzamel alle geselecteerde renners van alle deelnemers
    const selectedRidersSet = new Set()
    participants.value.forEach(p => {
        p.selectedRiders.forEach(r => selectedRidersSet.add(r))
    })

    // Bereken totaalpunten per geselecteerde rider in de laatste stage
    const riderTotals = {}
    points
        .filter(p => p.stage === lastStage && selectedRidersSet.has(p.rider_name))
        .forEach(p => {
            riderTotals[p.rider_name] = (riderTotals[p.rider_name] || 0) + p.cumulative_points
        })

    // Sorteer en neem top 5
    const top5Riders = Object.entries(riderTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(d => d[0])

    const top5Colors = ["#FFA500", "#E2BF60", "#B7E7F0", '#A3DDE8', '#66BECF']

    participants.value.forEach(participant => {
        const containerDiv = d3.selectAll('.multiple')
            .filter((d, i, nodes) => nodes[i].querySelector('p').textContent.includes(participant.name))

        if (!containerDiv.node()) return

        const svg = containerDiv.select('svg')
        const width = containerDiv.node().clientWidth
        const height = 200
        const margin = { top: 24, right: 80, bottom: 24, left: 26 }

        svg.attr('width', width).attr('height', height)
        svg.selectAll('*').remove()

        const tooltip = containerDiv.select('.tooltip')

        const x = d3.scaleLinear()
            .domain(d3.extent(points, d => d.stage))
            .range([margin.left, width - margin.right])

        let riderData = participant.selectedRiders.map(rider => ({
            rider,
            values: points
                .filter(p => p.rider_name === rider)
                .sort((a, b) => a.stage - b.stage)
        }))

        // filter riders met 0 punten op laatste stage
        riderData = riderData.filter(r =>
            r.values.some(v => v.stage === lastStage && v.cumulative_points > 0)
        )

        // sort by points at last stage
        riderData.sort((a, b) => {
            const aPoints = a.values[a.values.length - 1]?.cumulative_points || 0
            const bPoints = b.values[b.values.length - 1]?.cumulative_points || 0
            return d3.descending(aPoints, bPoints)
        })

        const stages = Array.from(new Set(points.map(d => d.stage))).sort((a, b) => a - b)
        const stackedData = stages.map(stage => {
            const row = { stage }
            riderData.forEach(r => {
                const p = r.values.find(v => v.stage === stage)
                row[r.rider] = p?.cumulative_points || 0
            })
            return row
        })

        const stack = d3.stack()
            .keys(riderData.map(r => r.rider))
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone)

        const series = stack(stackedData)

        const y = d3.scaleLinear()
            .domain([0, d3.max(series, s => d3.max(s, d => d[1]))])
            .range([height - margin.bottom, margin.top])
            .nice()

        const area = d3.area()
            .x(d => x(d.data.stage))
            .y0(d => y(d[0]))
            .y1(d => y(d[1]))

        const g = svg.append('g')

        g.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .attr('class', 'axis axis-x')
            .call(d3.axisBottom(x).ticks(2).tickFormat(x => x === 22 ? 'gc' : `s${x}`))

        const tickWidth = x(lastStage) - margin.left;

        g.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .attr("class", "axis axis-y")
            .call(d3.axisLeft(y)
                        .ticks(4)
                        .tickSizeInner(-tickWidth)
                        // .tickFormat(d => usePercent ? `${Math.round(d * 100)}%` : d)
                        .tickFormat(d => d)
                )
                .call(g => g.select(".domain").remove());

        // Kleurtoewijzing: top5 vaste kleuren, rest grijs
        const color = d3.scaleOrdinal()
            .domain(riderData.map(r => r.rider))
            .range(riderData.map(r => {
                const i = top5Riders.indexOf(r.rider)
                return i >= 0 ? top5Colors[i] : '#ccc'
            }))

        // stacked areas met tooltip
        g.selectAll('path.area')
            .data(series)
            .join('path')
            .attr('class', 'area')
            .attr('fill', d => color(d.key))
            .attr('d', area)
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.5)
            .on('mousemove', (event, d) => {
                const [mx, my] = d3.pointer(event, containerDiv.node())
                const last = d[d.length - 1]
                tooltip.style('display', 'block')
                    .style('left', mx + 10 + 'px')
                    .style('top', my + 10 + 'px')
                    .html(`${d.key}<br>Total: ${last.data[d.key]}`)
            })
            .on('mouseout', () => tooltip.style('display', 'none'))

        // Rider labels bij laatste stage
        const lastValues = series.map(s => {
            const last = s[s.length - 1]
            return {
                rider: s.key,
                y: y(last[1]),
                points: last.data[s.key]
            }
        })

        lastValues.sort((a, b) => a.y - b.y)
        const minGap = 12
        for (let i = 1; i < lastValues.length; i++) {
            if (lastValues[i].y - lastValues[i - 1].y < minGap) {
                lastValues[i].y = lastValues[i - 1].y + minGap
            }
        }

        lastValues.forEach(d => {
            g.append('text')
                .attr('x', width - margin.right + 5)
                .attr('y', d.y)
                .text(`${formatRiderName(d.rider)}`)
                .attr('font-size', '10px')
                .attr('fill', color(d.rider))
        })
    })
}
</script>

<style scoped>
.multiples {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 2rem;
    margin: 5rem 0;
}

.multiple {
    border-top: 1px solid var(--primary);
    padding: 0.5rem 0;
    position: relative;
}

.graph-title,
.graph-subtitle {
    margin: 0
}

.graph-title {
    font-weight: var(--font-weight-regular);
}

.graph-subtitle {
    font-size: var(--text-xs);
    font-weight: var(--font-weight-light);
}

:deep(.axis text) {
    font-family: 'DM Sans', sans-serif;
  font-size: var(--text-xs);
}

:deep(.axis-y) {
  font-weight: var(--font-weight-light);
  color: var(--muted-foreground)
}

:deep(.axis-y line) {
  stroke: var(--border);
}

.tooltip {
    background: #fff;
    border: 1px solid #333;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
}
</style>
