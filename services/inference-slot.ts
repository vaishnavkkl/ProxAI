type Occupant = 'none' | 'llm' | 'tti';

let gate: Promise<unknown> = Promise.resolve();
let occupant: Occupant = 'none';

/**
 * Serializes every native model load, unload, download, and generate.
 * Nested calls deadlock — never call this from work that already holds it.
 */
export function exclusiveInference<T>(work: () => Promise<T>): Promise<T> {
  const run = gate.then(work, work);
  gate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function occupyInference(kind: Exclude<Occupant, 'none'>) {
  if (occupant !== 'none' && occupant !== kind) {
    throw new Error(
      kind === 'tti'
        ? 'The assistant is still in RAM. Wait for chat or Refresh to finish.'
        : 'The image generator is still in RAM. Leave Imagine, tap Stop, or free app memory in Activity.',
    );
  }
  occupant = kind;
}

export function releaseInference(kind: Exclude<Occupant, 'none'>) {
  if (occupant === kind) {
    occupant = 'none';
  }
}

export function inferenceOccupant() {
  return occupant;
}
