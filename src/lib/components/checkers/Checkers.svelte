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
	import { initScene } from './utils/scene.js';
	import { getMovementRulesForPiece } from './utils/rules.js';

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
		const sceneRes = initScene({ canvas, boardConfig, pieceMeshes });
		scene = sceneRes.scene;
		camera = sceneRes.camera;
		renderer = sceneRes.renderer;
		board = sceneRes.board;

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

<canvas bind:this={canvas} style=" width: 100%; height: 100%;"></canvas>
