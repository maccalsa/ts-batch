// Example CLI application entry point
import { Command } from "commander";

import {
  ChunkStep,
  ItemProcessor,
  ItemReader,
  ItemWriter,
  Job,
  Tasklet,
  TaskletStep,
} from "./tsboot/core";
import { RepeatStatus } from "./tsboot/core";
import { ExecutionContext } from "./tsboot/execution-context";

// A simple reader that returns numbers 1 to n.
export class NumberReader implements ItemReader<number> {
  private current = 1;
  constructor(private max: number) {}

  public async read(): Promise<number | null> {
    return this.current <= this.max ? this.current++ : null;
  }
}

// A processor that doubles the number.
export class DoubleProcessor implements ItemProcessor<number, number> {
  public async process(item: number): Promise<number> {
    return item * 2;
  }
}

// A writer that prints the chunk to the console.
export class ConsoleWriter implements ItemWriter<number> {
  public async write(items: number[]): Promise<void> {
    console.log("Writing chunk:", items);
  }
}

export class PrintTasklet implements Tasklet {
  private message: string;
  private count: number = 0;
  private maxCount: number;

  constructor(message: string, maxCount: number = 1) {
    this.message = message;
    this.maxCount = maxCount;
  }

  public async execute(context: ExecutionContext): Promise<RepeatStatus> {
    console.log(this.message, `(iteration ${this.count + 1})`);
    this.count++;
    return this.count < this.maxCount
      ? RepeatStatus.CONTINUABLE
      : RepeatStatus.FINISHED;
  }
}

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
