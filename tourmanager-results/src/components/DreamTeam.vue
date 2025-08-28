<template>
  <div class="dream-team-container" v-if="dreamTeam.length">
    <!-- Table view -->
    <table class="dream-team-table">
      <thead>
        <tr>
          <th>Renner</th>
          <th></th>
          <th>Punten</th>
          <th>In selectie</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="rider in dreamTeam" :key="rider.rider_name">
          <td>{{ rider.rider_name }}</td>
          <td>
            <span v-if="rider.fav_points > 0" class="badge badge-outline">{{ rider.fav_points }}pt</span>
          </td>
          <td>{{ rider.cumulative_points }}</td>
          <td>
            <span v-for="name in rider.selected_by" :key="name" class="badge badge-secondary selection-badge">
              {{ name }}
            </span>
          </td>
        </tr>
        <!-- Totaal -->
        <tr class="total-row">
          <td colspan="2">Totaal</td>
          <td>{{ dreamTeamTotalPoints }}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <!-- Sankey diagram -->
    <div ref="sankeyContainer" class="sankey-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from "vue";
import { useRankingStore } from "@/stores/rankingStore";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import { formatRiderName } from "../config";

const store = useRankingStore();
const sankeyContainer = ref(null);
const view = ref("sankey");

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

// --- Draw sankey ---
function drawSankey() {
  if (!sankeyContainer.value) return;

  const el = d3.select(sankeyContainer.value);
  el.selectAll("*").remove();

  const margin = { top: 20, right: 120, bottom: 20, left: 120 };
  const width = sankeyContainer.value.clientWidth - margin.left - margin.right;
  const height = sankeyContainer.value.clientHeight - margin.top - margin.bottom;

  const svg = el.append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // --- Nodes ---
  const participants = Array.from(new Set(store.selections.map(s => `${s.voornaam} ${s.achternaam.charAt(0)}`)));
  const nonSelectedNodeName = "Niet geselecteerd";
  if (!participants.includes(nonSelectedNodeName)) participants.push(nonSelectedNodeName);

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
  if (!store.selections?.length) await store.fetchSelections();
  if (!store.points?.length) await store.fetchPoints();
  if (!store.favorites?.length) await store.fetchFavorites(); // indien nodig

  drawSankey();
  resizeObserver = new ResizeObserver(() => drawSankey());
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
}

.dream-team-table th,
.dream-team-table td {
  padding: 0.3rem 0.5rem;
  text-align: left;
  vertical-align: middle;
  font-size: var(--text-sm);
}

.selection-badge {
  margin-right: 0.2rem;
}

.total-row {
  font-weight: bold;
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
