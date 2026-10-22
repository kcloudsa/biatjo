import { Server, Socket } from 'socket.io';

export default (io: Server, socket: Socket) => {
  socket.on('rider:ping', (data) => {
    console.log('rider:ping', data);
    socket.emit('rider:pong', { ok: true, at: new Date().toISOString() });
  });
};
