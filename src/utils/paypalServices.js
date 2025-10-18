const axios = require("axios");
const { getAccessToken } = require("./paypalAuth");

const BASE_URL = "https://api-m.sandbox.paypal.com";

exports.createPaypalOrder = async (amount, planId) => {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(
      `${BASE_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: amount } }],
        application_context: {
          return_url: process.env.PAYMENT_SUCCESS_URL + `?planId=${planId}`,
          cancel_url: process.env.PAYMENT_CANCEL_URL,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      `PayPal order creation failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};

exports.capturePaypalOrder = async (orderId) => {
  const accessToken = await getAccessToken();

  try {
    const response = await axios.post(
      `${BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      `PayPal order capture failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
};
