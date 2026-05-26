import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'https://your-custom-domain.com',
      'https://probodyline-dashboard.vercel.app',
      /\.vercel\.app$/, // Allow Vercel preview deployments
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('EventsGateway');

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcasts an entity update to all connected clients
   * @param type - The entity type (e.g., 'STOCK', 'QUOTATION', 'SALES_ORDER')
   * @param id - The UUID of the updated entity
   */
  broadcastEntityUpdate(type: string, id: string) {
    this.logger.log(`Broadcasting entity update: ${type} - ${id}`);
    this.server.emit('entityUpdated', { type, id });
  }
}
