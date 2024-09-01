<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	type Position = { x: number; z: number };
	type Color = number;

	export let width: number = 8; // Board width (number of squares)
	export let height: number = 8; // Board height (number of squares)
	export let canvasWidth: number = 400; // Canvas width in pixels
	export let canvasHeight: number = 400; // Canvas height in pixels
	export let turnTaking: boolean = true; // Turn-taking parameter

	let canvas: HTMLCanvasElement;
	let raycaster: THREE.Raycaster;
	let mouse: THREE.Vector2;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;

	let selectedPiece: THREE.Mesh | null = null;
	let isPieceLifted = false; // Track if the piece is currently lifted
	let originalPosition: Position | null = null;

	// Track whose turn it is
	let currentPlayer: Color = 0x0000ff; // Blue starts first

	// Function to create the camera
	function createCamera(): THREE.PerspectiveCamera {
		const camera = new THREE.PerspectiveCamera(
			45, // Field of view
			canvasWidth / canvasHeight, // Aspect ratio
			0.1, // Near clipping plane
			1000 // Far clipping plane
		);
		camera.position.set(0, 12, 0); // Position the camera directly above the board
		camera.lookAt(0, 0, 0); // Look straight down at the center of the board
		return camera;
	}

	// Function to create the renderer
	function createRenderer(): THREE.WebGLRenderer {
		const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		renderer.setSize(canvasWidth, canvasHeight);
		return renderer;
	}

	// Function to add lights to the scene
	function addLights(scene: THREE.Scene): void {
		const ambientLight = new THREE.AmbientLight(0x404040, 1); // Soft white light
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
		directionalLight.position.set(0, 10, 10).normalize();
		scene.add(directionalLight);
	}

	// Function to create a square
	function createSquare(color: Color, position: Position): THREE.Mesh {
		const squareGeometry = new THREE.PlaneGeometry(1, 1);
		const squareMaterial = new THREE.MeshBasicMaterial({ color });
		const square = new THREE.Mesh(squareGeometry, squareMaterial);
		square.position.set(position.x, 0, position.z);
		square.rotation.x = -Math.PI / 2; // Rotate the squares to lie flat
		square.userData = {
			isSquare: true,
			originalColor: color // Store the original color here
		};
		return square;
	}

	// Function to create the board
	function createBoard(scene: THREE.Scene, width: number, height: number): void {
		for (let i = 0; i < width; i++) {
			for (let j = 0; j < height; j++) {
				const color = (i + j) % 2 === 0 ? 0xf0d9b5 : 0xb58863; // Standard chessboard colors
				const square = createSquare(color, {
					x: i - width / 2 + 0.5,
					z: j - height / 2 + 0.5
				});
				scene.add(square);
			}
		}
	}

	// Function to create a piece
	function createPiece(color: Color, position: Position): THREE.Mesh {
		const pieceGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 64);
		const pieceMaterial = new THREE.MeshStandardMaterial({ color });
		const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);
		piece.position.set(position.x, 0.2, position.z); // Ensure they are above the board
		piece.userData = { isPiece: true, color, isKing: false, hasMoved: false }; // Add hasMoved property
		return piece;
	}

	// Function to create a cone (for kings)
	function createKing(color: Color, position: Position): THREE.Mesh {
		const pieceGeometry = new THREE.RingGeometry(0.12, 0.4, 64); // Inner radius, outer radius, and segments
		const pieceMaterial = new THREE.MeshStandardMaterial({ color });
		const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);
		piece.position.set(position.x, 0.2, position.z); // Ensure they are above the board
		piece.rotation.x = -Math.PI / 2; // Rotate the piece to lie flat
		piece.userData = { isPiece: true, color, isKing: true }; // Mark as a piece and store its color
		return piece;
	}

	// Function to add pieces to the board, including promoting to kings
	function addPieces(scene: THREE.Scene, width: number, height: number): void {
		const redColor = 0xff0000; // Red pieces
		const blueColor = 0x0000ff; // Blue pieces

		for (let i = 0; i < width; i++) {
			for (let j = 0; j < 3; j++) {
				if ((i + j) % 2 !== 0) {
					const piece = createPiece(redColor, {
						x: i - width / 2 + 0.5,
						z: j - height / 2 + 0.5
					});
					scene.add(piece);
				}
			}
		}

		for (let i = 0; i < width; i++) {
			for (let j = height - 3; j < height; j++) {
				if ((i + j) % 2 !== 0) {
					const piece = createPiece(blueColor, {
						x: i - width / 2 + 0.5,
						z: j - height / 2 + 0.5
					});
					scene.add(piece);
				}
			}
		}
	}

	function isMesh(object: THREE.Object3D): object is THREE.Mesh {
		return (object as THREE.Mesh).isMesh !== undefined;
	}

	let highlightedSquares: THREE.Mesh[] = [];

	function highlightLegalSquares(legalMoves: Position[]): void {
		// Remove previous highlights
		highlightedSquares.forEach((square) => {
			// Restore the original color using the stored originalColor
			const material = square.material as THREE.MeshBasicMaterial;
			material.color.setHex(square.userData.originalColor);
		});

		highlightedSquares = [];

		// Highlight new legal squares
		legalMoves.forEach((move) => {
			const square = scene.children.find(
				(child) =>
					child.userData.isSquare && child.position.x === move.x && child.position.z === move.z
			) as THREE.Mesh;

			if (square) {
				highlightedSquares.push(square);
				const material = square.material as THREE.MeshBasicMaterial;
				material.color.setHex(0x00ff00); // Highlight color (green)
			}
		});
	}

	// Function to promote a piece to a king
	function promoteToKing(piece: THREE.Mesh): void {
		if (!piece.userData.isKing) {
			const position = { x: piece.position.x, z: piece.position.z };
			scene.remove(piece);

			const king = createKing(piece.userData.color, position);
			scene.add(king);
			selectedPiece = king;
		}
	}
	function getLegalMoves(piece: THREE.Mesh, width: number, height: number): Position[] {
		const legalMoves: Position[] = [];
		const { x, z } = piece.position;

		// Determine if the piece is a king
		const isKing = piece.userData.isKing;
		const color = piece.userData.color;
		const hasMoved = piece.userData.hasMoved; // Track if the piece has moved

		// Determine movement direction based on piece color
		const movementDirection = color === 0xff0000 ? 1 : -1; // Red moves down, Blue moves up

		// Define potential moves and captures
		const potentialMoves = isKing
			? [
					{ x: x + 1, z: z + movementDirection },
					{ x: x - 1, z: z + movementDirection },
					{ x: x + 1, z: z - movementDirection },
					{ x: x - 1, z: z - movementDirection }
				]
			: [
					// Adjust for first move rule
					...(hasMoved
						? [
								{ x: x + 1, z: z + movementDirection },
								{ x: x - 1, z: z + movementDirection }
							]
						: [
								{ x: x + 1, z: z + movementDirection },
								{ x: x - 1, z: z + movementDirection },
								{ x: x + 2, z: z + movementDirection * 2 },
								{ x: x - 2, z: z + movementDirection * 2 }
							])
				];

		const captureMoves = isKing
			? [
					{
						x: x + 2,
						z: z + 2 * movementDirection,
						captureX: x + 1,
						captureZ: z + movementDirection
					},
					{
						x: x - 2,
						z: z + 2 * movementDirection,
						captureX: x - 1,
						captureZ: z + movementDirection
					},
					{
						x: x + 2,
						z: z - 2 * movementDirection,
						captureX: x + 1,
						captureZ: z - movementDirection
					},
					{
						x: x - 2,
						z: z - 2 * movementDirection,
						captureX: x - 1,
						captureZ: z - movementDirection
					}
				]
			: [
					{
						x: x + 2,
						z: z + 2 * movementDirection,
						captureX: x + 1,
						captureZ: z + movementDirection
					},
					{
						x: x - 2,
						z: z + 2 * movementDirection,
						captureX: x - 1,
						captureZ: z + movementDirection
					}
				];

		// Check for normal moves
		for (const move of potentialMoves) {
			if (
				move.x >= -width / 2 &&
				move.x < width / 2 &&
				move.z >= -height / 2 &&
				move.z < height / 2
			) {
				const occupied = scene.children.some(
					(child) =>
						child.userData.isPiece && child.position.x === move.x && child.position.z === move.z
				);

				if (!occupied) {
					legalMoves.push(move);
				}
			}
		}

		// Check for capture moves
		for (const move of captureMoves) {
			if (
				move.x >= -width / 2 &&
				move.x < width / 2 &&
				move.z >= -height / 2 &&
				move.z < height / 2
			) {
				const opponentPiece = scene.children.find(
					(child) =>
						child.userData.isPiece &&
						child.position.x === move.captureX &&
						child.position.z === move.captureZ &&
						child.userData.color !== piece.userData.color // Ensure it's an opponent's piece
				);

				const landingSquareEmpty = !scene.children.some(
					(child) =>
						child.userData.isPiece && child.position.x === move.x && child.position.z === move.z
				);

				if (opponentPiece && landingSquareEmpty) {
					legalMoves.push({ x: move.x, z: move.z });
				}
			}
		}

		return legalMoves;
	}

	function handleMouseDown() {
		if (selectedPiece) {
			// Check if turn-taking is enabled and if the piece belongs to the current player
			if (turnTaking && selectedPiece.userData.color !== currentPlayer) {
				return; // Prevent moving if it's not the current player's turn
			}

			// Store the original position of the piece
			originalPosition = { x: selectedPiece.position.x, z: selectedPiece.position.z };

			// Lift the piece above the board
			selectedPiece.position.y = 0.5;
			isPieceLifted = true;

			// Get and highlight the legal squares
			const legalMoves = getLegalMoves(selectedPiece, width, height);
			highlightLegalSquares(legalMoves);
		}
	}

	function handleMouseUp() {
		if (selectedPiece && isPieceLifted) {
			// Determine the square where the piece is dropped
			const targetSquare = highlightedSquares.find(
				(sq) =>
					Math.abs(sq.position.x - selectedPiece.position.x) < 0.5 &&
					Math.abs(sq.position.z - selectedPiece.position.z) < 0.5
			);

			// Check if the piece is dropped onto a legal square
			if (targetSquare) {
				// Check for capturing move
				const capturedX = (targetSquare.position.x + originalPosition!.x) / 2;
				const capturedZ = (targetSquare.position.z + originalPosition!.z) / 2;

				const capturedPiece = scene.children.find((child) => {
					return (
						child.userData.isPiece &&
						child.position.x === capturedX &&
						child.position.z === capturedZ &&
						child.userData.color !== selectedPiece!.userData.color // Ensure it's an opponent's piece
					);
				}) as THREE.Mesh | undefined;

				// Remove the captured piece if it exists
				if (capturedPiece) {
					scene.remove(capturedPiece);
				}

				// Move the selected piece to the target square
				selectedPiece.position.x = targetSquare.position.x;
				selectedPiece.position.z = targetSquare.position.z;
				selectedPiece.position.y = 0.3; // Place the piece back down on the board

				// Update the hasMoved flag
				selectedPiece.userData.hasMoved = true;

				// Promote to king if needed
				if (
					selectedPiece.position.z ===
					(selectedPiece.userData.color === 0xff0000 ? height / 2 - 0.5 : -height / 2 + 0.5)
				) {
					promoteToKing(selectedPiece);
				}

				// Switch turn if turn-taking is enabled
				if (turnTaking) {
					currentPlayer = currentPlayer === 0xff0000 ? 0x0000ff : 0xff0000; // Toggle player turn
				}
			} else {
				// If not on a legal square, move the piece back to its original position
				if (originalPosition) {
					selectedPiece.position.x = originalPosition.x;
					selectedPiece.position.z = originalPosition.z;
					selectedPiece.position.y = 0.3; // Place the piece back down on the board
				}
			}

			// Clear highlights and reset lifting state
			highlightLegalSquares([]);
			isPieceLifted = false;
			selectedPiece = null;
		}
	}

	function handleMouseMove() {
		if (isPieceLifted && selectedPiece) {
			// Raycast to find the intersection point with the board
			const planeIntersect = raycaster.intersectObjects(
				scene.children.filter((child) => child.userData.isSquare) // Only intersect with squares
			);

			if (planeIntersect.length > 0) {
				// Update the piece position to follow the mouse
				selectedPiece.position.x = planeIntersect[0].point.x;
				selectedPiece.position.z = planeIntersect[0].point.z;
			}
		}
	}

	function handleHover() {
		const intersects = raycaster.intersectObjects(scene.children, true);

		// Filter to ensure we only deal with pieces, identified by a specific userData property
		const pieceIntersects = intersects.filter((intersect) => intersect.object.userData.isPiece);

		if (pieceIntersects.length > 0) {
			const object = pieceIntersects[0].object;

			if (isMesh(object) && object !== selectedPiece) {
				// Reset the previous piece's glow
				if (selectedPiece) {
					const previousMaterial = (selectedPiece as THREE.Mesh)
						.material as THREE.MeshStandardMaterial;
					if (previousMaterial && 'emissive' in previousMaterial) {
						previousMaterial.emissive.setHex(0x000000);
					}
				}

				// Set the new selected piece
				selectedPiece = object;

				// Apply glow effect to the currently hovered piece
				const material = selectedPiece.material as THREE.MeshStandardMaterial;
				if (material && 'emissive' in material) {
					const baseColor = material.color.getHex(); // Get the original color
					material.emissive.setHex(baseColor); // Set the emissive to the same color as the base
				}
			}
		} else if (selectedPiece && !isPieceLifted) {
			// Reset the previous piece's glow when nothing is hovered
			const previousMaterial = (selectedPiece as THREE.Mesh).material as THREE.MeshStandardMaterial;
			if (previousMaterial && 'emissive' in previousMaterial) {
				previousMaterial.emissive.setHex(0x000000);
			}
			selectedPiece = null;
		}
	}

	onMount(() => {
		scene = new THREE.Scene();
		camera = createCamera();
		renderer = createRenderer();
		addLights(scene);

		raycaster = new THREE.Raycaster();
		mouse = new THREE.Vector2();

		createBoard(scene, width, height);
		addPieces(scene, width, height);

		const animate = () => {
			requestAnimationFrame(animate);
			renderer.render(scene, camera);
		};

		animate();

		// Add event listener for mouse movement
		canvas.addEventListener('mousemove', (event: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			mouse.x = ((event.clientX - rect.left) / canvasWidth) * 2 - 1;
			mouse.y = -((event.clientY - rect.top) / canvasHeight) * 2 + 1;

			// Update the picking ray with the camera and mouse position
			raycaster.setFromCamera(mouse, camera);

			handleHover();
			handleMouseMove();
		});

		// Add event listeners for mouse down and mouse up
		canvas.addEventListener('mousedown', handleMouseDown);
		canvas.addEventListener('mouseup', handleMouseUp);
	});
</script>

<canvas bind:this={canvas} style="border: 1px solid #000; width: 100%; height: 100%;"></canvas>

<style>
	canvas {
		display: block;
	}
</style>
