import { CustomTransportStrategy, Server } from '@nestjs/microservices';
import * as kafkaLib from '@confluentinc/kafka-javascript';
import { Logger } from '@nestjs/common';
import { KafkaContext } from './kafka-context';

export class KafkaServer extends Server implements CustomTransportStrategy {
  public readonly logger = new Logger(KafkaServer.name);

  private kafkaInst: kafkaLib.KafkaJS.Kafka;
  private consumer: kafkaLib.KafkaJS.Consumer;

  constructor(
    private readonly options: {
      server: kafkaLib.KafkaJS.CommonConstructorConfig;
      consumer: kafkaLib.KafkaJS.ConsumerConstructorConfig;
    },
  ) {
    super();
  }

  /**
   * This method is triggered when you run "app.listen()".
   */
  async listen(callback: () => void) {
    this.kafkaInst = new kafkaLib.KafkaJS.Kafka(this.options.server);
    this.consumer = this.kafkaInst.consumer(this.options.consumer);
    await this.consumer.connect();
    await this.bindEvents();

    callback();
  }

  public async bindEvents() {
    const registeredPatterns = [...this.messageHandlers.keys()];
    if (registeredPatterns.length > 0) {
      await this.consumer.subscribe({
        topics: registeredPatterns,
      });
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const handler = this.getHandlerByPattern(topic);
        if (!handler) {
          this.logger.error(`No handler for topic ${topic}`);
          return;
        }
        let value: unknown;
        try {
          value = JSON.parse(message.value.toString());
        } catch {
          this.logger.error(`Skipping invalid JSON message on topic ${topic}`);
          return;
        }
        const kafkaContext = new KafkaContext(
          message,
          value,
          topic,
          partition,
          this.consumer,
        );
        try {
          await handler(kafkaContext);
        } catch (error) {
          // one bad message must not stop the consumer
          this.logger.error(`Error handling message on topic ${topic}`, error);
        }
      },
    });
  }

  /**
   * This method is triggered on application shutdown.
   */
  async close() {
    this.logger.log('Closing Kafka connection');
    await this.consumer?.disconnect();
    this.consumer = null;
  }
}
