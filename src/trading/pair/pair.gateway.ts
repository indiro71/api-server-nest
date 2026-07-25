import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
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

    handleConnection(client: Socket): void {
        client.emit('connection:ready', {
            namespace: '/scanprices/pairs',
        });
    }

    handleDisconnect(): void {
        return;
    }

    emitPairsUpdate(pairs: Pair[]): void {
        if (!this.server || !pairs?.length) return;

        this.server.emit(PAIRS_UPDATED_EVENT, pairs);
    }
}
