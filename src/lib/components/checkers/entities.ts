
// ---- export Interfaces ----
import * as THREE from 'three';

// Scene configuration export interfaces
export interface SceneConfig {
    canvas: HTMLCanvasElement;
    boardConfig: BoardConfig;
}

// Board configuration and entities
export interface BoardSize {
    x: number;
    y: number;
}

export interface BoardColors {
    light: number;
    dark: number;
}

export interface CameraConfig {
    position: [number, number, number];
    lookAt: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
}

export interface LightConfig {
    ambientColor: number;
    directionalColor: number;
    directionalIntensity: number;
}

export interface MaterialConfig {
    opacity?: number;
    wireframe?: boolean;
}

export interface BoardConfig {
    size: BoardSize;
    squareSize: number;
    colors: BoardColors;
    cameraConfig?: CameraConfig;
    lightConfig?: LightConfig;
    materialConfig?: MaterialConfig;
    pieces?: Piece[];
}

// Position and Piece-related export interfaces
export interface Position {
    x: number;
    y: number;
}

export interface Piece {
    id: string;
    position: Position;
    color: number;
    type: string;
    king?: boolean;
}

// Movement rules for pieces
export interface MovementRules {
    allowedMoves: (piece: Piece) => Position[];
    canCapture?: (piece: Piece, targetPiece: Piece) => boolean;
}

// Raycasting and clicking event configuration
export interface ClickEventConfig {
    event: MouseEvent;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    boardConfig: BoardConfig;
    pieceMeshes: Map<string, THREE.Mesh>;
    highlightedSquares: { mesh: THREE.Mesh; position: Position }[];
}

// Piece movement
export interface PieceMoveConfig {
    piece: Piece;
    newPosition: Position;
    boardConfig: BoardConfig;
    pieceMeshes: Map<string, THREE.Mesh>;
    scene: THREE.Scene;
    highlightedSquares: { mesh: THREE.Mesh; position: Position }[];
}

// Highlighting squares
export interface HighlightConfig {
    validMoves: Position[];
    squareSize: number;
}

// Camera resize handler
export interface ResizeHandlerConfig {
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    canvas: HTMLCanvasElement;
}

// Scene rendering and animation config
export interface AnimationConfig {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
}
export interface MoveCaptuireConfig {
    piece: Piece;
    boardConfig: BoardConfig;
    directions: { x: number; y: number }[];
    capturedPieces: Position[];
}