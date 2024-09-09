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
	let currentPlayer: number = 0xff0000; // Red starts first

	let camera: THREE.PerspectiveCamera;
	let scene: THREE.Scene;
	let renderer: THREE.WebGLRenderer;
	let board: THREE.Group;

	// Track if the current piece is in a capture sequence
	let isMultiCaptureActive = false;

	/**
	 * Initializes the scene by creating the camera, board, renderer, and lights.
	 */
	function initScene(
		canvas: HTMLCanvasElement,
		boardConfig: BoardConfig
	): { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } {
		scene = createScene();
		camera = createCamera(canvas, boardConfig.cameraConfig);
		renderer = createRenderer(canvas);

		board = createBoard(boardConfig);
		scene.add(board);

		if (boardConfig.pieces) {
			addPiecesToBoard(scene, boardConfig.pieces, boardConfig.squareSize);
		}

		addLights(scene, boardConfig.lightConfig);
		animateThrottled(renderer, scene, camera);

		return { scene, renderer, camera };
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
		const position = config?.position ?? [0, 15, 0]; // Default top-down view
		const lookAt = config?.lookAt ?? [0, 0, 0];

		camera.position.set(...position);
		camera.lookAt(...lookAt);
		return camera;
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

	function addPiecesToBoard(scene: THREE.Scene, pieces: Piece[], squareSize: number) {
		pieces.forEach((piece) => {
			const pieceMesh = renderPiece(piece, squareSize);
			scene.add(pieceMesh);
			pieceMeshes.set(piece.id, pieceMesh);
		});
	}

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
	function getCheckerMovementRules(): MovementRules {
		return {
			allowedMoves: (piece: Piece, boardConfig: BoardConfig): Position[] => {
				const moves: Position[] = [];
				const isRedPlayer = piece.color === 0xff0000;
				const isKing = piece.king ?? false;

				// Kings can move both forward and backward
				const directions = isKing
					? [
							{ x: 1, y: 1 },
							{ x: -1, y: 1 },
							{ x: 1, y: -1 },
							{ x: -1, y: -1 }
						]
					: [
							{ x: 1, y: isRedPlayer ? 1 : -1 },
							{ x: -1, y: isRedPlayer ? 1 : -1 }
						];

				// Get both single moves and potential capture moves upfront
				const captureMoves = getCaptureMoves(piece, boardConfig, directions, []);
				if (captureMoves.length > 0) {
					// Only return capture moves if there are any
					return captureMoves;
				} else {
					// Otherwise return regular moves
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
								moves.push({ x: adjacentX, y: adjacentY });
							}
						}
					});
				}

				return moves;
			},
			canCapture: (piece: Piece, targetPiece: Piece) => piece.color !== targetPiece.color
		};
	}

	// Modify getCaptureMoves to handle only single captures
	function getCaptureMoves(
		piece: Piece,
		boardConfig: BoardConfig,
		directions: { x: number; y: number }[],
		capturedPieces: Position[]
	): Position[] {
		let moves: Position[] = [];

		directions.forEach((dir) => {
			const adjacentX = piece.position.x + dir.x;
			const adjacentY = piece.position.y + dir.y;

			const occupiedPiece = boardConfig.pieces?.find(
				(p) => p.position.x === adjacentX && p.position.y === adjacentY
			);

			if (occupiedPiece && piece.color !== occupiedPiece.color) {
				const jumpX = adjacentX + dir.x;
				const jumpY = adjacentY + dir.y;

				// Check if the jump square is available and not already captured
				if (
					jumpX >= 0 &&
					jumpX < boardConfig.size.x &&
					jumpY >= 0 &&
					jumpY < boardConfig.size.y &&
					!boardConfig.pieces?.some((p) => p.position.x === jumpX && p.position.y === jumpY)
				) {
					const newCapture = { x: jumpX, y: jumpY };
					moves.push(newCapture); // Return the immediate capture move only
				}
			}
		});

		return moves;
	}

	function getMovementRulesForPiece(piece: Piece): MovementRules {
		if (piece.type === 'checker') {
			return getCheckerMovementRules();
		}

		throw new Error(`Unsupported piece type: ${piece.type}`);
	}

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

	function clearHighlights() {
		highlightedSquares.forEach(({ mesh }) => scene.remove(mesh));
		highlightedSquares = [];
	}

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

	function handleResize(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
		return () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
	}

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
				movePiece(selectedPiece, clickedSquare);
			} else {
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
	 * If further captures are possible, the player can continue to capture.
	 */
	function movePiece(piece: Piece, newPosition: Position) {
		console.log('Move piece:', piece, 'New Position:', newPosition);

		const deltaX = newPosition.x - piece.position.x;
		const deltaY = newPosition.y - piece.position.y;

		// Check for capture
		let isCaptureMove = false;
		if (Math.abs(deltaX) === 2 && Math.abs(deltaY) === 2) {
			const capturedX = piece.position.x + deltaX / 2;
			const capturedY = piece.position.y + deltaY / 2;
			const capturedPiece = boardConfig.pieces?.find(
				(p) => p.position.x === capturedX && p.position.y === capturedY
			);

			if (capturedPiece) {
				console.log('Captured piece:', capturedPiece);
				removePiece(capturedPiece);
				isCaptureMove = true; // Mark this as a capture move
			}
		}

		// Update piece position
		piece.position = newPosition;
		const mesh = pieceMeshes.get(piece.id);
		if (mesh) {
			mesh.position.set(
				newPosition.x - boardConfig.size.x / 2 + boardConfig.squareSize / 2,
				boardConfig.squareSize / 4,
				newPosition.y - boardConfig.size.y / 2 + boardConfig.squareSize / 2
			);
		}

		// Handle king promotion
		if (
			(piece.color === 0xff0000 && newPosition.y === 7) ||
			(piece.color === 0x0000ff && newPosition.y === 0)
		) {
			piece.king = true;
			mesh?.scale.set(1.2, 1.2, 1.2); // Visual indicator for king
		}

		// Clear previous highlights
		validMoves = [];
		clearHighlights();

		// Check if further capture moves are available
		if (isCaptureMove) {
			const movementRules = getMovementRulesForPiece(piece);
			validMoves = movementRules.allowedMoves(piece, boardConfig);

			if (validMoves.length > 0) {
				console.log('Further capture moves available:', validMoves);
				highlightLegalSquares(validMoves, boardConfig.squareSize);
				// Return to allow the player to make another capture move
				return;
			} else {
				console.log('No further capture moves available. Ending turn.');
			}
		}

		// If no further captures are possible or it's a regular move, switch player
		selectedPiece = null; // Ensure piece is deselected after the move
		currentPlayer = currentPlayer === 0xff0000 ? 0x0000ff : 0xff0000;
	}

	function removePiece(piece: Piece) {
		if (boardConfig.pieces) {
			const index = boardConfig.pieces.indexOf(piece);
			if (index > -1) {
				boardConfig.pieces.splice(index, 1);
			}
		}

		const mesh = pieceMeshes.get(piece.id);
		if (mesh) {
			scene.remove(mesh);
			pieceMeshes.delete(piece.id);
		}
	}
</script>

<canvas bind:this={canvas} style="border: 1px solid #000; width: 100%; height: 100%;"></canvas>
