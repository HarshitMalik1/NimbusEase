import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Socket> = new Map();

  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const payload = this.jwtService.verify(token);
      
      const user = await this.userRepository.findOne({ where: { id: { equals: payload.sub } } });
      
      if (!user || !user.isActive) {
          console.warn(`Connection rejected: User ${payload.sub} not found or inactive`);
          client.disconnect();
          return;
      }

      // Store user socket mapping
      this.userSockets.set(payload.sub, client);
      
      console.log(`User ${payload.sub} connected`);
      
      // Send initial connection confirmation
      client.emit('connected', {
        message: 'Real-time monitoring active',
        userId: payload.sub,
      });
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Find and remove user from map
    for (const [userId, socket] of this.userSockets.entries()) {
      if (socket.id === client.id) {
        this.userSockets.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  }

  // Event listeners for system events

  @OnEvent('security.anomaly')
  handleSecurityAnomaly(data: any) {
    const { userId, score, analysis } = data;
    
    // Send to specific user
    const userSocket = this.userSockets.get(userId);
    if (userSocket) {
      userSocket.emit('SECURITY_ALERT', {
        type: 'ANOMALY_DETECTED',
        severity: score > 0.9 ? 'CRITICAL' : score > 0.7 ? 'HIGH' : 'MEDIUM',
        description: `Unusual behavior detected (score: ${score.toFixed(2)})`,
        analysis: analysis.summary,
        recommendations: analysis.recommendations,
        timestamp: new Date(),
      });
    }

    // Also broadcast to admins
    this.broadcastToRole('ADMIN', {
      type: 'USER_ANOMALY',
      userId,
      score,
      analysis,
    });
  }

  @OnEvent('security.alert')
  handleSecurityAlert(data: any) {
    const { type, fileId, userId, severity = 'HIGH' } = data;
    
    // Broadcast to all admins and security analysts
    this.broadcastToRoles(['ADMIN', 'SECURITY_ANALYST'], {
      type: 'SECURITY_ALERT',
      alertType: type,
      severity,
      fileId,
      userId,
      timestamp: new Date(),
    });

    // Notify affected user
    const userSocket = this.userSockets.get(userId);
    if (userSocket) {
      userSocket.emit('SECURITY_ALERT', {
        type,
        severity,
        message: this.getAlertMessage(type),
        timestamp: new Date(),
      });
    }
  }

  @OnEvent('file.uploaded')
  handleFileUploaded(data: any) {
    const { userId, fileId, fileName } = data;
    
    const userSocket = this.userSockets.get(userId);
    if (userSocket) {
      userSocket.emit('FILE_UPLOADED', {
        fileId,
        fileName,
        message: 'File uploaded and registered on blockchain',
        timestamp: new Date(),
      });
    }
  }

  @OnEvent('blockchain.verified')
  handleBlockchainVerified(data: any) {
    const { userId, fileId, valid, txHash } = data;
    
    const userSocket = this.userSockets.get(userId);
    if (userSocket) {
      userSocket.emit('BLOCKCHAIN_VERIFICATION', {
        fileId,
        valid,
        txHash,
        timestamp: new Date(),
      });
    }
  }

  @OnEvent('system.stats')
  handleSystemStats(data: any) {
    // Broadcast system statistics to all connected users
    this.server.emit('SYSTEM_STATS', data);
  }

  // Utility methods

  private broadcastToRole(role: string, data: any) {
    this.userSockets.forEach((socket, userId) => {
      // In a real implementation, you'd check the user's role from the database
      // For now, we'll send to all connected users
      socket.emit('ADMIN_ALERT', data);
    });
  }

  private broadcastToRoles(roles: string[], data: any) {
    roles.forEach(role => this.broadcastToRole(role, data));
  }

  private getAlertMessage(type: string): string {
    const messages: Record<string, string> = {
      INTEGRITY_VIOLATION: 'File integrity check failed - potential tampering detected',
      BRUTE_FORCE: 'Multiple failed login attempts detected',
      DATA_EXFILTRATION: 'Unusual data download pattern detected',
      UNAUTHORIZED_ACCESS: 'Unauthorized access attempt detected',
      CREDENTIAL_STUFFING: 'Credential stuffing attack detected',
    };
    
    return messages[type] || 'Security event detected';
  }

  // Manual alert sending (can be called from services)
  sendAlertToUser(userId: string, alert: any) {
    const socket = this.userSockets.get(userId);
    if (socket) {
      socket.emit('SECURITY_ALERT', alert);
    }
  }

  broadcastAlert(alert: any) {
    this.server.emit('SECURITY_ALERT', alert);
  }
}
