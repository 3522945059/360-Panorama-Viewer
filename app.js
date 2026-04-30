import * as THREE from "./node_modules/three/build/three.module.js";

const PANORAMA_MANIFEST_URL = "./assets/panoramas.json";
const LOCAL_STORAGE_KEY = "panorama-viewer-last-selection";
const INITIAL_YAW_DEG = 0;
const INITIAL_PITCH_DEG = 0;
const INITIAL_FOV = 72;
const MIN_FOV = 35;
const MAX_FOV = 95;
const DRAG_SENSITIVITY = 0.12;
const WHEEL_SENSITIVITY = 0.05;
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

const viewer = document.getElementById("viewer");
const statusNode = document.getElementById("status");
const emptyStateNode = document.getElementById("emptyState");
const fullscreenButton = document.getElementById("fullscreenButton");
const panoramaSelect = document.getElementById("panoramaSelect");
const replaceImageInput = document.getElementById("replaceImageInput");
let camera;
let renderer;
let scene;
let sphere;
let textureLoader;
let currentTexture;
let animationStarted = false;
let panoramaEntries = [];
let localObjectUrls = [];

let yaw = INITIAL_YAW_DEG;
let pitch = INITIAL_PITCH_DEG;
let isDragging = false;
let pointerId = null;
let previousPointer = { x: 0, y: 0 };

function setStatus(message) {
  statusNode.textContent = message;
}

function showEmptyState(show) {
  emptyStateNode.classList.toggle("hidden", !show);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function isImageFile(name) {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function updateCameraDirection() {
  const phi = toRadians(90 - pitch);
  const theta = toRadians(yaw);
  const target = new THREE.Vector3(
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.cos(theta),
  );

  camera.lookAt(target);
}

function resetView() {
  yaw = INITIAL_YAW_DEG;
  pitch = INITIAL_PITCH_DEG;
  camera.fov = INITIAL_FOV;
  camera.updateProjectionMatrix();
  updateCameraDirection();
}

function onResize() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function startDragging(event) {
  isDragging = true;
  pointerId = event.pointerId;
  previousPointer = { x: event.clientX, y: event.clientY };
  viewer.classList.add("is-dragging");
  viewer.setPointerCapture(pointerId);
}

function stopDragging() {
  isDragging = false;
  pointerId = null;
  viewer.classList.remove("is-dragging");
}

function handlePointerMove(event) {
  if (!isDragging || event.pointerId !== pointerId) {
    return;
  }

  const deltaX = event.clientX - previousPointer.x;
  const deltaY = event.clientY - previousPointer.y;

  yaw -= deltaX * DRAG_SENSITIVITY;
  pitch = clamp(pitch + deltaY * DRAG_SENSITIVITY, -85, 85);

  previousPointer = { x: event.clientX, y: event.clientY };
  updateCameraDirection();
}

function handleWheel(event) {
  event.preventDefault();
  camera.fov = clamp(
    camera.fov + event.deltaY * WHEEL_SENSITIVITY,
    MIN_FOV,
    MAX_FOV,
  );
  camera.updateProjectionMatrix();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  document.documentElement.requestFullscreen();
}

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function revokeLocalObjectUrls() {
  for (const url of localObjectUrls) {
    URL.revokeObjectURL(url);
  }
  localObjectUrls = [];
}

async function loadManifest() {
  const response = await fetch(PANORAMA_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  const manifest = await response.json();
  const items = Array.isArray(manifest?.panoramas) ? manifest.panoramas : [];

  return items
    .filter((item) => item?.file && item?.label)
    .map((item, index) => ({
      id: `builtin-${index}`,
      label: item.label,
      file: item.file,
      source: "builtin",
    }));
}

function populatePicker(items, preferredId) {
  panoramaSelect.innerHTML = "";

  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    panoramaSelect.appendChild(option);
  }

  panoramaSelect.disabled = items.length === 0;

  if (preferredId && items.some((item) => item.id === preferredId)) {
    panoramaSelect.value = preferredId;
  } else if (items[0]) {
    panoramaSelect.value = items[0].id;
  }
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => resolve(texture),
      undefined,
      () => reject(new Error("全景图加载失败")),
    );
  });
}

