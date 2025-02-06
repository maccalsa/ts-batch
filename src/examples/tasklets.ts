import { ExecutionContext } from "../tsboot/execution-context";
import { RepeatStatus, Tasklet } from "../tsboot/interfaces";

export class UnstableTasklet implements Tasklet {
  private counter = 0;

  public async execute(context: ExecutionContext): Promise<RepeatStatus> {
    this.counter++;
    if (Math.random() < 0.5) {
      throw new Error("Transient error occurred");
    }
    console.log(`UnstableTasklet succeeded on iteration ${this.counter}`);
    return RepeatStatus.FINISHED;
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
