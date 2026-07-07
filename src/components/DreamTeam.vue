<template>
  <div class="dream-team-container" v-if="dreamTeam.length">
    <!-- Table view -->
    <table class="dream-team-table">
      <thead>
        <tr>
          <th class="rank-cell"><span class="sr-only">Positie</span></th>
          <th>Renner</th>
          <th class="points-col">Punten</th>
        </tr>
      </thead>
      <tbody v-for="(rider, i) in dreamTeam" :key="rider.rider_name" class="rider-group"
        :style="{ '--row-index': i }">
        <tr>
          <td class="rank-cell">{{ i + 1 }}</td>
          <td class="rider-cell">
            <span class="rider-name">{{ rider.rider_name }}</span>
            <span v-if="rider.fav_points > 0" class="badge badge-outline fav-badge">{{ rider.fav_points }}pt</span>
          </td>
          <td class="points-col">{{ rider.cumulative_points }}</td>
        </tr>
        <tr v-if="rider.selected_by.length" class="badges-row">
          <td colspan="3">
            <div class="badges-wrap">
              <span v-for="name in visibleBadges(rider)" :key="name" class="badge badge-secondary selection-badge">
                {{ name }}
              </span>
              <button
                v-if="rider.selected_by.length > BADGE_LIMIT"
                type="button"
                class="badge-toggle"
                :aria-expanded="isExpanded(rider.rider_name)"
                @click="toggleExpanded(rider.rider_name)"
              >
                {{ isExpanded(rider.rider_name) ? 'toon minder' : `+${rider.selected_by.length - BADGE_LIMIT}` }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
      <tbody>
        <!-- Totaal -->
        <tr class="total-row">
          <td></td>
          <td>Totaal</td>
          <td class="points-col">{{ dreamTeamTotalPoints }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Sankey diagram -->
    <div ref="sankeyContainer" class="sankey-container"></div>
  </div>
  <EmptyState v-else-if="loaded"
    title="Nog geen droomteam"
    message="Het optimale team verschijnt zodra er punten gescoord zijn." />
  <div v-else class="chart-loading">Laden…</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from "vue";
import { useRankingStore } from "@/stores/rankingStore";
import * as d3 from "d3";
import { sankey as d3Sankey } from "d3-sankey";
import { formatRiderName } from "../config";
import { debounce } from "@/utils/debounce";
import EmptyState from "./EmptyState.vue";

const store = useRankingStore();
const sankeyContainer = ref(null);
const view = ref("sankey");
const loaded = ref(false);

// --- Data preparation ---
const enrichedRiders = computed(() => {
  if (!store.favorites?.length || !store.points?.length) return [];

  const maxStage = d3.max(store.points, d => d.stage);
  const riderPoints = {};
  store.points.forEach(d => {
    if (d.stage === maxStage) riderPoints[d.rider_name] = d.cumulative_points;
  });

  return store.favorites.map(fav => ({
    rider_name: fav.rider_name,
    cumulative_points: riderPoints[fav.rider_name] || 0,
    fav_points: fav.fav_points,
    selected_by: store.selections
      ?.filter(s => s.rider_name === fav.rider_name)
      .map(s => `${s.voornaam} ${s.achternaam.charAt(0)}`) || []
  }));
});

// Dream team selectie (budget <= 10)
const dreamTeam = computed(() => {
  if (!enrichedRiders.value.length) return [];
  const sorted = [...enrichedRiders.value].sort((a, b) => b.cumulative_points - a.cumulative_points);
  const team = [];
  let usedBudget = 0;
  for (const rider of sorted) {
    if (team.length >= 12) break;
    if (usedBudget + rider.fav_points <= 10) {
      team.push(rider);
      usedBudget += rider.fav_points;
    }
  }
  return team;
});

const dreamTeamTotalPoints = computed(() =>
  dreamTeam.value.reduce((sum, d) => sum + d.cumulative_points, 0)
);

// Progressive disclosure: 130+ deelnemer-badges tegelijk is visuele ruis;
// toon er 8 en klap de rest uit per renner
const BADGE_LIMIT = 8;
const expandedRiders = ref(new Set());
const isExpanded = (name) => expandedRiders.value.has(name);

function toggleExpanded(name) {
  const next = new Set(expandedRiders.value);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  expandedRiders.value = next;
}

function visibleBadges(rider) {
  return isExpanded(rider.rider_name)
    ? rider.selected_by
    : rider.selected_by.slice(0, BADGE_LIMIT);
}

// --- Draw sankey ---
function drawSankey() {
  if (!sankeyContainer.value) return;

  const el = d3.select(sankeyContainer.value);
  el.selectAll("*").remove();

  // --- Nodes: alleen deelnemers die minstens één dream-team-renner kozen ---
  // (de rest kreeg toch een onzichtbare 0px-node)
  const nonSelectedNodeName = "Niet geselecteerd";
  const selectedBySet = new Set();
  let hasUnselected = false;
  dreamTeam.value.forEach(r => {
    if (r.selected_by.length) r.selected_by.forEach(p => selectedBySet.add(p));
    else hasUnselected = true;
  });
  const participants = Array.from(selectedBySet);
  if (hasUnselected) participants.push(nonSelectedNodeName);

  const margin = { top: 20, right: 120, bottom: 20, left: 120 };
  const width = sankeyContainer.value.clientWidth - margin.left - margin.right;

  // Hoogte groeit mee met het aantal deelnemers: bij 40+ deelnemers vraagt
  // alleen al de nodePadding meer dan de vaste 480px, waardoor d3-sankey
  // alle node-hoogtes tot ~0 liet inklappen en het diagram onzichtbaar werd
  const rowHeight = 22;
  const height = Math.max(440, participants.length * rowHeight);
  sankeyContainer.value.style.height = `${height + margin.top + margin.bottom}px`;

  const svg = el.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const riderNodes = dreamTeam.value.map(d => ({
    name: d.rider_name,
    type: "rider",
    cumulative_points: d.cumulative_points
  }));

  const participantPoints = Object.fromEntries(
    participants.map(p => [p, d3.sum(dreamTeam.value, r => r.selected_by.includes(p) ? r.cumulative_points : 0)])
  );

  const participantNodes = participants.map(p => ({
    name: p,
    type: "participant",
    cumulative_points: participantPoints[p]
  }));

  const nodes = [...riderNodes, ...participantNodes];
  const nodeMap = Object.fromEntries(nodes.map((n, i) => [n.name, i]));

  // --- Links ---
  const links = [];
  dreamTeam.value.forEach(rider => {
    if (rider.selected_by.length) {
      rider.selected_by.forEach(sel => {
        if (nodeMap[sel] !== undefined) {
          links.push({
            source: nodeMap[rider.rider_name],
            target: nodeMap[sel],
            value: rider.cumulative_points
          });
        }
      });
    } else {
      links.push({
        source: nodeMap[rider.rider_name],
        target: nodeMap[nonSelectedNodeName],
        value: rider.cumulative_points
      });
    }
  });

  // --- Sankey ---
  const sankeyGen = d3Sankey()
    .nodeWidth(12)
    .nodePadding(12)
    .extent([[0, 0], [width, height]])
    .nodeSort((a, b) => {
      // Riders: volgorde behouden, participants: van hoog naar laag
      if (a.type === "participant" && b.type === "participant") {
        return d3.descending(a.cumulative_points, b.cumulative_points);
      }
      return 0;
    });

  const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGen({
    nodes: nodes.map(d => ({ ...d })),
    links
  });

  // --- Links ---
  // Cubic Bezier link generator met fill gebaseerd op link breedte
  const linkGen = d => {
    const x0 = d.source.x1;
    const x1 = d.target.x0;
    const y0 = (d.source.y0 + d.source.y1) / 2;
    const y1 = (d.target.y0 + d.target.y1) / 2;
    const width = Math.max(1, d.width); // breedte van de link

    const curvature = 0.6; // 0 = rechte lijn, 0.5 = mooie curve
    const xi = d3.interpolateNumber(x0, x1);

    // bovenkant van de link
    const y0_top = y0 - width / 2;
    const y1_top = y1 - width / 2;

    // onderkant van de link
    const y0_bottom = y0 + width / 2;
    const y1_bottom = y1 + width / 2;

    return `
    M${x0},${y0_top}
    C${xi(curvature)},${y0_top} ${xi(1 - curvature)},${y1_top} ${x1},${y1_top}
    L${x1},${y1_bottom}
    C${xi(1 - curvature)},${y1_bottom} ${xi(curvature)},${y0_bottom} ${x0},${y0_bottom}
    Z
  `;
  };

  // --- Links tekenen ---
  const linkGroup = svg.append("g")
    .selectAll("path")
    .data(sankeyLinks)
    .join("path")
    .attr("d", d => linkGen(d))
    .attr("class", d => d.target.name === nonSelectedNodeName ? "sankey-link" : "sankey-link sankey-link-highlighted") // interne kleur
    .attr("fill-opacity", 0.6);

  // --- Labels ---
  const labelGroup = svg.append("g")
    .selectAll("text")
    .data(sankeyNodes)
    .join("text")
    .attr("class", "sankey-label")
    .attr("x", d => (d.type === "rider" ? d.x0 : d.x1))
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => (d.type === "rider" ? "end" : "start"))
    .text(d => d.type === "rider" ? formatRiderName(d.name) : d.name);

  // --- Hover interactie ---
  function highlightNode(node) {
    // highlight links die verbonden zijn met deze node
    linkGroup.classed("sankey-link-highlighted", d => d.source.name === node.name || d.target.name === node.name)
    linkGroup.classed("sankey-link-faded", d => !(d.source.name === node.name || d.target.name === node.name))

    // highlight de geconnecteerde labels
    labelGroup.classed("sankey-label-highlighted", d => {
      if (d.name === node.name) return true;
      return sankeyLinks.some(l =>
        (l.source.name === node.name && l.target.name === d.name) ||
        (l.target.name === node.name && l.source.name === d.name)
      );
    })
      .classed("sankey-label-faded", d => {
        if (d.name === node.name) return false;
        const connected = sankeyLinks.some(l =>
          (l.source.name === node.name && l.target.name === d.name) ||
          (l.target.name === node.name && l.source.name === d.name)
        );
        return !connected;
      });
  }

  function resetHighlight() {
    linkGroup.classed("sankey-link-highlighted", false);
    labelGroup.classed("sankey-label-highlighted", false);

    linkGroup.classed("sankey-link-faded", false);
    labelGroup.classed("sankey-label-faded", false);

    linkGroup.attr("class", d => d.target.name === nonSelectedNodeName ? "sankey-link" : "sankey-link sankey-link-highlighted") // interne kleur

  }

  // Koppel events aan nodes (labels klikken/hoveren)
  labelGroup
    .on("mouseover", (event, d) => highlightNode(d))
    .on("mouseout", resetHighlight);

  // Idem aan paths (links)
  linkGroup
    .on("mouseover", (event, d) => {
      highlightNode(d.source);
      highlightNode(d.target);
    })
    .on("mouseout", resetHighlight);
}

// --- Lifecycle ---
let resizeObserver;
onMounted(async () => {
  await Promise.all([store.fetchSelections(), store.fetchPoints(), store.fetchFavorites()]);
  loaded.value = true;

  drawSankey();
  resizeObserver = new ResizeObserver(debounce(() => drawSankey()));
  if (sankeyContainer.value) resizeObserver.observe(sankeyContainer.value);
})

onBeforeUnmount(() => resizeObserver?.disconnect());

watch([dreamTeam, () => store.selections, () => store.favorites, view], async () => {
  if (view.value === "sankey") await nextTick(drawSankey);
});
</script>

<style scoped>
.dream-team-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.dream-team-table {
  width: 100%;
  border-collapse: collapse;
  /* fixed: anders verdeelt de browser de max-content van de badge-rijen over
     de kolommen en duwt de tabel de pagina breder dan de viewport */
  table-layout: fixed;
}

.dream-team-table th.points-col {
  width: 4.5rem;
}

/* Mobiel minimaal 14px voor primaire content (mobile-typography: 12px is
   alleen voor captions), regelafstand >= 1.4, ruimere rijen om te scannen */
.dream-team-table th,
.dream-team-table td {
  padding: 0.55rem 0.5rem 0.55rem 0;
  text-align: left;
  vertical-align: middle;
  line-height: 1.4;
  font-size: var(--text-sm);
  border-bottom: none; /* globale td-hairline uit: één lijn per renner, niet per rij */

  @media (min-width: 768px) {
    font-size: var(--text-base);
  }
}

/* var(--muted-foreground) haalt op deze achtergrond geen 4.5:1 contrast;
   primary + opacity werkt in light én dark mode */
.dream-team-table th {
  color: var(--primary);
  opacity: 0.62;
}

.dream-team-table .rank-cell {
  width: 1.75rem;
  font-size: var(--text-xs);
  color: var(--primary);
  opacity: 0.62;
  font-variant-numeric: tabular-nums;
}

.rider-name {
  font-weight: var(--font-weight-normal);
}

.fav-badge {
  margin-left: 0.35rem;
  opacity: 0.7;
}

/* De waarde leidt: rechts uitgelijnd, tabular-nums, zwaarder gewicht */
td.points-col {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: var(--font-weight-semibold);
}

th.points-col {
  text-align: right;
}

/* Eén hairline per renner + rustige gestaggerde fade-in (alleen opacity) */
.rider-group {
  border-top: 1px solid var(--border);
  animation: row-in 500ms cubic-bezier(0.32, 0.72, 0, 1) both;
  animation-delay: calc(var(--row-index, 0) * 45ms);
}

@keyframes row-in {
  from { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .rider-group {
    animation: none;
  }
}

/* Deelnemer-badges wrappen op volle breedte onder de renner, ingesprongen
   tot naast de rangkolom; alle info blijft op elk schermformaat bereikbaar */
.badges-row td {
  padding: 0 0 0.7rem 1.75rem;
}

.badges-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.selection-badge {
  margin-right: 0;
}

/* Uitklap-chip: visueel klein, maar met onzichtbaar vergrote touch-target
   (~44px, Fitts/WCAG 2.5.8) via ::after */
.badge-toggle {
  position: relative;
  background: transparent;
  color: var(--primary);
  opacity: 0.75;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
  transition: border-color 200ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.badge-toggle::after {
  content: '';
  position: absolute;
  inset: -10px;
}

.badge-toggle:hover {
  border-color: var(--primary);
  opacity: 1;
}

.total-row {
  font-weight: var(--font-weight-semibold);
  border-top: 1px solid var(--primary);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.sankey-container {
  width: 100%;
  max-width: 600px;
  height: 480px;
}

/* Sankey link */
:deep(.sankey-link) {
  fill: var(--muted-foreground);
  opacity: 0.6;
  mix-blend-mode: multiply;
  cursor: pointer;
  transition: fill 0.3s;
}

:deep(.sankey-link-highlighted) {
  fill: #52B4C7;
}

:deep(.sankey-link-faded) {
  fill: var(--secondary);
}

/* Sankey labels*/
:deep(.sankey-label) {
  fill: var(--primary);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-light);
  cursor: pointer;
  transition: fill 0.3s, font-weight 0.3s;
}

:deep(.sankey-label-highlighted) {
  font-weight: var(--font-weight-bold);
}

:deep(.sankey-label-faded) {
  fill: var(--secondary);
}
</style>
