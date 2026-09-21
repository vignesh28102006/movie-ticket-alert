import { INotificationService, NotificationPayload, NotificationResult } from './notification.interface';

/**
 * PhoneCallNotificationService
 * Implements the Voice Call Notification provider (e.g. Twilio Voice / Exotel API).
 * Isolated so it can be enabled or customized with API keys without altering the monitoring core.
 */
export class PhoneCallNotificationService implements INotificationService {
  channelName = 'phone_call';

  async sendAlert(payload: NotificationPayload): Promise<NotificationResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      // In zero-budget / development mode, log the simulated voice call
      console.log(
        `[VoiceCall Simulation] 📞 OUTBOUND CALL INITIATED to ${payload.phoneNumber}: "Hello! Tickets for ${payload.movieTitle} at ${payload.theatreName} on ${payload.watchDate} have just been released on ${payload.platform}. Book now!"`
      );

      return {
        success: true,
        channel: this.channelName,
        messageId: `sim-call-${Date.now()}`,
        rawResponse: {
          simulated: true,
          notice: 'Zero-budget mode active. Add TWILIO_ACCOUNT_SID to trigger live telephony.',
        },
      };
    }

    try {
      // Text-to-speech TwiML message
      const twiml = `<Response><Say voice="alice">Attention! Movie tickets for ${payload.movieTitle} at ${payload.theatreName} have just released for ${payload.watchDate}. Please book your tickets immediately.</Say></Response>`;

      const params = new URLSearchParams({
        To: payload.phoneNumber,
        From: fromNumber,
        Twiml: twiml,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
          body: params.toString(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          channel: this.channelName,
          error: data.message || `Twilio call failed with status ${response.status}`,
          rawResponse: data,
        };
      }

      return {
        success: true,
        channel: this.channelName,
        messageId: data.sid,
        rawResponse: data,
      };
    } catch (err) {
      return {
        success: false,
        channel: this.channelName,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
