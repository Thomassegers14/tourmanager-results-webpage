<template>
    <div class="scatter-container" ref="container">
        <div v-for="chart in charts" :key="chart.key" class="chart" :ref="el => chartRefs[chart.key] = el"></div>

        <!-- Tooltip -->
        <div ref="tooltip" class="tooltip hidden"></div>
    </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from "vue"
import { useRankingStore } from "@/stores/rankingStore"
import { formatRiderName } from "@/config.js"
import * as d3 from "d3"

const store = useRankingStore()
const container = ref(null)
const tooltip = ref(null)

const chartRefs = {}
const charts = [
    { key: "gc_score", title: "GC Score" },
    { key: "classic_score", title: "Allround Score" },
    { key: "combined_score", title: "Combined Score" },
    { key: "sprinter_score", title: "Sprint Score" }
]

// === Data voorbereiden ===
function prepareData() {
    const maxStage = d3.max(store.points, d => d.stage)

    const riderPoints = {}
    store.points.forEach(d => {
        if (d.stage === maxStage) riderPoints[d.rider_name] = d.cumulative_points
    })

    const currentSelections = store.selections?.map(s => s.rider_name) || []

    return store.favorites.map(fav => ({
        rider_name: fav.rider_name,
        gc_score: fav.gc_score,
        classic_score: fav.classic_score,
        combined_score: fav.combined_score,
        sprinter_score: fav.sprinter_score,
        points: riderPoints[fav.rider_name] || 0,
        inSelection: currentSelections.includes(fav.rider_name)
    }))
}

// === Scatterplot tekenen ===
function drawScatter(el, data, yKey, title) {
    const d3el = d3.select(el)
    if (!d3el.node()) return
    const width = d3el.node().clientWidth
    const height = d3el.node().clientHeight
    if (width === 0 || height === 0) return

    d3el.selectAll("*").remove()

    const margin = { top: 36, right: 24, bottom: 48, left: 48 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const svg = d3el
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)

    const x = d3
        .scaleLinear()
        .domain([0, d3.max(data, d => d.points) || 1])
        .range([0, innerWidth])
        .nice()

    // y as afronden op veelvouden van 5
    const yExtent = d3.extent(data, d => d[yKey])
    const yMax = Math.ceil(yExtent[1] / 5) * 5
    const yMin = Math.floor(yExtent[0] / 5) * 5
    const y = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([innerHeight, 0])

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // medianen berekenen
    const xMedian = d3.mean(data.filter(d => d.points > 0), d => d.points) || 0
    const yMedian = d3.mean(data.filter(d => d.points > 0), d => d[yKey]) || 0

    // assen
    g.append("g")
        .attr("class", "axis axis-x")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-innerHeight))

    g.append("g")
        .attr("class", "axis axis-y")
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth))

    g.selectAll(".domain").remove()

    // overperformers rechthoek
    const rectY = Math.min(y(yMedian), innerHeight)
    const rectHeight = Math.max(0, innerHeight - rectY)

    if (!isNaN(rectY) && !isNaN(rectHeight)) {

        g.append("rect")
            .attr("x", Math.min(x(xMedian), innerWidth))
            .attr("y", rectY)
            .attr("width", Math.max(0, innerWidth - x(xMedian)))
            .attr("height", rectHeight)
            .attr("fill", "#86C7CF")
            .attr("opacity", 0.2)


        // === Kwadrantlijnen ===
        g.append("line")
            .attr("x1", x(xMedian))
            .attr("x2", x(xMedian))
            .attr("y1", 0)
            .attr("y2", innerHeight)
            .attr("stroke", "#86C7CF")
            .attr("stroke-dasharray", "4,2")
            .attr("stroke-width", 1)

        g.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", y(yMedian))
            .attr("y2", y(yMedian))
            .attr("stroke", "#86C7CF")
            .attr("stroke-dasharray", "4,2")
            .attr("stroke-width", 1)
    }
    // punten
    const circleRadius = 6
    const labelPadding = 2

    g.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("class", d => (d.inSelection ? "dot dot-primary" : "dot"))
        .attr("cx", d => x(d.points))
        .attr("cy", d => y(d[yKey]))
        .attr("r", d => (d.points > 0 ? circleRadius : 2))
        .on("mouseover", (event, d) => {
            d3.select(tooltip.value)
                .classed("hidden", false)
                .html(`
          <strong>${formatRiderName(d.rider_name)}</strong><br/>
          Punten: ${d.points}<br/>
          ${title}: ${d[yKey]}
        `)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px")
        })
        .on("mousemove", event => {
            d3.select(tooltip.value)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 28 + "px")
        })
        .on("mouseout", () => d3.select(tooltip.value).classed("hidden", true))

    g.selectAll(".dot-primary").raise()

    // labels
    const labelsData = data
        .filter(d => d.points > xMedian || d[yKey] > 10)
        .map(d => {
            const cx = x(d.points)
            const cy = y(d[yKey])

            // richting kiezen op basis van positie in grafiek
            const horizontalSide = cx > innerWidth / 2 ? "left" : "right"
            const verticalSide = cy > innerHeight / 2 ? "top" : "bottom"

            let origX = cx
            let origY = cy

            if (horizontalSide === "right") {
                origX += circleRadius + labelPadding
            } else {
                origX -= circleRadius + labelPadding
            }

            if (verticalSide === "top") {
                origY -= circleRadius + labelPadding
            } else {
                origY += circleRadius + labelPadding
            }

            return {
                ...d,
                cx,
                cy,
                origX,
                origY,
                x: origX,
                y: origY,
                anchor: horizontalSide === "right" ? "start" : "end"
            }
        })

    const labels = g
        .append("g")
        .selectAll("text")
        .data(labelsData)
        .join("text")
        .attr("class", d => (d.inSelection ? "label label-primary" : "label"))
        .attr("text-anchor", d => d.anchor)
        .text(d => formatRiderName(d.rider_name))

    // force simulation
    const simulation = d3.forceSimulation(labelsData)
        .force("x", d3.forceX(d => d.origX).strength(1))
        .force("y", d3.forceY(d => d.origY).strength(1))
        .force("collide", d3.forceCollide(circleRadius + labelPadding * 2))
        .stop()

    for (let i = 0; i < 200; ++i) simulation.tick()

    labels
        .attr("x", d => d.x)
        .attr("y", d => d.y)

    // axis labels
    g.append("text")
        .attr("class", "x-axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + margin.bottom - 8)
        .attr("text-anchor", "middle")
        .text("Punten gescoord")

    g.append("text")
        .attr("class", "y-axis-label")
        .attr("x", -innerHeight / 2)
        .attr("y", -margin.left / 2)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .text(title)
}


