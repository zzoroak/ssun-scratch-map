const MAP_PATH = "./data/map.topo.json";
const VISITED_PATH = "./data/visited.json";
const TOPO_OBJECT = "skorea_municipalities_geo";

const mapEl = document.querySelector("#map");
const tooltipEl = document.querySelector("#tooltip");
const listEl = document.querySelector("#region-list");
const visitedCountEl = document.querySelector("#visited-count");
const totalCountEl = document.querySelector("#total-count");
const percentEl = document.querySelector("#percent");

const [topology, config] = await Promise.all([
  fetch(MAP_PATH).then(assertOk).then((res) => res.json()),
  fetch(VISITED_PATH).then(assertOk).then((res) => res.json()),
]);

const geo = topojson.feature(topology, topology.objects[TOPO_OBJECT]);
const regions = normalizeRegions(config);
const byCode = new Map();

for (const region of regions) {
  byCode.set(String(region.id), region);

  for (const code of region.codes) {
    byCode.set(String(code), region);
  }
}

render();
window.addEventListener("resize", render);

function render() {
  const width = mapEl.clientWidth || 900;
  const height = mapEl.clientHeight || 680;
  const svg = d3.select(mapEl);
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const projection = d3.geoMercator().fitSize([width, height], geo);
  const path = d3.geoPath(projection);

  svg
    .append("g")
    .selectAll("path")
    .data(geo.features)
    .join("path")
    .attr("class", (feature) =>
      getRegion(feature)?.visited ? "region is-visited" : "region",
    )
    .attr("d", path)
    .style("fill", (feature) => {
      const region = getRegion(feature);
      return region?.visited
        ? "#FFE8A3" : null;
    })
    .on("pointermove", (event, feature) => showTooltip(event, feature))
    .on("pointerleave", hideTooltip);

  renderList();
  renderStats();
}

function renderList() {
  listEl.replaceChildren(
    ...regions.map((region) => {
      const row = document.createElement("div");
      row.className = region.visited ? "region-item is-visited" : "region-item";

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      if (region.visited) {
        swatch.style.background = "#FFE8A3" || config.defaultVisitedColor;
      }

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = region.label || region.id;

      const status = document.createElement("span");
      status.className = "status";
      status.textContent = region.visited ? "O" : "X";

      row.append(swatch, label, status);
      return row;
    }),
  );
}

function renderStats() {
  const total = regions.length;
  const visited = regions.filter((region) => region.visited).length;
  visitedCountEl.textContent = String(visited);
  totalCountEl.textContent = String(total);
  percentEl.textContent = `${Math.round((visited / Math.max(total, 1)) * 100)}%`;
}

function showTooltip(event, feature) {
  const region = getRegion(feature);
  const label = region?.label || feature.properties.name_eng || feature.properties.code;
  tooltipEl.hidden = false;
  tooltipEl.textContent = `${label} ${region?.visited ? "O" : "X"}`;
  tooltipEl.style.left = `${event.clientX + 12}px`;
  tooltipEl.style.top = `${event.clientY + 12}px`;
}

function hideTooltip() {
  tooltipEl.hidden = true;
}

function getRegion(feature) {
  return byCode.get(String(feature.properties.code));
}

function normalizeRegions(config) {
  return (config.regions || []).map((region) => ({
    ...region,
    id: String(region.id),
    codes: (region.codes || [region.id]).map(String),
    visited: region.visited === true || region.visited === "O",
  }));
}

async function assertOk(response) {
  if (!response.ok) {
    throw new Error(`${response.url} ${response.status}`);
  }
  return response;
}
