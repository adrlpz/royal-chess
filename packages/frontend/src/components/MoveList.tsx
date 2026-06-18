"use client";

interface MoveListProps {
  moves: string[];
}

export default function MoveList({ moves }: MoveListProps) {
  // Group moves into pairs (white, black)
  const pairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
      <div className="px-3 py-2 bg-dark-900 border-b border-dark-700 text-sm font-medium text-dark-300">
        Moves
      </div>
      <div className="max-h-64 overflow-y-auto p-2 font-mono text-sm">
        {pairs.length === 0 ? (
          <div className="text-dark-500 text-center py-4">No moves yet</div>
        ) : (
          pairs.map((pair) => (
            <div key={pair.num} className="move-row flex gap-2 py-0.5 px-1 rounded">
              <span className="w-8 text-dark-500">{pair.num}.</span>
              <span className="w-16 text-dark-100">{pair.white}</span>
              <span className="w-16 text-dark-300">{pair.black || ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
