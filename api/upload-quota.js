import {
  consumeUploadCreditForRequest,
  getUploadQuotaForRequest,
} from '../server/uploadQuota.js';
import { sendError } from '../server/subscriptions.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const quota = await getUploadQuotaForRequest(req);
      return res.status(200).json(quota);
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method === 'POST') {
    try {
      const quota = await consumeUploadCreditForRequest(req);
      return res.status(200).json(quota);
    } catch (error) {
      return sendError(res, error);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
