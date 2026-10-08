import { AnalyticsEvent, AnalyticsEventType } from '../types/analytics';

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  public logEvent(
    eventType: AnalyticsEventType,
    payload: AnalyticsEvent['payload'] = {}
  ): AnalyticsEvent {
    const event: AnalyticsEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      eventType,
      payload
    };

    this.events.push(event);
    return event;
  }

  public getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  public getEventsByType(type: AnalyticsEventType): AnalyticsEvent[] {
    return this.events.filter(e => e.eventType === type);
  }

  public clear(): void {
    this.events = [];
  }
}

export const analyticsService = new AnalyticsService();
