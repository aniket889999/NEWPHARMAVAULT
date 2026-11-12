// Small request-generation guard: late results from a previous case or refresh cannot replace current evidence.
export function createLatestRequestGuard() {
  let generation = 0;
  return {
    begin(): number { generation += 1; return generation; },
    isCurrent(ticket: number): boolean { return ticket === generation; },
    invalidate(): void { generation += 1; },
  };
}
