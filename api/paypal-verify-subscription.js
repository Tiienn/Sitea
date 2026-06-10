import { getAuthenticatedUser, sendError } from '../server/subscriptions.js';
import { verifyAndSaveMonthlySubscription } from '../server/paypal.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const { subscriptionID } = req.body || {};
    await verifyAndSaveMonthlySubscription({ user, subscriptionId: subscriptionID });

    return res.status(200).json({ success: true, planType: 'monthly' });
  } catch (error) {
    return sendError(res, error);
  }
}