function drawAll() {
    const data = prepareData()
    charts.forEach(chart => {
        drawScatter(chartRefs[chart.key], data, chart.key, chart.title)
    })
}

let resizeObserver
onMounted(async () => {
    await store.fetchPoints()
    await store.fetchFavorites()
    await nextTick()
    drawAll()

    resizeObserver = new ResizeObserver(() => drawAll())
    if (container.value) resizeObserver.observe(container.value)
})

watch([() => store.points, () => store.favorites, () => store.selections], async () => {
    await nextTick()
    drawAll()
})
</script>

<style scoped>
.scatter-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;

    @media (min-width: 768px) {
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    }
}

.chart {
    width: 100%;
    height: 300px;

    @media (min-width: 768px) {
        height: 50vh;
    }
}

.tooltip {
    position: absolute;
    background: white;
    border: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    pointer-events: none;
    font-size: 0.85rem;
    color: var(--foreground);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 1000;
}

.hidden {
    display: none;
}

::v-deep(.axis) {
    font-family: var(--fontSans);
    font-weight: 300;
    font-size: 0.9rem;
    color: var(--muted-foreground);
}

::v-deep(.axis line) {
    stroke: var(--border);
}

::v-deep(.dot) {
    stroke-width: 1px;
    fill: #86C7CF;
    opacity: 0.8;
}

::v-deep(.dot-primary) {
    fill: #004C5C;
}

::v-deep(.label) {
    fill: #1FA8C9;
    font-weight: var(--font-weight-light);
    font-size: var(--text-xs);
}

::v-deep(.label-primary) {
    fill: #004C5C;
    font-weight: var(--font-weight-medium);
}
</style>
