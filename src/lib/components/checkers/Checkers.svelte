<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type { BoardConfig, Piece, Position, MovementRules } from './types';

	export let boardConfig: BoardConfig;
	let canvas: HTMLCanvasElement;

	let pieceMeshes: Map<string, THREE.Mesh> = new Map();
	let selectedPiece: Piece | null = null;
	let validMoves: Position[] = [];
	let highlightedSquares: { mesh: THREE.Mesh; position: Position }[] = [];
	let raycaster = new THREE.Raycaster();
	let mouse = new THREE.Vector2();
	let currentPlayer: number = 0xff0000; // Start with red player

	let camera: THREE.PerspectiveCamera;
	let scene: THREE.Scene;
	let renderer: THREE.WebGLRenderer;
	let checkerboard: THREE.Group;

	// Throttled animation loop for improved performance
	function animateThrottled(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		camera: THREE.PerspectiveCamera
	): void {
		let lastRenderTime = 0;
		const renderInterval = 1000 / 30; // Cap to 30 FPS

		const animate = (currentTime: number) => {
			if (currentTime - lastRenderTime >= renderInterval) {
				renderer.render(scene, camera);
				lastRenderTime = currentTime;
			}
			requestAnimationFrame(animate);
		};

		requestAnimationFrame(animate);
	}

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

	function createScene(): THREE.Scene {
		return new THREE.Scene();
	}

	function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
		const renderer = new THREE.WebGLRenderer({ canvas });
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		return renderer;
	}

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
		const position = config?.position ?? [0, 15, 0]; // Default top-down camera
		const lookAt = config?.lookAt ?? [0, 0, 0];

		camera.position.set(...position);
		camera.lookAt(...lookAt);
		return camera;
	}

	// Pure function to create the checkerboard
	function createCheckerboard(config: BoardConfig): THREE.Group {
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

	// Pure function to render pieces on the board
	function renderPiece(piece: Piece, squareSize: number): THREE.Mesh {
		const geometry = new THREE.SphereGeometry(squareSize / 4, 32, 32); // Sphere shape for the piece
		const material = new THREE.MeshBasicMaterial({ color: piece.color });
		const pieceMesh = new THREE.Mesh(geometry, material);

		// Position piece in the center of its square
		pieceMesh.position.set(
			piece.position.x - boardConfig.size.x / 2 + squareSize / 2,
			squareSize / 4,
			piece.position.y - boardConfig.size.y / 2 + squareSize / 2
		);

		return pieceMesh;
	}

	// Function to add pieces to the board
	function addPiecesToBoard(scene: THREE.Scene, pieces: Piece[], squareSize: number) {
		pieces.forEach((piece) => {
			const pieceMesh = renderPiece(piece, squareSize);
			scene.add(pieceMesh);
			pieceMeshes.set(piece.id, pieceMesh);
		});
	}

	// Basic movement rules for checkers with forward movement only
	function getCheckerMovementRules(): MovementRules {
		return {
			allowedMoves: (piece: Piece, boardConfig: BoardConfig): Position[] => {
				const moves: Position[] = [];
				const isRedPlayer = piece.color === 0xff0000; // Red player moves upwards
				const isBluePlayer = piece.color === 0x0000ff; // Blue player moves downwards

				const directions = [
					{ x: 1, y: isRedPlayer ? 1 : -1 }, // Forward right for red, backward right for blue
					{ x: -1, y: isRedPlayer ? 1 : -1 } // Forward left for red, backward left for blue
				];

				directions.forEach((dir) => {
					const adjacentX = piece.position.x + dir.x;
					const adjacentY = piece.position.y + dir.y;

					if (
						adjacentX >= 0 &&
						adjacentX < boardConfig.size.x &&
						adjacentY >= 0 &&
						adjacentY < boardConfig.size.y
					) {
						const occupiedPiece = boardConfig.pieces?.find(
							(p) => p.position.x === adjacentX && p.position.y === adjacentY
						);

						if (!occupiedPiece) {
							// Empty square; regular move
							moves.push({ x: adjacentX, y: adjacentY });
						} else if (occupiedPiece.color !== piece.color) {
							// Possible capture
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
			canCapture: (piece: Piece, targetPiece: Piece) => {
				return piece.color !== targetPiece.color;
			}
		};
	}

	function getMovementRulesForPiece(piece: Piece): MovementRules {
		if (piece.type === 'checker') {
			return getCheckerMovementRules();
		}
		// Add more piece types and movement rules here
		return getCheckerMovementRules(); // Default for now
	}

	// Function to check if a position is valid
	function isValidMove(pos: Position, validMoves: Position[]): boolean {
		return validMoves.some((move) => move.x === pos.x && move.y === pos.y);
	}

	// Highlight legal squares for valid moves
	function highlightLegalSquares(validMoves: Position[], squareSize: number) {
		// Clear existing highlights
		clearHighlights();

		validMoves.forEach((move) => {
			const highlightGeometry = new THREE.PlaneGeometry(squareSize, squareSize);
			const highlightMaterial = new THREE.MeshBasicMaterial({
				color: 0x00ff00, // Green for highlighting
				opacity: 0.5, // Make it semi-transparent
				transparent: true,
				side: THREE.DoubleSide
			});
			const highlightSquare = new THREE.Mesh(highlightGeometry, highlightMaterial);

			// Position the highlight on the valid square
			highlightSquare.rotation.x = -Math.PI / 2;
			highlightSquare.position.set(
				move.x - boardConfig.size.x / 2 + squareSize / 2,
				0.01, // Slightly above the board to avoid z-fighting
				move.y - boardConfig.size.y / 2 + squareSize / 2
			);

			// Add the highlight square to the scene
			scene.add(highlightSquare);
			highlightedSquares.push({ mesh: highlightSquare, position: move });
		});
	}

	// Clear all highlighted squares
	function clearHighlights() {
		highlightedSquares.forEach(({ mesh }) => scene.remove(mesh));
		highlightedSquares = []; // Reset the highlighted squares array
	}

	// Handle piece movement
	function movePiece(piece: Piece, newPosition: Position) {
		const deltaX = newPosition.x - piece.position.x;
		const deltaY = newPosition.y - piece.position.y;

		// Check if the move is a capture
		if (Math.abs(deltaX) === 2 && Math.abs(deltaY) === 2) {
			// Calculate the position of the captured piece
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
			console.log('Updating piece position on screen'); // Debugging output
			mesh.position.set(
				newPosition.x - boardConfig.size.x / 2 + boardConfig.squareSize / 2,
				boardConfig.squareSize / 4,
				newPosition.y - boardConfig.size.y / 2 + boardConfig.squareSize / 2
			);
		}
	}

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

	// Function to get position from an intersected square
	function getSquarePositionFromIntersect(object: THREE.Object3D): Position | null {
		if (checkerboard && checkerboard.children.includes(object)) {
			const { x, z } = object.position;
			const gridX = Math.round(x + boardConfig.size.x / 2 - boardConfig.squareSize / 2);
			const gridY = Math.round(z + boardConfig.size.y / 2 - boardConfig.squareSize / 2);
			return { x: gridX, y: gridY };
		}
		return null;
	}

	// Initialize and animate the scene
	function initScene(
		canvas: HTMLCanvasElement,
		boardConfig: BoardConfig
	): { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } {
		scene = createScene();
		camera = createCamera(canvas, boardConfig.cameraConfig);
		renderer = createRenderer(canvas);

		// Create and add the checkerboard to the scene
		checkerboard = createCheckerboard(boardConfig);
		scene.add(checkerboard);

		// Add pieces to the board
		if (boardConfig.pieces) {
			addPiecesToBoard(scene, boardConfig.pieces, boardConfig.squareSize);
		}

		// Add lights to the scene
		addLights(scene, boardConfig.lightConfig);

		// Render loop
		animateThrottled(renderer, scene, camera);

		return { scene, renderer, camera };
	}

	onMount(() => {
		initScene(canvas, boardConfig);

		// Handle window resize
		const resizeHandler = handleResize(camera, renderer);
		window.addEventListener('resize', resizeHandler);

		// Add event listener for mouse clicks
		canvas.addEventListener('click', onCanvasClick);

		// Cleanup on component destroy
		return () => {
			window.removeEventListener('resize', resizeHandler);
			canvas.removeEventListener('click', onCanvasClick);
		};
	});

	// Handle window resizing
	function handleResize(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
		return () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
	}

	// Function to handle canvas click events
	function onCanvasClick(event: MouseEvent) {
		// Normalize mouse position for raycaster
		mouse.x = (event.clientX / canvas.clientWidth) * 2 - 1;
		mouse.y = -(event.clientY / canvas.clientHeight) * 2 + 1;

		// Update the raycaster
		raycaster.setFromCamera(mouse, camera);

		// Intersect objects in the scene
		const intersects = raycaster.intersectObjects(scene.children, true);

		if (intersects.length > 0) {
			const intersectedObject = intersects[0].object;

			// Check if a highlighted square was clicked
			let clickedSquare: Position | undefined;
			for (const { mesh, position } of highlightedSquares) {
				if (mesh === intersectedObject) {
					clickedSquare = position;
					break;
				}
			}

			if (clickedSquare && selectedPiece) {
				// Move piece to clicked square
				movePiece(selectedPiece, clickedSquare);
				selectedPiece = null;
				validMoves = [];

				// Clear highlights after moving
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

				if (clickedPiece) {
					if (clickedPiece.color === currentPlayer) {
						selectedPiece = clickedPiece;
						const movementRules = getMovementRulesForPiece(selectedPiece);
						validMoves = movementRules.allowedMoves(selectedPiece, boardConfig);

						// Highlight the valid moves
						highlightLegalSquares(validMoves, boardConfig.squareSize);
					}
				}
			}
		}
	}
</script>

<canvas bind:this={canvas} style="border: 1px solid #000; width: 100%; height: 100%;"></canvas>
