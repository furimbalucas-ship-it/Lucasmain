import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  SceneMode,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from "cesium";

export interface FirstPersonOptions {
  moveSpeed?: number;
  sprintMultiplier?: number;
  lookSensitivity?: number;
  eyeHeight?: number;
}

const DEFAULTS: Required<FirstPersonOptions> = {
  moveSpeed: 25,
  sprintMultiplier: 2.2,
  lookSensitivity: 0.0022,
  eyeHeight: 1.7,
};

export class FirstPersonControls {
  private viewer: Viewer;
  private options: Required<FirstPersonOptions>;
  private handler: ScreenSpaceEventHandler;
  private keys = new Set<string>();
  private pointerLocked = false;
  private heading = 0;
  private pitch = -0.25;
  private enabled = true;

  constructor(viewer: Viewer, options: FirstPersonOptions = {}) {
    this.viewer = viewer;
    this.options = { ...DEFAULTS, ...options };
    this.handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;
    viewer.scene.mode = SceneMode.SCENE3D;

    this.bindEvents();
    this.syncCameraFromPosition(viewer.camera.positionCartographic);
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  teleportTo(longitude: number, latitude: number, height: number): void {
    const carto = Cartographic.fromDegrees(longitude, latitude, height);
    this.heading = 0;
    this.pitch = -0.35;
    this.applyCamera(carto);
  }

  private bindEvents(): void {
    const canvas = this.viewer.scene.canvas;

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    canvas.addEventListener("click", () => {
      if (!this.pointerLocked) {
        canvas.requestPointerLock();
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked || !this.enabled) return;
      this.heading += e.movementX * this.options.lookSensitivity;
      this.pitch -= e.movementY * this.options.lookSensitivity;
      this.pitch = CesiumMath.clamp(
        this.pitch,
        -CesiumMath.PI_OVER_TWO + 0.05,
        CesiumMath.PI_OVER_TWO - 0.05,
      );
    });

    this.handler.setInputAction(() => {
      document.exitPointerLock();
    }, ScreenSpaceEventType.RIGHT_CLICK);

    this.viewer.clock.onTick.addEventListener(this.tick);
  }

  private tick = (): void => {
    if (!this.enabled) return;

    const camera = this.viewer.camera;
    const carto = camera.positionCartographic;
    if (!carto) return;

    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) moveY += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) moveY -= 1;
    if (this.keys.has("KeyA")) moveX -= 1;
    if (this.keys.has("KeyD")) moveX += 1;
    if (this.keys.has("Space")) moveZ += 1;
    if (this.keys.has("KeyC")) moveZ -= 1;

    if (moveX === 0 && moveY === 0 && moveZ === 0) {
      this.applyCamera(carto);
      return;
    }

    const speed =
      this.options.moveSpeed *
      (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")
        ? this.options.sprintMultiplier
        : 1);

    const dt = 1 / 60;

    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);

    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLon =
      metersPerDegreeLat * Math.cos(carto.latitude);

    const deltaLon =
      ((moveY * sinH + moveX * cosH) * speed * dt) / metersPerDegreeLon;
    const deltaLat =
      ((moveY * cosH - moveX * sinH) * speed * dt) / metersPerDegreeLat;

    let nextHeight = carto.height + moveZ * speed * dt;

    const groundHeight = this.viewer.scene.globe.getHeight(carto);
    const minHeight = (groundHeight ?? carto.height) + this.options.eyeHeight;
    nextHeight = Math.max(minHeight, nextHeight);

    const nextCarto = Cartographic.fromRadians(
      carto.longitude + deltaLon,
      carto.latitude + deltaLat,
      nextHeight,
    );

    this.applyCamera(nextCarto);
  };

  private applyCamera(carto: Cartographic): void {
    const position = Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      carto.height,
    );

    this.viewer.camera.setView({
      destination: position,
      orientation: {
        heading: this.heading,
        pitch: this.pitch,
        roll: 0,
      },
    });
  }

  private syncCameraFromPosition(carto: Cartographic): void {
    this.pitch = this.viewer.camera.pitch;
    this.heading = this.viewer.camera.heading;
    this.applyCamera(carto);
  }

  getCoordsText(): string {
    const c = this.viewer.camera.positionCartographic;
    if (!c) return "—";
    const lon = CesiumMath.toDegrees(c.longitude).toFixed(5);
    const lat = CesiumMath.toDegrees(c.latitude).toFixed(5);
    const alt = c.height.toFixed(0);
    return `${lat}°, ${lon}° · ${alt} m`;
  }

  screenToCartographic(screenPos: Cartesian2): Cartographic | undefined {
    const ray = this.viewer.camera.getPickRay(screenPos);
    if (!ray) return undefined;
    const hit = this.viewer.scene.globe.pick(ray, this.viewer.scene);
    if (!hit) return undefined;
    return Cartographic.fromCartesian(hit);
  }

  destroy(): void {
    this.handler.destroy();
    this.viewer.clock.onTick.removeEventListener(this.tick);
  }
}
