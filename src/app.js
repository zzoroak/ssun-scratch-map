const MAP_PATH = "./data/map.topo.json";
const VISITED_PATH = "./data/visited.json";
const TOPO_OBJECT = "skorea_municipalities_geo";
const ISLAND_DISPLAY_BOUNDS = {
  minLng: 125.4,
  maxLng: 131.2,
  minLat: 33.0,
  maxLat: 38.75,
};
const MIN_VISIBLE_ISLAND_AREA = 0.006;
const REGION_DISPLAY_ADJUSTMENTS = {
  "39000": {
    targetCenter: [126.55, 33.78],
    scale: 0.85,
  },
  "37430": {
    targetCenter: [129.65, 37.35],
    scale: 1,
  },
  "23320": {
    targetCenter: [126.58, 37.48],
    scale: 0.45,
    minArea: 0,
  },
};

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

const geo = filterVisibleMapFeatures(
  topojson.feature(topology, topology.objects[TOPO_OBJECT]),
);
const regions = normalizeRegions(config);
const byCode = new Map();
const featuresByCode = new Map();

for (const feature of geo.features) {
  const code = String(feature.properties.code);
  const features = featuresByCode.get(code) || [];
  features.push(feature);
  featuresByCode.set(code, features);
}

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

  renderRegionEmojis(svg, path);
  renderList();
  renderStats();
}

function renderRegionEmojis(svg, path) {
  const emojiRegions = regions
    .map((region) => ({
      region,
      features: getRegionFeatures(region),
    }))
    .filter(({ region, features }) => region.emoji && features.length > 0);

  svg
    .append("g")
    .attr("class", "emoji-layer")
    .selectAll("text")
    .data(emojiRegions)
    .join("text")
    .attr("class", "region-emoji")
    .attr("x", ({ features }) => path.centroid(toFeatureCollection(features))[0])
    .attr("y", ({ features }) => path.centroid(toFeatureCollection(features))[1])
    .text(({ region }) => region.emoji);
}

function getRegionFeatures(region) {
  return region.codes.flatMap((code) => featuresByCode.get(String(code)) || []);
}

function toFeatureCollection(features) {
  return {
    type: "FeatureCollection",
    features,
  };
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
  const emoji = region?.emoji ? `${region.emoji} ` : "";
  tooltipEl.textContent = `${emoji}${label} ${region?.visited ? "O" : "X"}`;
  tooltipEl.style.left = `${event.clientX + 12}px`;
  tooltipEl.style.top = `${event.clientY + 12}px`;
}

function hideTooltip() {
  tooltipEl.hidden = true;
}

function getRegion(feature) {
  return byCode.get(String(feature.properties.code));
}

function filterVisibleMapFeatures(featureCollection) {
  return {
    ...featureCollection,
    features: featureCollection.features
      .map(filterVisibleFeature)
      .filter(Boolean),
  };
}

function filterVisibleFeature(feature) {
  const adjustment = getRegionDisplayAdjustment(feature);
  const geometry = adjustment
    ? adjustDisplayGeometry(feature.geometry, adjustment)
    : filterVisibleGeometry(feature.geometry);

  return geometry ? { ...feature, geometry } : null;
}

function getRegionDisplayAdjustment(feature) {
  return REGION_DISPLAY_ADJUSTMENTS[String(feature.properties.code)];
}

function adjustDisplayGeometry(geometry, adjustment) {
  const visibleGeometry = filterGeometryByArea(geometry, adjustment.minArea ?? 0);
  if (!visibleGeometry) {
    return null;
  }

  const bounds = getGeometryBounds(visibleGeometry);
  const sourceCenter = [
    (bounds.minLng + bounds.maxLng) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
  ];

  return transformGeometry(visibleGeometry, ([lng, lat]) => [
    adjustment.targetCenter[0] + (lng - sourceCenter[0]) * adjustment.scale,
    adjustment.targetCenter[1] + (lat - sourceCenter[1]) * adjustment.scale,
  ]);
}

function filterGeometryByArea(geometry, minArea) {
  if (geometry.type === "Polygon") {
    return getRingArea(geometry.coordinates[0]) >= minArea ? geometry : null;
  }

  if (geometry.type === "MultiPolygon") {
    const coordinates = geometry.coordinates.filter(
      (polygon) => getRingArea(polygon[0]) >= minArea,
    );

    return coordinates.length ? { ...geometry, coordinates } : null;
  }

  return geometry;
}

function getGeometryBounds(geometry) {
  const rings = geometry.type === "Polygon"
    ? [geometry.coordinates[0]]
    : geometry.coordinates.map((polygon) => polygon[0]);

  return rings.reduce(
    (bounds, ring) => mergeBounds(bounds, getRingBounds(ring)),
    {
      minLng: Infinity,
      maxLng: -Infinity,
      minLat: Infinity,
      maxLat: -Infinity,
    },
  );
}

function transformGeometry(geometry, transformPoint) {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => ring.map(transformPoint)),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => ring.map(transformPoint)),
      ),
    };
  }

  return geometry;
}

function filterVisibleGeometry(geometry) {
  if (geometry.type === "Polygon") {
    return isInsideDisplayBounds(getRingBounds(geometry.coordinates[0]))
      ? geometry
      : null;
  }

  if (geometry.type === "MultiPolygon") {
    const coordinates = geometry.coordinates.filter(shouldShowIslandPart);
    return coordinates.length ? { ...geometry, coordinates } : null;
  }

  return geometry;
}

function shouldShowIslandPart(polygon) {
  const ring = polygon[0];
  if (!ring || ring.length < 4) {
    return false;
  }

  return getRingArea(ring) >= MIN_VISIBLE_ISLAND_AREA
    && isInsideDisplayBounds(getRingBounds(ring));
}

function isInsideDisplayBounds(bounds) {
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;

  return centerLng >= ISLAND_DISPLAY_BOUNDS.minLng
    && centerLng <= ISLAND_DISPLAY_BOUNDS.maxLng
    && centerLat >= ISLAND_DISPLAY_BOUNDS.minLat
    && centerLat <= ISLAND_DISPLAY_BOUNDS.maxLat;
}

function mergeBounds(a, b) {
  return {
    minLng: Math.min(a.minLng, b.minLng),
    maxLng: Math.max(a.maxLng, b.maxLng),
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
  };
}

function getRingBounds(ring) {
  return ring.reduce(
    (bounds, [lng, lat]) => ({
      minLng: Math.min(bounds.minLng, lng),
      maxLng: Math.max(bounds.maxLng, lng),
      minLat: Math.min(bounds.minLat, lat),
      maxLat: Math.max(bounds.maxLat, lat),
    }),
    {
      minLng: Infinity,
      maxLng: -Infinity,
      minLat: Infinity,
      maxLat: -Infinity,
    },
  );
}

function getRingArea(ring) {
  return Math.abs(
    ring.reduce((area, [lng, lat], index) => {
      const [nextLng, nextLat] = ring[(index + 1) % ring.length];
      return area + lng * nextLat - nextLng * lat;
    }, 0) / 2,
  );
}

function normalizeRegions(config) {
  return (config.regions || []).map((region) => ({
    ...region,
    id: String(region.id),
    codes: (region.codes || [region.id]).map(String),
    visited: region.visited === true || region.visited === "O",
    emoji: typeof region.emoji === "string" && region.emoji.trim() ? region.emoji : null,
  }));
}

async function assertOk(response) {
  if (!response.ok) {
    throw new Error(`${response.url} ${response.status}`);
  }
  return response;
}
