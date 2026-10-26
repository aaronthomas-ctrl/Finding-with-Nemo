/**
 * Activity logging utility
 */
export async function logActivity(action: string, metadata?: Record<string, any>) {
  try {
    console.log(`[Activity] ${action}`, metadata);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}
