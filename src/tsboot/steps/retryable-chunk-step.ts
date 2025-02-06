import {
  ChunkRetryPolicies,
  ItemProcessor,
  ItemReader,
  ItemWriter,
  RetryMetrics,
  Step,
  withRetry,
} from "../core";
import { ExecutionContext } from "../execution-context";

export class RetryableChunkStep<I, O> implements Step {
  private reader: ItemReader<I>;
  private processor: ItemProcessor<I, O>;
  private writer: ItemWriter<O>;
  private chunkSize: number;
  private retryPolicies: ChunkRetryPolicies;
  private metrics: RetryMetrics;

  constructor(
    reader: ItemReader<I>,
    processor: ItemProcessor<I, O>,
    writer: ItemWriter<O>,
    chunkSize: number = 10,
    retryPolicies: ChunkRetryPolicies = {},
    metrics: RetryMetrics = new RetryMetrics()
  ) {
    this.reader = reader;
    this.processor = processor;
    this.writer = writer;
    this.chunkSize = chunkSize;
    this.retryPolicies = retryPolicies;
    this.metrics = metrics;
  }

  public async execute(context: ExecutionContext): Promise<void> {
    console.log("Starting RetryableChunkStep...");
    let chunk: O[] = [];

    while (true) {
      // --- Read phase with optional retry ---
      const readerOp = async () => this.reader.read();
      const readerRetryPolicy = this.retryPolicies.readerRetryPolicy;
      const item: I | null = readerRetryPolicy
        ? await withRetry(
            readerOp,
            readerRetryPolicy.maxRetries,
            readerRetryPolicy.delayMs || 0,
            (error, attempt) => {
              console.warn(`Reader retry attempt ${attempt}: ${error}`);
              this.metrics.increment("readerRetries");
            },
            readerRetryPolicy.shouldRetry
          )
        : await readerOp();

      if (item === null) {
        // No more data. Write any remaining chunk:
        if (chunk.length > 0) {
          await this.writeChunk(chunk);
        }
        break;
      }

      // --- Process phase with optional retry ---
      const processorOp = async () => this.processor.process(item);
      const processorRetryPolicy = this.retryPolicies.processorRetryPolicy;
      const processed: O | null = processorRetryPolicy
        ? await withRetry(
            processorOp,
            processorRetryPolicy.maxRetries,
            processorRetryPolicy.delayMs || 0,
            (error, attempt) => {
              console.warn(`Processor retry attempt ${attempt}: ${error}`);
              this.metrics.increment("processorRetries");
            },
            processorRetryPolicy.shouldRetry
          )
        : await processorOp();

      if (processed !== null) {
        chunk.push(processed);
      }

      if (chunk.length >= this.chunkSize) {
        await this.writeChunk(chunk);
        chunk = [];
      }
    }

    console.log("RetryableChunkStep complete.");
    console.log("Retry Metrics:", this.metrics.getAll());
  }

  private async writeChunk(chunk: O[]): Promise<void> {
    const writerOp = async () => this.writer.write(chunk);
    const writerRetryPolicy = this.retryPolicies.writerRetryPolicy;
    if (writerRetryPolicy) {
      await withRetry(
        writerOp,
        writerRetryPolicy.maxRetries,
        writerRetryPolicy.delayMs || 0,
        (error, attempt) => {
          console.warn(`Writer retry attempt ${attempt}: ${error}`);
          this.metrics.increment("writerRetries");
        },
        writerRetryPolicy.shouldRetry
      );
    } else {
      await writerOp();
    }
  }
}
