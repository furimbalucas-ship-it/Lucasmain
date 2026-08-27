import "cesium/Build/Cesium/Widgets/widgets.css";
import "./styles.css";

import {
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  Color,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
  HeightReference,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  VerticalOrigin,
  Viewer,
} from "cesium";

import { ITAMARACA_CENTER, ITAMARACA_POIS } from "./data/pois";
import { FirstPersonControls } from "./controls/firstPersonControls";

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

if (ionToken && ionToken !== "your_cesium_ion_token_here") {
  Ion.defaultAccessToken = ionToken;
}

const loadingEl = document.getElementById("loading")!;
const tokenWarningEl = document.getElementById("token-warning")!;
const coordsEl = document.getElementById("coords")!;
const poiListEl = document.getElementById("poi-list")!;

let terrainProvider: Awaited<ReturnType<typeof createWorldTerrainAsync>> | undefined;
let osmBuildings: Awaited<ReturnType<typeof createOsmBuildingsAsync>> | undefined;
let googleTileset: Cesium3DTileset | undefined;
let controls: FirstPersonControls;

async function initViewer(): Promise<Viewer> {
  const hasToken = Boolean(Ion.defaultAccessToken);

  if (!hasToken) {
    tokenWarningEl.classList.remove("hidden");
    document.getElementById("dismiss-token-warning")!.onclick = () => {
      tokenWarningEl.classList.add("hidden");
    };
  }

  if (hasToken) {
    try {
      terrainProvider = await createWorldTerrainAsync({
        requestWaterMask: true,
        requestVertexNormals: true,
      });
    } catch (e) {
      console.warn("Terreno indisponível:", e);
    }
  }

  const viewer = new Viewer("cesiumContainer", {
    terrainProvider,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    shadows: true,
    shouldAnimate: true,
  });

  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.fog.enabled = true;
  viewer.scene.fog.density = 0.00015;
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = true;
  }

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      ITAMARACA_CENTER.longitude,
      ITAMARACA_CENTER.latitude,
      ITAMARACA_CENTER.height,
    ),
    orientation: {
      heading: CesiumMath.toRadians(25),
      pitch: CesiumMath.toRadians(-35),
      roll: 0,
    },
    duration: 0,
  });

  return viewer;
}

async function loadOsmBuildings(viewer: Viewer): Promise<void> {
  if (!Ion.defaultAccessToken) return;
  try {
    osmBuildings = await createOsmBuildingsAsync();
    viewer.scene.primitives.add(osmBuildings);
  } catch (e) {
    console.warn("Edificações OSM indisponíveis:", e);
  }
}

async function loadGooglePhotorealistic(viewer: Viewer): Promise<boolean> {
  if (!googleKey || googleKey === "your_google_maps_api_key_here") return false;

  try {
    googleTileset = await Cesium3DTileset.fromUrl(
      `https://tile.googleapis.com/v1/3dtiles/root.json?key=${googleKey}`,
    );
    viewer.scene.primitives.add(googleTileset);
    if (osmBuildings) {
      osmBuildings.show = false;
    }
    return true;
  } catch (e) {
    console.warn("Google 3D Tiles indisponível:", e);
    return false;
  }
}

function addPoiMarkers(viewer: Viewer): void {
  for (const poi of ITAMARACA_POIS) {
    viewer.entities.add({
      id: poi.id,
      name: poi.name,
      description: poi.description,
      position: Cartesian3.fromDegrees(poi.longitude, poi.latitude, poi.height),
      point: {
        pixelSize: 12,
        color: Color.fromCssColorString("#22d3ee"),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${poi.emoji} ${poi.name}`,
        font: "600 13px DM Sans, sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString("#0b1220"),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -18),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }
}

function buildPoiList(fp: FirstPersonControls): void {
  poiListEl.innerHTML = "";
  for (const poi of ITAMARACA_POIS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "poi-btn";
    btn.innerHTML = `<strong>${poi.emoji} ${poi.name}</strong><span>${poi.description}</span>`;
    btn.onclick = () => {
      fp.teleportTo(poi.longitude, poi.latitude, poi.height + 2);
    };
    li.appendChild(btn);
    poiListEl.appendChild(li);
  }
}

function wireLayerToggles(viewer: Viewer): void {
  const buildingsToggle = document.getElementById("toggle-buildings") as HTMLInputElement;
  const terrainToggle = document.getElementById("toggle-terrain") as HTMLInputElement;
  const googleToggle = document.getElementById("toggle-google-3d") as HTMLInputElement;
  const googleRow = document.getElementById("google-tiles-row")!;

  if (!googleKey || googleKey === "your_google_maps_api_key_here") {
    googleRow.style.opacity = "0.45";
    googleToggle.disabled = true;
    googleRow.title = "Configure VITE_GOOGLE_MAPS_API_KEY no .env";
  }

  buildingsToggle.onchange = () => {
    if (osmBuildings) {
      osmBuildings.show = buildingsToggle.checked && !googleTileset?.show;
    }
  };

  terrainToggle.onchange = () => {
    viewer.terrainProvider = terrainToggle.checked && terrainProvider
      ? terrainProvider
      : (undefined as never);
  };

  googleToggle.onchange = async () => {
    if (googleToggle.checked) {
      const ok = googleTileset ? true : await loadGooglePhotorealistic(viewer);
      if (googleTileset) googleTileset.show = ok;
      if (ok && osmBuildings) {
        osmBuildings.show = false;
        buildingsToggle.checked = false;
      } else {
        googleToggle.checked = false;
      }
    } else if (googleTileset) {
      googleTileset.show = false;
      if (osmBuildings) {
        osmBuildings.show = buildingsToggle.checked;
      }
    }
  };
}

async function main(): Promise<void> {
  const viewer = await initViewer();
  await loadOsmBuildings(viewer);
  addPoiMarkers(viewer);

  controls = new FirstPersonControls(viewer, { eyeHeight: 1.75, moveSpeed: 28 });
  controls.teleportTo(
    ITAMARACA_CENTER.longitude,
    ITAMARACA_CENTER.latitude,
    ITAMARACA_CENTER.height * 0.15 + 30,
  );

  buildPoiList(controls);
  wireLayerToggles(viewer);

  viewer.clock.onTick.addEventListener(() => {
    coordsEl.textContent = controls.getCoordsText();
  });

  loadingEl.classList.add("hidden");
}

main().catch((err) => {
  console.error(err);
  loadingEl.querySelector("p")!.textContent =
    "Erro ao carregar. Verifique o token Cesium Ion no .env";
});
