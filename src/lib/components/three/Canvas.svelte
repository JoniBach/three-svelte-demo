<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	// Define constants for reusable hard-coded values
	const boardColorLight = 0xf0d9b5; // Light squares
	const boardColorDark = 0xb58863; // Dark squares
	const colorA = 0x0000ff; // Black pieces
	const colorB = 0xff0000; // White pieces
	const kingCrownColor = 0xffd700; // Gold color for the crown
	const boardHighlightColor = 0x00ff00; // Highlight color for legal moves
	const pieceHeight = 0.2; // Height of the pieces above the board
	const pieceRadius = 0.4; // Radius of the piece cylinders
	const cameraPosition = { x: 0, y: 12, z: 0 }; // Position the camera directly above the board
	const cameraFov = 45; // Camera field of view
	const cameraNear = 0.1; // Camera near clipping plane
	const cameraFar = 1000; // Camera far clipping plane

	const crownBaseRadius = 0.25; // Radius of the crown base
	const crownBaseThickness = 0.05; // Thickness of the crown base
	const crownPointRadius = 0.05; // Radius of the crown points
	const crownPointSegments = 32; // Segments for the crown points

	const pieceLiftHeight = 0.5; // Height to lift the piece when selected
	const pieceHoverGlowColor = 0x000000; // Glow color when hovering over a piece

	const ambientLightColor = 0x404040; // Soft white ambient light
	const ambientLightIntensity = 1; // Ambient light intensity
	const directionalLightColor = 0xffffff; // Directional light color
	const directionalLightPosition = { x: 0, y: 10, z: 10 }; // Directional light position

	type Position = { x: number; z: number };
	type Color = number;
	type CaptureMove = Position & { captureX: number; captureZ: number };

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
	let isMouseDown = false; // Track if the mouse is currently down

	// Track whose turn it is
	let currentPlayer: Color = colorA; // Black starts first

	// Function to create the camera
	function createCamera(): THREE.PerspectiveCamera {
		const camera = new THREE.PerspectiveCamera(
			cameraFov, // Field of view
			canvasWidth / canvasHeight, // Aspect ratio
			cameraNear, // Near clipping plane
			cameraFar // Far clipping plane
		);
		camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z); // Position the camera directly above the board
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
		const ambientLight = new THREE.AmbientLight(ambientLightColor, ambientLightIntensity); // Soft white light
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(directionalLightColor, 1);
		directionalLight.position
			.set(directionalLightPosition.x, directionalLightPosition.y, directionalLightPosition.z)
			.normalize();
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
				const color = (i + j) % 2 === 0 ? boardColorLight : boardColorDark; // Standard chessboard colors
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
		const pieceGeometry = new THREE.CylinderGeometry(pieceRadius, pieceRadius, pieceHeight, 64);
		const pieceMaterial = new THREE.MeshStandardMaterial({ color });
		const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);
		piece.position.set(position.x, pieceHeight, position.z); // Ensure they are above the board
		piece.userData = { isPiece: true, color, isKing: false, hasMoved: false }; // Add hasMoved property
		return piece;
	}

	// Function to create a king piece with a crown
	function createKing(color: Color, position: Position): THREE.Mesh {
		// Create the main cone part of the king
		const pieceGeometry = new THREE.CylinderGeometry(pieceRadius, pieceRadius, pieceHeight, 64);
		const pieceMaterial = new THREE.MeshStandardMaterial({ color });
		const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);

		// Position the cone
		piece.position.set(position.x, pieceHeight, position.z); // Ensure it is above the board

		// Create the crown base (a torus/ring around the top of the cone)
		const crownBaseGeometry = new THREE.TorusGeometry(crownBaseRadius, crownBaseThickness, 16, 100);
		const crownBaseMaterial = new THREE.MeshStandardMaterial({ color: kingCrownColor }); // Gold color
		const crownBase = new THREE.Mesh(crownBaseGeometry, crownBaseMaterial);

		// Position the crown base just above the cone
		crownBase.position.set(0, pieceHeight, 0);
		crownBase.rotation.x = Math.PI / 2; // Rotate so it sits horizontally

		// Create the crown points (small spheres around the top of the crown base)
		const crownPointGeometry = new THREE.SphereGeometry(
			crownPointRadius,
			crownPointSegments,
			crownPointSegments
		);
		const crownPoints = [];
		const pointMaterial = new THREE.MeshStandardMaterial({ color: kingCrownColor }); // Same gold color

		const numPoints = 5; // Number of points on the crown
		const radius = 0.2; // Radius of the circle where the points are placed
		for (let i = 0; i < numPoints; i++) {
			const angle = (i / numPoints) * Math.PI * 2;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;
			const crownPoint = new THREE.Mesh(crownPointGeometry, pointMaterial);
			crownPoint.position.set(x, pieceHeight + 0.05, z);
			crownPoints.push(crownPoint);
			piece.add(crownPoint); // Add each crown point to the piece
		}

		// Add the crown base to the piece
		piece.add(crownBase);

		// Set userData properties
		piece.userData = { isPiece: true, color, isKing: true, hasMoved: false };

		return piece;
	}

	// Function to add pieces to the board, including promoting to kings
	function addPieces(scene: THREE.Scene, width: number, height: number): void {
		for (let i = 0; i < width; i++) {
			for (let j = 0; j < 3; j++) {
				if ((i + j) % 2 !== 0) {
					const piece = createPiece(colorB, {
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
					const piece = createPiece(colorA, {
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
				material.color.setHex(boardHighlightColor); // Highlight color (green)
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

		const isKing = piece.userData.isKing;
		const color = piece.userData.color;
		const hasMoved = piece.userData.hasMoved;
		const movementDirection = color === colorB ? 1 : -1;

		// Calculate potential and capture moves
		const potentialMoves = getPotentialMoves(x, z, isKing, movementDirection, hasMoved);
		const captureMoves = getCaptureMoves(x, z, isKing, movementDirection);

		// Add legal moves
		addValidMoves(legalMoves, potentialMoves, width, height, scene);
		addValidCaptures(legalMoves, captureMoves, width, height, scene, piece);

		return legalMoves;
	}

	// Function to get potential moves based on piece type and movement direction
	function getPotentialMoves(
		x: number,
		z: number,
		isKing: boolean,
		movementDirection: number,
		hasMoved: boolean
	): Position[] {
		if (isKing) {
			return [
				{ x: x + 1, z: z + movementDirection },
				{ x: x - 1, z: z + movementDirection },
				{ x: x + 1, z: z - movementDirection },
				{ x: x - 1, z: z - movementDirection }
			];
		}

		return hasMoved
			? [
					{ x: x + 1, z: z + movementDirection },
					{ x: x - 1, z: z + movementDirection }
				]
			: [
					{ x: x + 1, z: z + movementDirection },
					{ x: x - 1, z: z + movementDirection },
					{ x: x + 2, z: z + movementDirection * 2 },
					{ x: x - 2, z: z + movementDirection * 2 }
				];
	}

	// Function to get potential capture moves based on piece type and movement direction
	function getCaptureMoves(
		x: number,
		z: number,
		isKing: boolean,
		movementDirection: number
	): CaptureMove[] {
		if (isKing) {
			return [
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
				{ x: x - 2, z: z - 2 * movementDirection, captureX: x - 1, captureZ: z - movementDirection }
			];
		}

		return [
			{ x: x + 2, z: z + 2 * movementDirection, captureX: x + 1, captureZ: z + movementDirection },
			{ x: x - 2, z: z + 2 * movementDirection, captureX: x - 1, captureZ: z + movementDirection }
		];
	}

	// Function to validate potential moves
	function addValidMoves(
		legalMoves: Position[],
		moves: Position[],
		width: number,
		height: number,
		scene: THREE.Scene
	): void {
		for (const move of moves) {
			if (isWithinBounds(move, width, height) && !isOccupied(move, scene)) {
				legalMoves.push(move);
			}
		}
	}

	// Function to validate capture moves
	function addValidCaptures(
		legalMoves: Position[],
		moves: CaptureMove[],
		width: number,
		height: number,
		scene: THREE.Scene,
		piece: THREE.Mesh
	): void {
		for (const move of moves) {
			if (isWithinBounds(move, width, height)) {
				const opponentPiece = getOpponentPieceAt(
					move.captureX,
					move.captureZ,
					scene,
					piece.userData.color
				);
				if (opponentPiece && !isOccupied({ x: move.x, z: move.z }, scene)) {
					legalMoves.push({ x: move.x, z: move.z });
				}
			}
		}
	}

	// Helper function to check if a move is within the board bounds
	function isWithinBounds(move: Position, width: number, height: number): boolean {
		return (
			move.x >= -width / 2 && move.x < width / 2 && move.z >= -height / 2 && move.z < height / 2
		);
	}

	// Helper function to check if a square is occupied
	function isOccupied(position: Position, scene: THREE.Scene): boolean {
		return scene.children.some(
			(child) =>
				child.userData.isPiece && child.position.x === position.x && child.position.z === position.z
		);
	}

	// Helper function to find an opponent's piece at a given position
	function getOpponentPieceAt(
		x: number,
		z: number,
		scene: THREE.Scene,
		color: Color
	): THREE.Mesh | undefined {
		return scene.children.find(
			(child) =>
				child.userData.isPiece &&
				child.position.x === x &&
				child.position.z === z &&
				child.userData.color !== color
		) as THREE.Mesh | undefined;
	}

	function handleMouseDown() {
		if (isMouseDown) return; // If the mouse is already down, do nothing

		isMouseDown = true; // Set the mouse down flag

		if (selectedPiece) {
			// Check if turn-taking is enabled and if the piece belongs to the current player
			if (turnTaking && selectedPiece.userData.color !== currentPlayer) {
				return; // Prevent moving if it's not the current player's turn
			}

			// Store the original position of the piece
			originalPosition = { x: selectedPiece.position.x, z: selectedPiece.position.z };

			// Lift the piece above the board
			selectedPiece.position.y = pieceLiftHeight;
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
					selectedPiece &&
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
					(selectedPiece.userData.color === colorB ? height / 2 - 0.5 : -height / 2 + 0.5)
				) {
					promoteToKing(selectedPiece);
				}

				// Switch turn if turn-taking is enabled
				if (turnTaking) {
					currentPlayer = currentPlayer === colorB ? colorA : colorB; // Toggle player turn
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

		isMouseDown = false; // Reset the mouse down flag
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
						previousMaterial.emissive.setHex(pieceHoverGlowColor);
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
				previousMaterial.emissive.setHex(pieceHoverGlowColor);
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
