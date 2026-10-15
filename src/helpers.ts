
/**
 * Ensures that the specified environment variable is set.
 * @param {string} key - The name of the environment variable.
 * @returns {string} - The value of the environment variable.
 * @throws Will throw an error if the environment variable is not set.
 */
function requireEnv(key: string) { 
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

// export at the end
export { requireEnv };