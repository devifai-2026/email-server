const axios = require("axios");

const BASE_URL = "https://api-m.sandbox.paypal.com";

exports.getAccessToken = async () => {
  const credentials = `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`;
  const encoded = Buffer.from(credentials).toString("base64");

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${encoded}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    throw new Error(
      `Access token fetch failed: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};
