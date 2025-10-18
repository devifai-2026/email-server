const axios = require("axios");

const verifyEmail = async (email, apiKey) => {
  try {
    const response = await axios.get("https://happy.mailtester.ninja/ninja", {
      params: { email, token: apiKey },
    });
    console.log(response.data, email);
    return response.data;
  } catch (error) {
    console.error("Email verification error:", error.message);
    return null;
  }
};

const getEmailVerificationToken = async (apiKey) => {
  console.log(apiKey, "inside api key");
  try {
    const response = await axios.get("https://token.mailtester.ninja/token", {
      params: { key: apiKey?.token },
    });
    console.log("response", response?.data);
    return response.data.token;
  } catch (error) {
    console.error("Verification key fetching error:", error.message);
    return null;
  }
};

module.exports = {
  verifyEmail,
  getEmailVerificationToken,
};
