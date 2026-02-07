// =============================================
// bKash Checkout (URL) API Service
// Uses the Checkout (URL) flow — no agreement needed
// Docs: https://developer.bka.sh/docs/checkout-url-process-overview
// =============================================

const BKASH_BASE_URL = process.env.BKASH_BASE_URL;
const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;
const BKASH_USERNAME = process.env.BKASH_USERNAME;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD;

// Cache the grant token (expires in 3600s)
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get a grant token from bKash (cached for 1 hour)
 */
async function getGrantToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const url = `${BKASH_BASE_URL}/tokenized/checkout/token/grant`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'username': BKASH_USERNAME,
      'password': BKASH_PASSWORD
    },
    body: JSON.stringify({
      app_key: BKASH_APP_KEY,
      app_secret: BKASH_APP_SECRET
    })
  });

  const data = await res.json();

  if (data.statusCode !== '0000' && !data.id_token) {
    console.error('bKash Grant Token failed:', data);
    throw new Error(data.statusMessage || data.errorMessage || 'Failed to get bKash token');
  }

  cachedToken = data.id_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

/**
 * Create a bKash payment — returns bkashURL to redirect user
 * @param {object} opts - { amount, invoiceNumber, callbackURL, payerReference }
 */
async function createPayment({ amount, invoiceNumber, callbackURL, payerReference }) {
  const token = await getGrantToken();
  const url = `${BKASH_BASE_URL}/tokenized/checkout/create`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': token,
      'X-App-Key': BKASH_APP_KEY
    },
    body: JSON.stringify({
      mode: '0011',
      payerReference: payerReference || ' ',
      callbackURL,
      amount: String(amount),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: invoiceNumber
    })
  });

  const data = await res.json();

  if (data.statusCode !== '0000') {
    console.error('bKash Create Payment failed:', data);
    throw new Error(data.statusMessage || data.errorMessage || 'Failed to create bKash payment');
  }

  return {
    paymentID: data.paymentID,
    bkashURL: data.bkashURL,
    transactionStatus: data.transactionStatus,
    amount: data.amount,
    merchantInvoiceNumber: data.merchantInvoiceNumber
  };
}

/**
 * Execute a bKash payment after customer completes on bKash page
 * @param {string} paymentID - The paymentID returned by bKash callback
 */
async function executePayment(paymentID) {
  const token = await getGrantToken();
  const url = `${BKASH_BASE_URL}/tokenized/checkout/execute`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': token,
      'X-App-Key': BKASH_APP_KEY
    },
    body: JSON.stringify({ paymentID })
  });

  const data = await res.json();

  if (data.statusCode !== '0000' || data.transactionStatus !== 'Completed') {
    console.error('bKash Execute Payment failed:', data);
    throw new Error(data.statusMessage || data.errorMessage || 'bKash payment execution failed');
  }

  return {
    paymentID: data.paymentID,
    trxID: data.trxID,
    transactionStatus: data.transactionStatus,
    amount: data.amount,
    currency: data.currency,
    customerMsisdn: data.customerMsisdn,
    paymentExecuteTime: data.paymentExecuteTime,
    merchantInvoiceNumber: data.merchantInvoiceNumber
  };
}

/**
 * Query a bKash payment status
 * @param {string} paymentID
 */
async function queryPayment(paymentID) {
  const token = await getGrantToken();
  const url = `${BKASH_BASE_URL}/tokenized/checkout/payment/status`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': token,
      'X-App-Key': BKASH_APP_KEY
    },
    body: JSON.stringify({ paymentID })
  });

  return res.json();
}

module.exports = {
  getGrantToken,
  createPayment,
  executePayment,
  queryPayment
};
