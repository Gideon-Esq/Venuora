// Hold durations shared by server and client code. Kept dependency-free so
// client components can import it (lib/booking.ts pulls in the database).

/** Online instant-book checkout hold, in minutes. */
export const ONLINE_HOLD_MINUTES = 15;
