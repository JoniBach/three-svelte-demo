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
    size: BoardSize;
    squareSize: number;
    colors: BoardColors;
    cameraConfig?: CameraConfig;
    lightConfig?: LightConfig;
    materialConfig?: MaterialConfig;
    pieces?: Piece[];  // Add pieces to the board configuration
}

export interface Position {
    x: number;
    y: number;
}

export interface Piece {
    id: string;  // Unique identifier for the piece
    position: Position; // Position on the grid
    color: number;  // Color of the piece
    type: string;   // Type of the piece (e.g., "checker", "pawn", etc.)
    king?: boolean; // Whether the piece is a king
}

export interface MovementRules {
    allowedMoves: (piece: Piece, boardConfig: BoardConfig) => Position[]; // Returns a list of valid positions
    canCapture?: (piece: Piece, targetPiece: Piece) => boolean; // Defines capture rules
}
