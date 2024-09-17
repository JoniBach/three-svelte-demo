<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import type {
		BoardConfig,
		Piece,
		Position,
		SceneConfig,
		CameraConfig,
		LightConfig,
		MovementRules,
		ClickEventConfig,
		PieceMoveConfig,
		HighlightConfig,
		ResizeHandlerConfig,
		AnimationConfig,
		MoveCaptuireConfig
	} from './entities.js';

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

	let isMultiCaptureActive = false;

	function initScene({ canvas, boardConfig }: SceneConfig): {
		scene: THREE.Scene;
		renderer: THREE.WebGLRenderer;
		camera: THREE.PerspectiveCamera;
	} {
		scene = createScene();
		camera = createCamera({ canvas, config: boardConfig.cameraConfig });
		renderer = createRenderer({ canvas });

		// Enable the camera to render both layer 0 (board) and layer 1 (pieces)
		camera.layers.enable(0); // Enable the default layer (for the board)
		camera.layers.enable(1); // Enable layer 1 (for the pieces)

		board = createBoard({ config: boardConfig });
		scene.add(board);

		if (boardConfig.pieces) {
			addPiecesToBoard({ scene, pieces: boardConfig.pieces, squareSize: boardConfig.squareSize });
		}

		addLights({ scene, config: boardConfig.lightConfig });
		animateThrottled({ renderer, scene, camera });

		return { scene, renderer, camera };
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
		squareSize
	}: {
		scene: THREE.Scene;
		pieces: Piece[];
		squareSize: number;
	}): void {
		pieces.forEach((piece) => {
			const pieceMesh = renderPiece({ piece, squareSize, boardConfig });
			scene.add(pieceMesh);
			pieceMeshes.set(piece.id, pieceMesh);
		});
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

	function getMovementRulesForPiece({
		piece,
		boardConfig
	}: {
		piece: Piece;
		boardConfig: BoardConfig;
	}): MovementRules {
		if (piece.type === 'checker') {
			return getCheckerMovementRules({ boardConfig });
		}

		throw new Error(`Unsupported piece type: ${piece.type}`);
	}

	function getValidMoves(
		piece: Piece,
		directions: { x: number; y: number }[],
		boardConfig: BoardConfig
	): Position[] {
		const validMoves: Position[] = [];

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
					validMoves.push({ x: adjacentX, y: adjacentY });
				}
			}
		});

		return validMoves;
	}

	function getCheckerMovementRules({ boardConfig }: { boardConfig: BoardConfig }): MovementRules {
		return {
			allowedMoves: (piece: Piece): Position[] => {
				const moves: Position[] = [];
				const isRedPlayer = piece.color === 0xff0000;
				const isKing = piece.king ?? false;

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

				const captureMoves = getCaptureMoves({
					piece,
					boardConfig,
					directions,
					capturedPieces: []
				});

				if (captureMoves.length > 0) {
					return captureMoves;
				}

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

				return moves;
			},
			canCapture: (piece: Piece, targetPiece: Piece) => piece.color !== targetPiece.color
		};
	}

	function getCaptureMoves({ piece, boardConfig, directions }: MoveCaptuireConfig): Position[] {
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

				if (
					jumpX >= 0 &&
					jumpX < boardConfig.size.x &&
					jumpY >= 0 &&
					jumpY < boardConfig.size.y &&
					!boardConfig.pieces?.some((p) => p.position.x === jumpX && p.position.y === jumpY)
				) {
					const newCapture = { x: jumpX, y: jumpY };
					moves.push(newCapture);
				}
			}
		});

		return moves;
	}

	function onCanvasClick({
		event,
		raycaster,
		mouse,
		camera,
		scene,
		boardConfig,
		pieceMeshes,
		highlightedSquares
	}: ClickEventConfig) {
		mouse.x = (event.clientX / canvas.clientWidth) * 2 - 1;
		mouse.y = -(event.clientY / canvas.clientHeight) * 2 + 1;

		raycaster.setFromCamera(mouse, camera);

		raycaster.layers.set(1);

		const pieceIntersects = raycaster.intersectObjects([...pieceMeshes.values()], true);
		if (pieceIntersects.length > 0) {
			const intersectedPiece = pieceIntersects[0].object;

			let clickedPiece: Piece | undefined;
			for (const [id, mesh] of pieceMeshes.entries()) {
				if (mesh === intersectedPiece) {
					clickedPiece = boardConfig.pieces?.find((p) => p.id === id);
					break;
				}
			}

			if (clickedPiece && clickedPiece.color === currentPlayer) {
				selectedPiece = clickedPiece;
				const movementRules = getMovementRulesForPiece({ piece: selectedPiece, boardConfig });
				validMoves = movementRules.allowedMoves(selectedPiece);
				highlightLegalSquares({ validMoves, squareSize: boardConfig.squareSize });
				return;
			}
		}

		raycaster.layers.set(0);

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
				movePiece({
					piece: selectedPiece,
					newPosition: clickedSquare,
					boardConfig,
					pieceMeshes,
					scene,
					highlightedSquares
				});
			}
		}
	}

	function movePiece({
		piece,
		newPosition,
		boardConfig,
		pieceMeshes,
		scene,
		highlightedSquares
	}: PieceMoveConfig) {
		const deltaX = newPosition.x - piece.position.x;
		const deltaY = newPosition.y - piece.position.y;

		let isCaptureMove = false;
		if (Math.abs(deltaX) === 2 && Math.abs(deltaY) === 2) {
			const capturedX = piece.position.x + deltaX / 2;
			const capturedY = piece.position.y + deltaY / 2;
			const capturedPiece = boardConfig.pieces?.find(
				(p) => p.position.x === capturedX && p.position.y === capturedY
			);

			if (capturedPiece) {
				removePiece({ piece: capturedPiece, boardConfig, pieceMeshes, scene });
				isCaptureMove = true;
				isMultiCaptureActive = true;
			}
		}

		piece.position = newPosition;
		const mesh = pieceMeshes.get(piece.id);
		if (mesh) {
			mesh.position.set(
				newPosition.x - boardConfig.size.x / 2 + boardConfig.squareSize / 2,
				boardConfig.squareSize / 4,
				newPosition.y - boardConfig.size.y / 2 + boardConfig.squareSize / 2
			);
		}

		if (
			(piece.color === 0xff0000 && newPosition.y === 7) ||
			(piece.color === 0x0000ff && newPosition.y === 0)
		) {
			piece.king = true;
			mesh?.scale.set(1.2, 1.2, 1.2);
		}

		validMoves = [];
		clearHighlights({ scene, highlightedSquares });

		if (isCaptureMove) {
			const movementRules = getMovementRulesForPiece({ piece, boardConfig });
			validMoves = movementRules.allowedMoves(piece);

			if (validMoves.some((move) => Math.abs(move.x - piece.position.x) === 2)) {
				highlightLegalSquares({ validMoves, squareSize: boardConfig.squareSize });
				return;
			} else {
				isMultiCaptureActive = false;
			}
		}

		selectedPiece = null;
		currentPlayer = currentPlayer === 0xff0000 ? 0x0000ff : 0xff0000;
		isMultiCaptureActive = false;
	}

	function removePiece({
		piece,
		boardConfig,
		pieceMeshes,
		scene
	}: {
		piece: Piece;
		boardConfig: BoardConfig;
		pieceMeshes: Map<string, THREE.Mesh>;
		scene: THREE.Scene;
	}) {
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

	// Highligt legal squares for a piece to move to
	function highlightLegalSquares({ validMoves, squareSize }: HighlightConfig) {
		clearHighlights({ scene, highlightedSquares });
		validMoves.forEach((move) => {
			const highlightGeometry = new THREE.PlaneGeometry(squareSize, squareSize);
			const highlightMaterial = new THREE.MeshBasicMaterial({
				color: 0x00ff00,
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

	function clearHighlights({
		scene,
		highlightedSquares
	}: {
		scene: THREE.Scene;
		highlightedSquares: { mesh: THREE.Mesh; position: Position }[];
	}) {
		highlightedSquares.forEach(({ mesh }) => scene.remove(mesh));
		highlightedSquares.length = 0;
	}

	onMount(() => {
		initScene({ canvas, boardConfig });

		const resizeHandler = handleResize({ camera, renderer, canvas });
		window.addEventListener('resize', resizeHandler);

		canvas.addEventListener('click', (event: MouseEvent) =>
			onCanvasClick({
				event,
				raycaster,
				mouse,
				camera,
				scene,
				boardConfig,
				pieceMeshes,
				highlightedSquares
			})
		);

		return () => {
			window.removeEventListener('resize', resizeHandler);
			canvas.removeEventListener('click', (event: MouseEvent) =>
				onCanvasClick({
					event,
					raycaster,
					mouse,
					camera,
					scene,
					boardConfig,
					pieceMeshes,
					highlightedSquares
				})
			);
		};
	});

	// Resize handler to adjust camera and renderer
	function handleResize({ camera, renderer, canvas }: ResizeHandlerConfig) {
		return () => {
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		};
	}
</script>

<canvas bind:this={canvas} style="border: 1px solid #000; width: 100%; height: 100%;"></canvas>
