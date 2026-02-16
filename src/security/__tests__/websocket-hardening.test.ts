import fs from 'fs';
import path from 'path';

describe('WebSocket hardening regression guards', () => {
    const serverSource = fs.readFileSync(
        path.resolve(__dirname, '../../server.ts'),
        'utf8'
    );

    it('keeps mandatory Socket.IO auth middleware enabled', () => {
        expect(serverSource).toContain("io.use((socket, next) =>");
        expect(serverSource).toContain("Authentication error: Token required");
    });

    it('does not allow client-driven join_* room handlers', () => {
        expect(serverSource).not.toMatch(/socket\.on\(\s*['"`]join_/);
    });

    it('enforces server-side authorization for request and order tracking', () => {
        expect(serverSource).toContain("socket.on('track_request_view'");
        expect(serverSource).toContain('await canTrackRequest(');
        expect(serverSource).toContain("socket.on('track_order'");
        expect(serverSource).toContain('await canTrackOrder(');
    });
});
