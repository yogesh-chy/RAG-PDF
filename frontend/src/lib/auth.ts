import Cookies from "js-cookie";

const TOKEN_KEY = "rag_pdf_token";

export const setToken = (token: string) => {
  Cookies.set(TOKEN_KEY, token, { expires: 7, secure: true, sameSite: "strict" });
};

export const getToken = () => {
  return Cookies.get(TOKEN_KEY);
};

export const removeToken = () => {
  Cookies.remove(TOKEN_KEY);
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;

  try {
    const payloadBase64 = token.split(".")[1];
    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const decodedJson = atob(base64);
    const decoded = JSON.parse(decodedJson);
    
    // exp is in seconds, Date.now() is in milliseconds
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      removeToken(); // clean up expired token
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

export const getAuthHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
