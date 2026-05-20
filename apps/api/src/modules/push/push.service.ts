import { Injectable, Logger } from '@nestjs/common';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  async send(
    pushToken: string | null | undefined,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

    const message: ExpoPushMessage = { to: pushToken, title, body, data, sound: 'default' };

    try {
      const chunks = this.expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === 'error') {
            this.logger.warn(`Push error: ${ticket.message} (${ticket.details?.error})`);
          }
        }
      }
    } catch (err) {
      // Log but never throw — push failure must not break the main flow
      this.logger.error(`Push send failed: ${(err as Error).message}`);
    }
  }
}
