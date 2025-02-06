import { ExecutionContext } from "./execution-context";

export interface Step {
  execute(context: ExecutionContext): Promise<void>;
}

export enum RepeatStatus {
  FINISHED,
  CONTINUABLE,
}

export interface Tasklet {
  execute(context: ExecutionContext): Promise<RepeatStatus>;
}

export interface RetryPolicy {
  maxRetries: number;
  delayMs?: number; // Delay in milliseconds between retries.
  /**
   * A predicate to decide whether the error should be retried.
   * By default, all errors are considered retryable.
   */
  shouldRetry?: (error: any) => boolean;
}

export class TaskletStep implements Step {
  private tasklet: Tasklet;
  private retryPolicy?: RetryPolicy;

  constructor(tasklet: Tasklet, retryPolicy?: RetryPolicy) {
    this.tasklet = tasklet;
    this.retryPolicy = retryPolicy;
  }

  public async execute(context: ExecutionContext): Promise<void> {
    console.log("Executing TaskletStep with retry mechanism...");
    let status: RepeatStatus;
    do {
      // Wrap the tasklet execution in the withRetry function.
      status = await withRetry(
        () => this.tasklet.execute(context),
        this.retryPolicy?.maxRetries || 0,
        this.retryPolicy?.delayMs || 0,
        (error, attempt) => {
          console.warn(`Attempt ${attempt} failed with error: ${error}`);
        },
        this.retryPolicy?.shouldRetry
      );
    } while (status === RepeatStatus.CONTINUABLE);
    console.log("TaskletStep complete.");
  }
}

export class Job {
  private steps: Step[] = [];
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  public addStep(step: Step): void {
    this.steps.push(step);
  }

  public async execute(
    context: ExecutionContext = new ExecutionContext()
  ): Promise<void> {
    console.log(`Starting Job: ${this.name}`);
    for (const step of this.steps) {
      await step.execute(context);
    }
    console.log(`Job: ${this.name} completed.`);
  }
}

export interface ItemReader<T> {
  read(): Promise<T | null>; // Returns an item or null when there’s nothing left.
}

export interface ItemProcessor<I, O> {
  process(item: I): Promise<O | null>; // Return null if the item is filtered out.
}

export interface ItemWriter<T> {
  write(items: T[]): Promise<void>;
}

export interface ItemStream<T> {
  read(): Promise<T | null>;
  process(item: T): Promise<T | null>;
  write(items: T[]): Promise<void>;
}

export class ChunkStep<I, O> implements Step {
  private reader: ItemReader<I>;
  private processor: ItemProcessor<I, O>;
  private writer: ItemWriter<O>;
  private chunkSize: number;

  constructor(
    reader: ItemReader<I>,
    processor: ItemProcessor<I, O>,
    writer: ItemWriter<O>,
    chunkSize: number = 10
  ) {
    this.reader = reader;
    this.processor = processor;
    this.writer = writer;
    this.chunkSize = chunkSize;
  }

  public async execute(context: ExecutionContext): Promise<void> {
    console.log("Starting ChunkStep...");
    let chunk: O[] = [];
    while (true) {
      const item = await this.reader.read();
      if (item === null) {
        // End-of-data: write any remaining items.
        if (chunk.length > 0) {
          await this.writer.write(chunk);
        }
        break;
      }
      const processed = await this.processor.process(item);
      if (processed !== null) {
        chunk.push(processed);
      }
      if (chunk.length >= this.chunkSize) {
        await this.writer.write(chunk);
        chunk = [];
      }
    }
    console.log("ChunkStep complete.");
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  delayMs: number = 0,
  onRetry?: (error: any, attempt: number) => void,
  shouldRetry?: (error: any) => boolean
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      // If a shouldRetry predicate is provided, only continue if it returns true.
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      if (attempt > maxRetries) {
        throw error;
      }
      if (onRetry) {
        onRetry(error, attempt);
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
