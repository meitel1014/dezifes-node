export const yieldToEventLoop = (): Promise<void> => new Promise((r) => setImmediate(r));
