// Example CLI application entry point
import { Command } from "commander";

import {
  ConsoleWriter,
  DoubleProcessor,
  NumberReader,
} from "./examples/chunk-components";
import { PrintTasklet, UnstableTasklet } from "./examples/tasklets";
import { ExecutionContext } from "./tsbatch/execution-context";
import { RetryPolicy } from "./tsbatch/interfaces";
import { Job } from "./tsbatch/job";
import { ChunkRetryPolicies } from "./tsbatch/retry/retry-policies";
import { ChunkStep } from "./tsbatch/steps/chunk-step";
import { RetryableChunkStep } from "./tsbatch/steps/retryable-chunk-step";
import { withStepRetryDecorator } from "./tsbatch/steps/step-decorator";
import { TaskletStep } from "./tsbatch/steps/tasklet-step";

// Define different retry policies for each phase.
const chunkRetryPolicies: ChunkRetryPolicies = {
  readerRetryPolicy: {
    maxRetries: 2,
    delayMs: 300,
    shouldRetry: (error: any) => error.message.includes("Reader"),
  },
  processorRetryPolicy: {
    maxRetries: 3,
    delayMs: 500,
    shouldRetry: (error: any) => error.message.includes("Transient"),
  },
  writerRetryPolicy: {
    maxRetries: 2,
    delayMs: 300,
    shouldRetry: (error: any) => error.message.includes("Transient"),
  },
};

// Define a retry policy that will retry up to 3 times with a 500ms delay.
const retryPolicy: RetryPolicy = {
  maxRetries: 3,
  delayMs: 500,
  shouldRetry: (error: any) => {
    // For instance, only retry for errors that are transient.
    return error.message.includes("Transient");
  },
};

const program = new Command();

program
  .version("0.1.0")
  .description("A sample TypeScript CLI application")
  .option("-n, --name <name>", "Your name", "World")
  .action((options) => {
    console.log(`Hello, ${options.name}!`);
  })
  .addCommand(
    new Command("job").description("Run a job").action(async () => {
      console.log("Running job...");
      await runJob().catch(console.error);
    })
  )
  .addCommand(
    new Command("job-with-retry")
      .description("Run a jooptionsb with retry")
      .action(async () => {
        console.log("Running job with retry...");
        await runJobWithRetry().catch(console.error);
      })
  )
  .addCommand(
    new Command("job-with-retry-chunk")
      .description("Run a job with retry chunk")
      .action(async () => {
        console.log("Running job with retry chunk...");
        await runJobWithRetryChunk().catch(console.error);
      })
  );

program.parse(process.argv);

async function runJobWithRetryChunk() {
  // Create and run the retryable chunk step.
  const retryableChunkStep = new RetryableChunkStep(
    new NumberReader(20),
    new DoubleProcessor(),
    new ConsoleWriter(),
    5, // chunk size
    chunkRetryPolicies
  );

  const job = new Job("EnhancedChunkJob");

  job.addStep(retryableChunkStep);

  // Finally, if you wanted to wrap an arbitrary step with the generic decorator:
  const retryPolicyForStep: RetryPolicy = {
    maxRetries: 3,
    delayMs: 500,
    shouldRetry: (error: any) => error.message.includes("Transient"),
  };
  const decoratedStep = withStepRetryDecorator(
    retryableChunkStep,
    retryPolicyForStep
  );
  job.addStep(decoratedStep);

  console.log("job", job);
  await job.execute(new ExecutionContext()).catch(console.error);
}

async function runJob() {
  const job = new Job("ExampleJob");

  // Add a TaskletStep that prints a message 3 times.
  const printTasklet = new PrintTasklet("Executing tasklet step", 3);
  job.addStep(new TaskletStep(printTasklet));

  // Add a ChunkStep that reads numbers 1..20, doubles them, and prints them in chunks of 5.
  const reader = new NumberReader(20);
  const processor = new DoubleProcessor();
  const writer = new ConsoleWriter();
  const chunkStep = new ChunkStep<number, number>(reader, processor, writer, 5);
  job.addStep(chunkStep);

  // Execute the job with a new execution context.
  await job.execute(new ExecutionContext());
}

async function runJobWithRetry() {
  const job = new Job("ExampleJob2");
  console.log("job", job);

  const unstableTasklet = new UnstableTasklet();
  const retryableStep = new TaskletStep(unstableTasklet, retryPolicy);
  job.addStep(retryableStep);

  // Execute the job with a new execution context.
  await job.execute(new ExecutionContext()).catch(console.error);
}
