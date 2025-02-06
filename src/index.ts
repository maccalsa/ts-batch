// Example CLI application entry point
import { Command } from "commander";

import {
  ConsoleWriter,
  DoubleProcessor,
  NumberReader,
} from "./examples/chunk-components";
import { PrintTasklet, UnstableTasklet } from "./examples/tasklets";
import { ExecutionContext } from "./tsboot/execution-context";
import { RetryPolicy } from "./tsboot/interfaces";
import { Job } from "./tsboot/job";
import { ChunkStep } from "./tsboot/steps/chunk-step";
import { TaskletStep } from "./tsboot/steps/tasklet-step";

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
    new Command("job").description("Run a job").action(async (options) => {
      console.log(`Running job...`);
      await runJob().catch(console.error);
    })
  )
  .addCommand(
    new Command("job-with-retry")
      .description("Run a job with retry")
      .action(async (options) => {
        console.log(`Running job with retry...`);
        await runJobWithRetry().catch(console.error);
      })
  );

program.parse(process.argv);

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