function getEntryById(entryId) {
  return panoramaEntries.find((item) => item.id === entryId);
}

function rememberSelection(entryId, sourceMode) {
  localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify({ entryId, sourceMode }),
  );
}

function readRememberedSelection() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function switchPanorama(entryId) {
  const entry = getEntryById(entryId);
  if (!entry) {
    setStatus("未找到所选全景图");
    showEmptyState(true);
    return;
  }

  setStatus(`正在加载：${entry.label}`);

  try {
    const texture = await loadTexture(entry.file);
    texture.colorSpace = THREE.SRGBColorSpace;

    if (currentTexture) {
      currentTexture.dispose();
    }

    currentTexture = texture;
    sphere.material.map = texture;
    sphere.material.needsUpdate = true;
    resetView();
    showEmptyState(false);
    panoramaSelect.value = entry.id;
    setStatus(`当前全景：${entry.label}`);
    rememberSelection(entry.id, entry.source);
  } catch {
    setStatus("全景图加载失败");
    showEmptyState(true);
  }
}

function createScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    INITIAL_FOV,
    viewer.clientWidth / viewer.clientHeight,
    0.1,
    1100,
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(viewer.clientWidth, viewer.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  viewer.appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(500, 80, 60);
  geometry.scale(-1, 1, 1);
  sphere = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  scene.add(sphere);

  textureLoader = new THREE.TextureLoader();
  resetView();
}

function createLocalEntry(file) {
  const objectUrl = URL.createObjectURL(file);
  localObjectUrls.push(objectUrl);

  return {
    id: `local-${Date.now()}`,
    label: file.name,
    file: objectUrl,
    source: "local",
  };
}

async function replaceCurrentWithFile(file) {
  if (!file || !isImageFile(file.name)) {
    setStatus("请选择 png、jpg、jpeg 或 webp 图片");
    return;
  }

  revokeLocalObjectUrls();

  const currentId = panoramaSelect.value;
  const currentEntry = getEntryById(currentId);
  const replacementEntry = createLocalEntry(file);

  if (!currentEntry) {
    panoramaEntries = [replacementEntry];
    populatePicker(panoramaEntries, replacementEntry.id);
    await switchPanorama(replacementEntry.id);
    return;
  }

  panoramaEntries = panoramaEntries.map((entry) =>
    entry.id === currentId
      ? { ...replacementEntry, id: entry.id, label: file.name }
      : entry,
  );

  populatePicker(panoramaEntries, currentId);
  await switchPanorama(currentId);
}

function bindEvents() {
  viewer.addEventListener("pointerdown", startDragging);
  viewer.addEventListener("pointermove", handlePointerMove);
  viewer.addEventListener("pointerup", stopDragging);
  viewer.addEventListener("pointerleave", stopDragging);
  viewer.addEventListener("pointercancel", stopDragging);
  viewer.addEventListener("wheel", handleWheel, { passive: false });
  panoramaSelect.addEventListener("change", (event) => {
    switchPanorama(event.target.value);
  });
  replaceImageInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    await replaceCurrentWithFile(file);
    replaceImageInput.value = "";
  });
  fullscreenButton.addEventListener("click", toggleFullscreen);
  window.addEventListener("resize", onResize);
}

async function init() {
  createScene();
  bindEvents();

  const builtinEntries = await loadManifest();
  const remembered = readRememberedSelection();

  if (builtinEntries.length === 0) {
    panoramaEntries = [];
    setStatus("请在页面中选择一张全景图");
    showEmptyState(true);
    panoramaSelect.disabled = true;
  } else {
    panoramaEntries = builtinEntries;
    populatePicker(
      panoramaEntries,
      remembered?.sourceMode === "builtin" ? remembered.entryId : undefined,
    );
    const targetId =
      remembered?.sourceMode === "builtin" && getEntryById(remembered.entryId)
        ? remembered.entryId
        : panoramaEntries[0].id;
    await switchPanorama(targetId);
  }

  if (!animationStarted) {
    animationStarted = true;
    animate();
  }
}

init();
