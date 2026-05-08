<template>
    <div class="graph-header">
        <label class="toggle-switch">
            <input type="checkbox" v-model="usePercent" />
            <span class="slider"></span>
            <span class="label-text">Gestapeld tot 100%</span>
        </label>
        <div class="legend">
            <div v-for="(rider, i) in top5Riders" :key="rider" class="legend-item">
                <span class="color-box" :style="{ backgroundColor: top5Colors[i] }"></span>
                <span class="rider-name">{{ rider }}</span>
            </div>
        </div>
    </div>


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
const usePercent = ref(false)

const top5Riders = ref([])
const top5Colors = ["#004C5C", "#1FA8C9", "#86C7CF", '#FFC466', '#FF9800'].reverse()

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

watch([() => store.selections, () => store.points, usePercent], async () => {
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

    // Na berekening van top5:
    top5Riders.value = Object.entries(riderTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(d => d[0])

    participants.value.forEach(participant => {
        const containerDiv = d3.selectAll('.multiple')
            .filter((d, i, nodes) => nodes[i].querySelector('p').textContent.includes(participant.name))

        if (!containerDiv.node()) return

        const svg = containerDiv.select('svg')
        const width = containerDiv.node().clientWidth
        const height = 200
        const margin = { top: 24, right: 80, bottom: 24, left: 32 }

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

        let normalizedData = stackedData
        if (usePercent.value) {
            normalizedData = stackedData.map(row => {
                const total = d3.sum(riderData.map(r => row[r.rider]))
                if (total === 0) return row
                const newRow = { stage: row.stage }
                riderData.forEach(r => newRow[r.rider] = row[r.rider] / total)
                return newRow
            })
        }

        const stack = d3.stack()
            .keys(riderData.map(r => r.rider))
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone)

        const series = stack(normalizedData)

        const y = d3.scaleLinear()
            .domain([0, usePercent.value ? 1 : d3.max(series, s => d3.max(s, d => d[1]))])
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
            .call(d3.axisBottom(x).ticks(5).tickFormat(x => x === 22 ? 'gc' : `s${x}`))

        const tickWidth = x(lastStage) - margin.left;

        g.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .attr("class", "axis axis-y")
            .call(d3.axisLeft(y)
                .ticks(4)
                .tickSizeInner(-tickWidth)
                .tickFormat(d => usePercent.value ? `${Math.round(d * 100)}%` : d)
            )
            .call(g => g.select(".domain").remove());

        // Kleurtoewijzing: top5 vaste kleuren, rest grijs
        const color = d3.scaleOrdinal()
            .domain(riderData.map(r => r.rider))
            .range(riderData.map(r => {
                const i = top5Riders.value.indexOf(r.rider)
                return i >= 0 ? top5Colors[i] : 'var(--muted-foreground)'
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
        // (verwijder evt. oude .on('mousemove'...) listeners op de areas)

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

        const cursorLine = g.append('line')
            .attr('class', 'cursor-line')
            .attr('y1', margin.top)
            .attr('y2', height - margin.bottom)
            .style('display', 'none');

        const capture = g.append('rect')
            .attr('class', 'event-capture')
            .attr('x', margin.left)
            .attr('y', margin.top)
            .attr('width', width - margin.left - margin.right)
            .attr('height', height - margin.top - margin.bottom)
            .style('fill', 'none')
            .style('pointer-events', 'all');

        // helper: dichtstbijzijnde stage
        const stagesSorted = stages.slice().sort((a, b) => a - b);

        function handleMove(event) {
            // voorkom scroll-jank op mobiel
            if (event.cancelable) event.preventDefault?.();

            // positie voor tooltip (relatief aan containerDiv)
            const [mxc, myc] = d3.pointer(event, containerDiv.node());

            // positie in svg-ruimte (voor x->stage)
            const [mxs] = d3.pointer(event, svg.node());
            const mxClamped = Math.max(margin.left, Math.min(mxs, width - margin.right));

            const sx = x.invert(mxClamped);
            const i = d3.bisectCenter(stagesSorted, sx);
            const stage = stagesSorted[i];
            if (stage == null) return;

            const xStage = x(stage);

            cursorLine
                .attr('x1', xStage)
                .attr('x2', xStage)
                .style('display', null);

            const rows = riderData.map(r => {
                const curr = r.values.find(v => v.stage === stage)?.cumulative_points ?? 0;
                const prevStage = stagesSorted[i - 1];
                const prev = prevStage != null
                    ? (r.values.find(v => v.stage === prevStage)?.cumulative_points ?? 0)
                    : 0;
                const delta = Math.max(0, curr - prev); // punten in deze stage
                return { rider: r.rider, delta, total: curr };
            })
                // i.p.v. filteren enkel sorteren
                .filter(d => d.total > 0)   // alleen renners die al punten hebben
                .sort((a, b) => b.total - a.total);


            // Als niemand scoort, toon lege melding
            const htmlRows = rows.length
                ? rows.map(d => `
      <tr class="tt-row">
        <td>
          <span class="tt-dot" style="background:${color(d.rider)}"></span>
          ${formatRiderName(d.rider)}
        </td>
        <td class="tt-total">
          <span class="tt-dim">${d.total}</span>
        </td>
        <td class="tt-points">
          <span>${d.delta > 0 ? '+' : ''}${d.delta > 0 ? d.delta : ''}</span>
        </td>
      </tr>
    `).join('')
                : `<tr class="tt-row"><td colspan="3" class="tt-dim">Geen punten in deze stage</td></tr>`;


            tooltip
                .style('display', 'block')
                .style('left', Math.min(mxc + 16, width - margin.right - 180) + 'px')
                .style('top', Math.max(myc + 48, margin.top) + 'px')
                .html(`
                <div class="tt-stage">${stage === 22 ? 'Final' : `Stage ${stage}`}</div>
                <table class="tt-table">
                    <tbody>${htmlRows}</tbody>
                </table>
                `)

        }

        function handleLeave() {
            cursorLine.style('display', 'none');
            tooltip.style('display', 'none');
        }

        // Desktop + mobiel events
        capture
            .on('mousemove', handleMove)
            .on('mouseleave', handleLeave)
            .on('touchstart', handleMove)
            .on('touchmove', handleMove)
            .on('touchend', handleLeave);
    })
}
</script>

<style scoped>
.graph-header {
    display: flex;
    gap: 2.5rem;
    flex-direction: column;

    @media (min-width: 768px) {
        flex-direction: row;
    }
}

.toggle-switch {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    gap: 0.5rem;
}

.toggle-switch input {
    display: none;
}

.toggle-switch .slider {
    width: 2rem;
    height: 1rem;
    background: var(--muted-foreground);
    border-radius: 0.5rem;
    position: relative;
    transition: background 0.3s;
}

.toggle-switch .slider::before {
    content: "";
    position: absolute;
    width: 0.85rem;
    height: 0.85rem;
    left: 0.05rem;
    top: 0.05rem;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
}

.toggle-switch input:checked+.slider::before {
    transform: translateX(1rem);
}

.toggle-switch input:checked+.slider {
    background: var(--primary);
}

.legend {
    display: flex;
    gap: 0.5rem 1rem;
    flex-wrap: wrap;
    align-items: left;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--text-xs);
}

.color-box {
    width: var(--text-xs);
    height: var(--text-xs);
}

.multiples {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 2rem;
    margin: 2rem 0;
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
    font-weight: var(--font-weight-medium);
}

.graph-subtitle {
    color: var(--muted-foreground);
    font-weight: var(--font-weight-regular);
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

:deep(.area) {
    opacity: 0.8;
}

:deep(.cursor-line) {
    stroke: var(--muted-foreground);
    stroke-width: 1px;
    pointer-events: none;
}

:deep(.event-capture) {
    cursor: crosshair;
}

.tooltip {
    background: #fff;
    border: 1px solid var(--border);
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
    max-width: 240px;
    word-wrap: break-word;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 9;
}

:deep(.tt-stage) {
    font-weight: bold;
    margin-bottom: 4px;
}

:deep(.tt-table) {
    border-collapse: collapse;
    width: 100%;
}

:deep(.tt-row td) {
    padding: 2px 4px;
    vertical-align: middle;
}

:deep(.tt-dot) {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 4px;
}

:deep(.tt-points) {
    color: var(--muted-foreground);
    text-align: right;
    white-space: nowrap;
    padding-left: 6px;
}

:deep(.tt-total) {
    text-align: right;
}

.tt-dim {
    color: #666;
    font-size: 11px;
}
</style>
