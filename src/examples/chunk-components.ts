import { ItemProcessor, ItemReader, ItemWriter } from "../tsbatch/interfaces";

export class NumberReader implements ItemReader<number> {
  private current = 1;
  constructor(private max: number) {}

  public async read(): Promise<number | null> {
    return this.current <= this.max ? this.current++ : null;
  }
}

export class DoubleProcessor implements ItemProcessor<number, number> {
  public async process(item: number): Promise<number> {
    return item * 2;
  }
}

export class ConsoleWriter implements ItemWriter<number> {
  public async write(items: number[]): Promise<void> {
    console.log("Writing chunk:", items);
  }
}
