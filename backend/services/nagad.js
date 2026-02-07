// =============================================
// Nagad Payment Gateway Service
// Docs: https://nagad.com.bd/merchant/
// =============================================
const crypto = require('crypto');

const NAGAD_BASE_URL = process.env.NAGAD_BASE_URL;
const NAGAD_MERCHANT_ID = process.env.NAGAD_MERCHANT_ID;
const NAGAD_MERCHANT_NUMBER = process.env.NAGAD_MERCHANT_NUMBER;
const NAGAD_PG_PUBLIC_KEY = process.env.NAGAD_PG_PUBLIC_KEY;
const NAGAD_MERCHANT_PRIVATE_KEY = process.env.NAGAD_MERCHANT_PRIVATE_KEY;
const NAGAD_CALLBACK_URL = process.env.NAGAD_CALLBACK_URL;

/**
 * Encrypt data with Nagad's public key (RSA PKCS1 OAEP)
 */
function encryptWithPublicKey(data) {
  const publicKey = `-----BEGIN PUBLIC KEY-----\n${NAGAD_PG_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  const encrypted = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(JSON.stringify(data))
  );
  return encrypted.toString('base64');
}

/**
 * Sign data with merchant's private key
 */
function signWithPrivateKey(data) {
  const privateKey = `-----BEGIN RSA PRIVATE KEY-----\n${NAGAD_MERCHANT_PRIVATE_KEY}\n-----END RSA PRIVATE KEY-----`;
  const sign = crypto.createSign('SHA256');
  sign.update(JSON.stringify(data));
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Generate a random order ID
 */
function generateOrderId() {
  return 'TV' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Initialize a Nagad payment
 * Step 1: Call the initialization API to get challenge
 * @param {string} orderId - Unique order ID
 */
async function initializePayment(orderId) {
  const dateTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const sensitiveData = {
    merchantId: NAGAD_MERCHANT_ID,
    datetime: dateTime,
    orderId: orderId,
    challenge: crypto.randomBytes(20).toString('hex')
  };

  const sensitiveDataEncrypted = encryptWithPublicKey(sensitiveData);
  const signature = signWithPrivateKey(sensitiveData);

  const url = `${NAGAD_BASE_URL}/check-out/initialize/${NAGAD_MERCHANT_ID}/${orderId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-KM-Api-Version': 'v-0.2.0',
      'X-KM-IP-V4': '127.0.0.1',
      'X-KM-Client-Type': 'PC_WEB'
    },
    body: JSON.stringify({
      accountNumber: NAGAD_MERCHANT_NUMBER,
      dateTime: dateTime,
      sensitiveData: sensitiveDataEncrypted,
      signature: signature
    })
  });

  return res.json();
}

/**
 * Complete Nagad payment — creates the payment request
 * Step 2: Use the payment reference from init to create payment
 * @param {object} opts - { orderId, amount, paymentReferenceId, challenge, callbackURL }
 */
async function createPayment({ orderId, amount, paymentReferenceId, challenge, callbackURL }) {
  const sensitiveData = {
    merchantId: NAGAD_MERCHANT_ID,
    orderId: orderId,
    amount: String(amount),
    currencyCode: '050',
    challenge: challenge
  };

  const sensitiveDataEncrypted = encryptWithPublicKey(sensitiveData);
  const signature = signWithPrivateKey(sensitiveData);

  const url = `${NAGAD_BASE_URL}/check-out/complete/${paymentReferenceId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-KM-Api-Version': 'v-0.2.0',
      'X-KM-IP-V4': '127.0.0.1',
      'X-KM-Client-Type': 'PC_WEB'
    },
    body: JSON.stringify({
      sensitiveData: sensitiveDataEncrypted,
      signature: signature,
      callbackURL: callbackURL || NAGAD_CALLBACK_URL
    })
  });

  return res.json();
}

/**
 * Verify a Nagad payment after callback
 * @param {string} paymentRefId - Payment reference from callback
 */
async function verifyPayment(paymentRefId) {
  const url = `${NAGAD_BASE_URL}/verify/payment/${paymentRefId}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-KM-Api-Version': 'v-0.2.0',
      'X-KM-IP-V4': '127.0.0.1',
      'X-KM-Client-Type': 'PC_WEB'
    }
  });

  return res.json();
}

module.exports = {
  generateOrderId,
  initializePayment,
  createPayment,
  verifyPayment
};
