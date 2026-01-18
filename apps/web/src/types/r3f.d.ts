import type { ThreeElements } from "@react-three/fiber";

/**
 * Ensure React Three Fiber JSX intrinsic elements like:
 * <mesh />, <ambientLight />, <directionalLight />, etc.
 *
 * This is a defensive shim so TS always picks up the R3F JSX augmentation.
 */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module "react/jsx-dev-runtime" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
