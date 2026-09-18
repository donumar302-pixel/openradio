type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
    fbq?: {
      (action: "track", event: string, data?: AnalyticsData): void;
      (action: "trackCustom", event: string, data?: AnalyticsData): void;
    };
  }
}

const META_STANDARD_EVENTS: Partial<Record<string, string>> = {
  registration_completed: "CompleteRegistration",
  plan_selected: "InitiateCheckout",
  order_submitted: "Purchase",
};

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt the user's action.
  }
  try {
    const metaEvent = META_STANDARD_EVENTS[name];
    if (metaEvent) window.fbq?.("track", metaEvent, data);
  } catch {
    // Advertising analytics must never interrupt the user's action.
  }
}

export function trackMetaPageView(): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", "PageView");
  } catch {
    // Advertising analytics must never interrupt navigation.
  }
}