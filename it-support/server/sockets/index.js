import jwt from 'jsonwebtoken';

let ioInstance;

export const initializeSockets = (io) => {
  ioInstance = io;

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication error: missing token'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = {
        id: decoded.id,
        role: decoded.role,
        companyId: decoded.companyId,
      };
      return next();
    } catch (err) {
      console.error('[socket auth]', err.message);
      return next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role, companyId } = socket.data.user;
    console.log(`User connected: ${socket.id} (user ${userId}, role ${role})`);

    socket.join(`user_${userId}`);
    if (companyId) {
      socket.join(`company_${companyId}`);
      socket.join(`role_${companyId}_${role}`);
    }

    socket.on('join_user_room', (requestedUserId) => {
      if (requestedUserId === userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('join_company_room', (requestedCompanyId) => {
      if (requestedCompanyId === companyId) {
        socket.join(`company_${companyId}`);
      }
    });

    socket.on('join_role_room', ({ companyId: reqCompanyId, role: reqRole }) => {
      if (reqCompanyId === companyId && reqRole === role) {
        socket.join(`role_${companyId}_${role}`);
      }
    });

    socket.on('join_ticket_room', (ticketId) => {
      if (typeof ticketId === 'string' && ticketId.length > 0) {
        socket.join(`ticket_${ticketId}`);
      }
    });

    socket.on('typing', ({ ticketId, name }) => {
      if (typeof ticketId !== 'string') return;
      socket.to(`ticket_${ticketId}`).emit('typing_status', {
        ticketId, name, userId, isTyping: true,
      });
    });

    socket.on('stop_typing', ({ ticketId }) => {
      if (typeof ticketId !== 'string') return;
      socket.to(`ticket_${ticketId}`).emit('typing_status', {
        ticketId, userId, isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

export const getIo = () => {
  if (!ioInstance) {
    throw new Error('Socket.io not initialized!');
  }
  return ioInstance;
};
