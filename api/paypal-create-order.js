import { getAuthenticatedUser, sendError } from '../server/subscriptions.js';
import { createOneTimeOrder } from '../server/paypal.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const { planType } = req.body || {};
    const order = await createOneTimeOrder({ user, planType });

    return res.status(200).json({ orderID: order.id });
  } catch (error) {
    return sendError(res, error);
  }
}
