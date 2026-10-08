export class ForgeMindError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'ForgeMindError';
    this.code = code;
    this.exitCode = options.exitCode ?? 1;
    this.remediation = options.remediation;
    this.details = options.details;
  }
}

export function invalidInput(code, message, options = {}) {
  return new ForgeMindError(code, message, { ...options, exitCode: 2 });
}
