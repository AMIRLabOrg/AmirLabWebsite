const digitOffset = [
  "[--counter-offset:-10em] [--counter-steps:10]",
  "[--counter-offset:-11em] [--counter-steps:11]",
  "[--counter-offset:-12em] [--counter-steps:12]",
  "[--counter-offset:-13em] [--counter-steps:13]",
  "[--counter-offset:-14em] [--counter-steps:14]",
  "[--counter-offset:-15em] [--counter-steps:15]",
  "[--counter-offset:-16em] [--counter-steps:16]",
  "[--counter-offset:-17em] [--counter-steps:17]",
  "[--counter-offset:-18em] [--counter-steps:18]",
  "[--counter-offset:-19em] [--counter-steps:19]",
];
const digits = "01234567890123456789".split("").join("\n");

export function AnimatedCounter({ value }: { value: number }) {
  const formatted = value.toLocaleString("en-US");
  return (
    <span className="inline-grid tabular-nums">
      <span aria-hidden="true" className="inline-flex leading-none">
        {Array.from(formatted, (character, index) =>
          /\d/.test(character) ? (
            <span
              className={`inline-block h-[1em] w-[1ch] overflow-hidden ${digitOffset[Number(character)]}`}
              data-counter-digit={character}
              key={index}
            >
              <span className="block whitespace-pre leading-[1em] [transform:translateY(var(--counter-offset))] animate-[counter-roll_450ms_steps(var(--counter-steps),end)_both] motion-reduce:animate-none">
                {digits}
              </span>
            </span>
          ) : (
            <span key={index}>{character}</span>
          ),
        )}
      </span>
      <span className="sr-only">{formatted}</span>
    </span>
  );
}
