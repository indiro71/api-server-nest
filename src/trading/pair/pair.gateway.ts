import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { Pair } from './schemas/pair.schema';

export const PAIRS_UPDATED_EVENT = 'pairs:update';

@WebSocketGateway({
  namespace: '/scanprices/pairs',
  origins: '*:*',
})
export class PairGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    const token = this.getHandshakeToken(client);

    if (!token) {
      this.disconnectUnauthorized(client);
      return;
    }

    try {
      const user = this.jwtService.verify(token);
      (client as Socket & { user?: unknown }).user = user;
      client.emit('connection:ready', {
        namespace: '/scanprices/pairs',
      });
    } catch (error) {
      this.disconnectUnauthorized(client);
    }
  }

  handleDisconnect(): void {
    return;
  }

  emitPairsUpdate(pairs: Pair[]): void {
    if (!this.server || !pairs?.length) return;

    this.server.emit(PAIRS_UPDATED_EVENT, pairs);
  }

  private getHandshakeToken(client: Socket): string | null {
    const query = client.handshake?.query as Record<string, string | string[]>;
    const token = this.normalizeToken(query?.token);
    const authorization = this.normalizeToken(query?.authorization);
    const headerAuthorization = this.normalizeToken(client.handshake?.headers?.authorization);

    return token || authorization || headerAuthorization;
  }

  private normalizeToken(value?: string | string[]): string | null {
    const token = Array.isArray(value) ? value[0] : value;

    if (!token) {
      return null;
    }

    return token.replace(/^Bearer\s+/i, '');
  }

  private disconnectUnauthorized(client: Socket): void {
    client.emit('auth:error', {
      message: 'User not authorized',
    });
    setTimeout(() => client.disconnect(true), 0);
  }
}
