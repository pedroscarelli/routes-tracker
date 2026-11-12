import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { KafkaContext } from '../../kafka/kafka-context';
import { HttpService } from '@nestjs/axios';

@Controller()
export class RoutesDriverConsumer {
  private logger = new Logger(RoutesDriverConsumer.name);

  constructor(private httpService: HttpService) {}

  @MessagePattern('simulation')
  async driverMoved(payload: KafkaContext) {
    this.logger.log(
      `Receiving message from topic ${payload.topic}`,
      payload.messageValue,
    );
    const { route_id, lat, lng } = payload.messageValue;
    // The consumer runs in its own process, so it hands the point to the HTTP
    // process, which owns the WebSocket connections.
    const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
    await this.httpService.axiosRef.post(
      `${apiUrl}/routes/${route_id}/process-route`,
      {
        lat,
        lng,
      },
    );
  }
}
