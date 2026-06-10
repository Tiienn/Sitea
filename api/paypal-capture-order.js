import { getAuthenticatedUser, sendError } from '../server/subscriptions.js';
import { captureAndSaveOneTimeOrder } from '../server/paypal.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const { orderID, planType } = req.body || {};
    await captureAndSaveOneTimeOrder({ user, orderId: orderID, planType });

    return res.status(200).json({ success: true, planType });
  } catch (error) {
    return sendError(res, error);
  }
}
