export interface BoardSize {
    x: number;
    y: number;
}

export interface BoardColors {
    light: number;
    dark: number;
}

export interface CameraConfig {
    position: [number, number, number]; // Camera position (x, y, z)
    lookAt: [number, number, number];   // Camera target
    fov?: number; // Field of View (optional)
    near?: number; // Near clipping plane (optional)
    far?: number;  // Far clipping plane (optional)
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
    size: BoardSize; // Board grid size (e.g. 8 for 8x8)
    squareSize: number; // Each square's size
    colors: BoardColors; // Light and dark colors of the board
    cameraConfig?: CameraConfig; // Optional camera configuration
    lightConfig?: LightConfig; // Optional light configuration
    materialConfig?: MaterialConfig; // Optional material configuration for the board
}
export interface Piece {
    position: [number, number]; // Position on the grid
    color: number; // Piece color or texture
    type: string; // e.g., "checker", "king", etc.
}

export interface BoardConfig {
    size: BoardSize;
    squareSize: number;
    colors: BoardColors;
    cameraConfig?: CameraConfig;
    lightConfig?: LightConfig;
    materialConfig?: MaterialConfig;
    pieces?: Piece[]; // Add this to support pieces
}
