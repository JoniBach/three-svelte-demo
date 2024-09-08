<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { BoardConfig, Piece, Position, MovementRules } from './types';

	// Passed down config for board settings
	export let boardConfig: BoardConfig;

	// DOM element reference
	let canvas: HTMLCanvasElement;

	// Track piece meshes and state
	let pieceMeshes: Map<string, THREE.Mesh> = new Map();
	let selectedPiece: Piece | null = null;
	let validMoves: Position[] = [];
	let highlightedSquares: { mesh: THREE.Mesh; position: Position }[] = [];
	let raycaster = new THREE.Raycaster();
	let mouse = new THREE.Vector2();
	let currentPlayer: number = 0xff0000; // Red starts first

	// Three.js main elements
	let camera: THREE.PerspectiveCamera;
	let scene: THREE.Scene;
	let renderer: THREE.WebGLRenderer;
	let board: THREE.Group;

	/**
	 * Initializes the scene by creating the camera, board, renderer, and lights.
	 * The function is modular and can be extended for different games.
	 *
	 * @param canvas - The HTML canvas to render to
	 * @param boardConfig - Configuration for board settings
	 */
	function initScene(
		canvas: HTMLCanvasElement,
		boardConfig: BoardConfig
	): { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } {
		scene = createScene();
		camera = createCamera(canvas, boardConfig.cameraConfig);
		renderer = createRenderer(canvas);

		// Create and add the game board
		board = createBoard(boardConfig);
		scene.add(board);

		// Add pieces to the board (extensible for different games)
		if (boardConfig.pieces) {
			addPiecesToBoard(scene, boardConfig.pieces, boardConfig.squareSize);
		}

		// Add lighting to the scene
		addLights(scene, boardConfig.lightConfig);

		// Start the animation/render loop
		animateThrottled(renderer, scene, camera);

		return { scene, renderer, camera };
	}

	/**
	 * Creates the Three.js scene, which will hold the objects.
	 *
	 * @returns A new Three.js Scene instance.
	 */
	function createScene(): THREE.Scene {
		return new THREE.Scene();
	}

	/**
	 * Creates the WebGL renderer for Three.js.
	 *
	 * @param canvas - The HTML canvas to render to.
	 * @returns A WebGLRenderer.
	 */
	function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
		const renderer = new THREE.WebGLRenderer({ canvas });
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		return renderer;
	}

	/**
	 * Creates a perspective camera for the game view.
	 *
	 * @param canvas - The canvas to base aspect ratio on.
	 * @param config - Optional camera configuration.
	 * @returns A PerspectiveCamera instance.
	 */
	function createCamera(
		canvas: HTMLCanvasElement,
		config?: {
			position: [number, number, number];
			lookAt: [number, number, number];
			fov?: number;
			near?: number;
			far?: number;
		}
	): THREE.PerspectiveCamera {
		const camera = new THREE.PerspectiveCamera(
			config?.fov ?? 70,
			canvas.clientWidth / canvas.clientHeight,
			config?.near ?? 0.1,
			config?.far ?? 1000
		);
		const position = config?.position ?? [0, 15, 0]; // Default top-down view
		const lookAt = config?.lookAt ?? [0, 0, 0];

		camera.position.set(...position);
		camera.lookAt(...lookAt);
		return camera;
	}

	/**
	 * Adds ambient and directional lights to the scene.
	 *
	 * @param scene - The Three.js scene to add lights to.
	 * @param config - Optional lighting configuration.
	 */
	function addLights(
		scene: THREE.Scene,
		config?: { ambientColor: number; directionalColor: number; directionalIntensity: number }
	): void {
		const ambientLight = new THREE.AmbientLight(config?.ambientColor ?? 0x404040);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(
			config?.directionalColor ?? 0xffffff,
			config?.directionalIntensity ?? 0.5
		);
		directionalLight.position.set(0, 1, 0).normalize();
		scene.add(directionalLight);
	}

	/**
	 * Creates the board, which consists of a grid of alternating colored squares.
	 * This function can be reused for checkers, chess, or any grid-based game.
	 *
	 * @param config - Board configuration for size, colors, etc.
	 * @returns A Three.js Group representing the board.
	 */
	function createBoard(config: BoardConfig): THREE.Group {
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

	/**
	 * Adds the pieces to the board. The pieces can be checkers, chess pieces, or any other game pieces.
	 *
	 * @param scene - The scene where the pieces will be added.
	 * @param pieces - The list of pieces to be added to the board.
	 * @param squareSize - Size of each square on the board.
	 */
	function addPiecesToBoard(scene: THREE.Scene, pieces: Piece[], squareSize: number) {
		pieces.forEach((piece) => {
			const pieceMesh = renderPiece(piece, squareSize);
			scene.add(pieceMesh);
			pieceMeshes.set(piece.id, pieceMesh);
		});
	}

	/**
	 * Renders a game piece, e.g., a checker or chess piece, as a sphere.
	 *
	 * @param piece - The piece to render.
	 * @param squareSize - The size of each square.
	 * @returns A Three.js mesh representing the piece.
	 */
	function renderPiece(piece: Piece, squareSize: number): THREE.Mesh {
		const geometry = new THREE.SphereGeometry(squareSize / 4, 32, 32); // Default sphere shape for a piece
		const material = new THREE.MeshBasicMaterial({ color: piece.color });
		const pieceMesh = new THREE.Mesh(geometry, material);

		pieceMesh.position.set(
			piece.position.x - boardConfig.size.x / 2 + squareSize / 2,
			squareSize / 4,
			piece.position.y - boardConfig.size.y / 2 + squareSize / 2
		);

		return pieceMesh;
	}

	/**
	 * Throttles the render loop for improved performance (30 FPS).
	 *
	 * @param renderer - WebGLRenderer instance.
	 * @param scene - The Three.js scene.
	 * @param camera - The camera used for rendering.
	 */
	function animateThrottled(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		camera: THREE.PerspectiveCamera
	): void {
		let lastRenderTime = 0;
		const renderInterval = 1000 / 30; // 30 FPS limit

		const animate = (currentTime: number) => {
			if (currentTime - lastRenderTime >= renderInterval) {
				renderer.render(scene, camera);
				lastRenderTime = currentTime;
			}
			requestAnimationFrame(animate);
		};

		requestAnimationFrame(animate);
	}

	/**
	 * Movement rules for checkers (basic forward and capture logic).
	 * Extendable to add more complex game rules.
	 *
	 * @returns Movement rules for a checker piece.
	 */
	function getCheckerMovementRules(): MovementRules {
		return {
			allowedMoves: (piece: Piece, boardConfig: BoardConfig): Position[] => {
				const moves: Position[] = [];
				const isRedPlayer = piece.color === 0xff0000; // Red moves upwards

				// Directions for movement (adjust for red/blue)
				const directions = [
					{ x: 1, y: isRedPlayer ? 1 : -1 },
					{ x: -1, y: isRedPlayer ? 1 : -1 }
				];

				// Calculate possible moves
				directions.forEach((dir) => {
					const adjacentX = piece.position.x + dir.x;
					const adjacentY = piece.position.y + dir.y;

					// Ensure the move stays within the board limits
					if (
						adjacentX >= 0 &&
						adjacentX < boardConfig.size.x &&
						adjacentY >= 0 &&
						adjacentY < boardConfig.size.y
					) {
						const occupiedPiece = boardConfig.pieces?.find(
							(p) => p.position.x === adjacentX && p.position.y === adjacentY
						);

						// Empty square: regular move
						if (!occupiedPiece) {
							moves.push({ x: adjacentX, y: adjacentY });
						}
						// Capture move
						else if (occupiedPiece.color !== piece.color) {
							const jumpX = piece.position.x + dir.x * 2;
							const jumpY = piece.position.y + dir.y * 2;
							if (
								jumpX >= 0 &&
								jumpX < boardConfig.size.x &&
								jumpY >= 0 &&
								jumpY < boardConfig.size.y &&
								!boardConfig.pieces?.some((p) => p.position.x === jumpX && p.position.y === jumpY)
							) {
								moves.push({ x: jumpX, y: jumpY });
							}
						}
					}
				});

				return moves;
			},
			canCapture: (piece: Piece, targetPiece: Piece) => piece.color !== targetPiece.color
		};
	}

	/**
	 * Determines the movement rules for a piece based on its type.
	 * Extend this function to handle multiple games like checkers and chess.
	 *
	 * @param piece - The piece to determine the movement rules for.
	 * @returns The movement rules for the piece.
	 */
	function getMovementRulesForPiece(piece: Piece): MovementRules {
		// For now, only checkers rules are implemented. Extend for more piece types.
		if (piece.type === 'checker') {
			return getCheckerMovementRules();
		}

		// Default movement rules for unhandled piece types
		throw new Error(`Unsupported piece type: ${piece.type}`);
	}

	/**
	 * Highlights valid squares for movement on the board.
	 *
	 * @param validMoves - List of valid positions where the piece can move.
	 * @param squareSize - Size of the board square.
	 */
	function highlightLegalSquares(validMoves: Position[], squareSize: number) {
		clearHighlights();
		validMoves.forEach((move) => {
			const highlightGeometry = new THREE.PlaneGeometry(squareSize, squareSize);
			const highlightMaterial = new THREE.MeshBasicMaterial({
				color: 0x00ff00, // Green for highlighting
				opacity: 0.5,
				transparent: true,
				side: THREE.DoubleSide
			});
			const highlightSquare = new THREE.Mesh(highlightGeometry, highlightMaterial);
			highlightSquare.rotation.x = -Math.PI / 2;
			highlightSquare.position.set(
				move.x - boardConfig.size.x / 2 + squareSize / 2,
				0.01,
				move.y - boardConfig.size.y / 2 + squareSize / 2
			);

			scene.add(highlightSquare);
			highlightedSquares.push({ mesh: highlightSquare, position: move });
		});
	}

	/**
	 * Clears the highlights from previously valid squares.
	 */
	function clearHighlights() {
		highlightedSquares.forEach(({ mesh }) => scene.remove(mesh));
		highlightedSquares = [];
	}

	// Mount the scene and handle resizing and click events
	onMount(() => {
		initScene(canvas, boardConfig);

		const resizeHandler = handleResize(camera, renderer);
		window.addEventListener('resize', resizeHandler);

		canvas.addEventListener('click', onCanvasClick);

		return () => {
			window.removeEventListener('resize', resizeHandler);
			canvas.removeEventListener('click', onCanvasClick);
		};
	});

	/**
	 * Handle window resizing by adjusting the camera and renderer size.
	 *
	 * @param camera - The camera to adjust.
	 * @param renderer - The renderer to resize.
	 * @returns A function to be used for resizing.
	 */
	function handleResize(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
		return () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
	}

	/**
	 * Handle click events on the canvas. Detect piece selection and movement.
	 *
	 * @param event - The mouse event triggered by the click.
	 */
	function onCanvasClick(event: MouseEvent) {
		mouse.x = (event.clientX / canvas.clientWidth) * 2 - 1;
		mouse.y = -(event.clientY / canvas.clientHeight) * 2 + 1;

		raycaster.setFromCamera(mouse, camera);
		const intersects = raycaster.intersectObjects(scene.children, true);

		if (intersects.length > 0) {
			const intersectedObject = intersects[0].object;

			let clickedSquare: Position | undefined;
			for (const { mesh, position } of highlightedSquares) {
				if (mesh === intersectedObject) {
					clickedSquare = position;
					break;
				}
			}

			if (clickedSquare && selectedPiece) {
				// Move selected piece
				movePiece(selectedPiece, clickedSquare);
				selectedPiece = null;
				validMoves = [];
				clearHighlights();

				// Switch player turn
				currentPlayer = currentPlayer === 0xff0000 ? 0x0000ff : 0xff0000;
			} else {
				// Check if a piece was clicked
				let clickedPiece: Piece | undefined;
				for (const [id, mesh] of pieceMeshes.entries()) {
					if (mesh === intersectedObject || mesh.children.includes(intersectedObject)) {
						clickedPiece = boardConfig.pieces?.find((p) => p.id === id);
						break;
					}
				}

				if (clickedPiece && clickedPiece.color === currentPlayer) {
					selectedPiece = clickedPiece;
					const movementRules = getMovementRulesForPiece(selectedPiece);
					validMoves = movementRules.allowedMoves(selectedPiece, boardConfig);
					highlightLegalSquares(validMoves, boardConfig.squareSize);
				}
			}
		}
	}

	/**
	 * Moves a piece on the board to a new position.
	 * If the move is a capture, the captured piece is removed.
	 *
	 * @param piece - The piece to move.
	 * @param newPosition - The new position to move the piece to.
	 */
	function movePiece(piece: Piece, newPosition: Position) {
		const deltaX = newPosition.x - piece.position.x;
		const deltaY = newPosition.y - piece.position.y;

		// Check if the move is a capture
		if (Math.abs(deltaX) === 2 && Math.abs(deltaY) === 2) {
			const capturedX = piece.position.x + deltaX / 2;
			const capturedY = piece.position.y + deltaY / 2;
			const capturedPiece = boardConfig.pieces?.find(
				(p) => p.position.x === capturedX && p.position.y === capturedY
			);

			if (capturedPiece) {
				removePiece(capturedPiece);
			}
		}

		// Update piece position in board config
		piece.position = newPosition;

		// Update mesh position on screen
		const mesh = pieceMeshes.get(piece.id);
		if (mesh) {
			mesh.position.set(
				newPosition.x - boardConfig.size.x / 2 + boardConfig.squareSize / 2,
				boardConfig.squareSize / 4,
				newPosition.y - boardConfig.size.y / 2 + boardConfig.squareSize / 2
			);
		}
	}

	/**
	 * Removes a piece from the board.
	 *
	 * @param piece - The piece to remove.
	 */
	function removePiece(piece: Piece) {
		// Remove from boardConfig.pieces
		if (boardConfig.pieces) {
			const index = boardConfig.pieces.indexOf(piece);
			if (index > -1) {
				boardConfig.pieces.splice(index, 1);
			}
		}

		// Remove mesh from scene
		const mesh = pieceMeshes.get(piece.id);
		if (mesh) {
			scene.remove(mesh);
			pieceMeshes.delete(piece.id);
		}
	}
</script>

<canvas bind:this={canvas} style="border: 1px solid #000; width: 100%; height: 100%;"></canvas>
