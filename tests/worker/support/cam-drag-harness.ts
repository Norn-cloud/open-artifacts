import { HANDOFF_SVGS } from "../../../src/handoff";
import { cam } from "../../../src/handoff/cam";

export interface PointerEventStub {
  button: number;
  clientX: number;
  clientY: number;
  isPrimary: boolean;
  pointerId: number;
  preventDefault(): void;
  target: CamElementStub;
}

type PointerListener = (event: PointerEventStub) => void;

interface CamStyleStub {
  bottom: string;
  left: string;
  right: string;
  top: string;
  transform: string;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
  setProperty(name: string, value: string): void;
}

export interface CamElementStub {
  capturedPointers: Set<number>;
  hidden: boolean;
  style: CamStyleStub;
  getBoundingClientRect(): {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  hasAttribute(name: string): boolean;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
  setPointerCapture(pointerId: number): void;
}

function createStyle(): CamStyleStub {
  const customProperties = new Map<string, string>();
  return {
    bottom: "",
    left: "",
    right: "",
    top: "",
    transform: "",
    getPropertyValue: (name) => customProperties.get(name) ?? "",
    removeProperty: (name) => {
      customProperties.delete(name);
    },
    setProperty: (name, value) => {
      customProperties.set(name, value);
    },
  };
}

function numericCssValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function transformOffset(transform: string): { x: number; y: number } {
  const match = transform.match(/translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
}

function createCamElement(
  initialLeft: number,
  initialTop: number,
): CamElementStub {
  const attributes = new Set<string>();
  const capturedPointers = new Set<number>();
  const style = createStyle();
  return {
    capturedPointers,
    hidden: false,
    style,
    getBoundingClientRect: () => {
      const inlineLeft = Number.parseFloat(style.left);
      const inlineTop = Number.parseFloat(style.top);
      const transform = transformOffset(style.transform);
      const dragX =
        numericCssValue(style.getPropertyValue("--oa-cam-drag-x")) ||
        transform.x;
      const dragY =
        numericCssValue(style.getPropertyValue("--oa-cam-drag-y")) ||
        transform.y;
      return {
        height: 160,
        left: (Number.isFinite(inlineLeft) ? inlineLeft : initialLeft) + dragX,
        top: (Number.isFinite(inlineTop) ? inlineTop : initialTop) + dragY,
        width: 160,
      };
    },
    hasAttribute: (name) => attributes.has(name),
    hasPointerCapture: (pointerId) => capturedPointers.has(pointerId),
    releasePointerCapture: (pointerId) => {
      capturedPointers.delete(pointerId);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    },
    setAttribute: (name) => {
      attributes.add(name);
    },
    setPointerCapture: (pointerId) => {
      capturedPointers.add(pointerId);
    },
  };
}

function executeRuntime(
  documentStub: object,
  windowStub: object,
  storageStub: object,
  camera: CamElementStub,
  canvas: CamElementStub,
): { setBlur(value: boolean): void } {
  // The production module is an inline script string, so execute it against a
  // deliberately tiny DOM contract instead of duplicating its drag algorithm.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(
    "document",
    "window",
    "localStorage",
    "cam",
    "segCanvas",
    "camBlur",
    "stopSeg",
    "startSeg",
    `${cam(HANDOFF_SVGS)}
      makeCamDraggable();
      return { setBlur: function(value){ camBlur=value; } };
    `,
  )(
    documentStub,
    windowStub,
    storageStub,
    camera,
    canvas,
    false,
    () => {},
    () => {},
  ) as { setBlur(value: boolean): void };
}

function pointer(
  target: CamElementStub,
  pointerId: number,
  clientX: number,
  clientY: number,
): PointerEventStub {
  return {
    button: 0,
    clientX,
    clientY,
    isPrimary: true,
    pointerId,
    preventDefault: () => {},
    target,
  };
}

function dispatch(
  listeners: Map<string, PointerListener>,
  type: string,
  event: PointerEventStub,
): void {
  const listener = listeners.get(type);
  if (!listener) throw new Error(`missing ${type} listener`);
  listener(event);
}

export function createCamDragHarness(savedPosition?: {
  left: number;
  top: number;
}) {
  const documentListeners = new Map<string, PointerListener>();
  const windowListeners = new Map<string, PointerListener>();
  const storage = new Map<string, string>();
  if (savedPosition) {
    storage.set("oa-handoff-cam-pos", JSON.stringify(savedPosition));
  }
  const camera = createCamElement(600, 300);
  const canvas = createCamElement(600, 300);
  canvas.hidden = true;
  const documentStub = {
    addEventListener: (type: string, listener: PointerListener) => {
      documentListeners.set(type, listener);
    },
  };
  const windowStub = {
    addEventListener: (type: string, listener: PointerListener) => {
      windowListeners.set(type, listener);
    },
    innerHeight: 600,
    innerWidth: 800,
  };
  const storageStub = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };
  const runtime = executeRuntime(
    documentStub,
    windowStub,
    storageStub,
    camera,
    canvas,
  );
  return {
    camera,
    canvas,
    dispatchDocument: (type: string, event: PointerEventStub): void =>
      dispatch(documentListeners, type, event),
    dispatchWindow: (type: string, event: PointerEventStub): void =>
      dispatch(windowListeners, type, event),
    pointer,
    runtime,
    storage,
  };
}
