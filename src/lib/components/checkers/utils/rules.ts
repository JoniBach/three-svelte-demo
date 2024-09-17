import * as THREE from 'three';
import type { Piece, BoardConfig, MovementRules, Position, MoveCaptuireConfig } from '../entities';


export function getMovementRulesForPiece({
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

