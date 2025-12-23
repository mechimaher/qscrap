import { Server } from 'socket.io';

declare global {
    var io: Server;
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                userType: string;
            };
        }
    }
}

export { };
