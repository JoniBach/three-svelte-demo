import * as THREE from 'three';
import type { SceneConfig, CameraConfig, LightConfig, BoardConfig, Piece, AnimationConfig } from '../entities';


export function initScene({ canvas, boardConfig, pieceMeshes }: SceneConfig): {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    board: THREE.Group;
} {
    const scene = createScene();
    const camera = createCamera({ canvas, config: boardConfig.cameraConfig });
    const renderer = createRenderer({ canvas });
    const board = createBoard({ config: boardConfig });

    // Enable the camera to render both layer 0 (board) and layer 1 (pieces)
    camera.layers.enable(0); // Enable the default layer (for the board)
    camera.layers.enable(1); // Enable layer 1 (for the pieces)

    scene.add(board);

    if (boardConfig.pieces) {
        addPiecesToBoard({ scene, pieces: boardConfig.pieces, squareSize: boardConfig.squareSize, boardConfig, pieceMeshes });
    }

    addLights({ scene, config: boardConfig.lightConfig });
    animateThrottled({ renderer, scene, camera });

    return { scene, renderer, camera, board };
}


function createScene(): THREE.Scene {
    return new THREE.Scene();
}

function createRenderer({ canvas }: { canvas: HTMLCanvasElement }): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    return renderer;
}

function createCamera({
    canvas,
    config
}: {
    canvas: HTMLCanvasElement;
    config?: CameraConfig;
}): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        config?.fov ?? 70,
        canvas.clientWidth / canvas.clientHeight,
        config?.near ?? 0.1,
        config?.far ?? 1000
    );
    const position = config?.position ?? [0, 15, 0];
    const lookAt = config?.lookAt ?? [0, 0, 0];

    camera.position.set(...position);
    camera.lookAt(...lookAt);
    return camera;
}

function addLights({ scene, config }: { scene: THREE.Scene; config?: LightConfig }): void {
    const ambientLight = new THREE.AmbientLight(config?.ambientColor ?? 0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
        config?.directionalColor ?? 0xffffff,
        config?.directionalIntensity ?? 0.5
    );
    directionalLight.position.set(0, 1, 0).normalize();
    scene.add(directionalLight);
}

function createBoard({ config }: { config: BoardConfig }): THREE.Group {
    const { size, squareSize, colors, materialConfig } = config;
    const { x: rows, y: columns } = size;
    const board = new THREE.Group();

    for (let x = 0; x < rows; x++) {
        for (let z = 0; z < columns; z++) {
            const color = (x + z) % 2 === 0 ? colors.light : colors.dark;
            const geometry = new THREE.PlaneGeometry(squareSize, squareSize);
            const material = new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide,
                opacity: materialConfig?.opacity ?? 1,
                transparent: materialConfig?.opacity !== undefined,
                wireframe: materialConfig?.wireframe ?? false
            });
            const square = new THREE.Mesh(geometry, material);
            square.rotation.x = -Math.PI / 2;
            square.position.set(x - rows / 2 + squareSize / 2, 0, z - columns / 2 + squareSize / 2);
            board.add(square);
        }
    }
    return board;
}

function addPiecesToBoard({
    scene,
    pieces,
    squareSize,
    boardConfig,
    pieceMeshes
}: {
    scene: THREE.Scene;
    pieces: Piece[];
    squareSize: number;
    boardConfig: BoardConfig;
    pieceMeshes: Map<string, THREE.Mesh>;
}): void {
    pieces.forEach((piece) => {
        const pieceMesh = renderPiece({ piece, squareSize, boardConfig });
        scene.add(pieceMesh);
        pieceMeshes.set(piece.id, pieceMesh);
    });
}

function animateThrottled({ renderer, scene, camera }: AnimationConfig): void {
    let lastRenderTime = 0;
    const renderInterval = 1000 / 30;

    const animate = (currentTime: number) => {
        if (currentTime - lastRenderTime >= renderInterval) {
            renderer.render(scene, camera);
            lastRenderTime = currentTime;
        }
        requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
}

function renderPiece({
    piece,
    squareSize,
    boardConfig
}: {
    piece: Piece;
    squareSize: number;
    boardConfig: BoardConfig;
}): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(squareSize / 4, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: piece.color });
    const pieceMesh = new THREE.Mesh(geometry, material);

    const pieceHeight = squareSize / 4;
    pieceMesh.position.set(
        piece.position.x - boardConfig.size.x / 2 + squareSize / 2,
        pieceHeight / 2,
        piece.position.y - boardConfig.size.y / 2 + squareSize / 2
    );

    pieceMesh.layers.set(1);

    return pieceMesh;
}
