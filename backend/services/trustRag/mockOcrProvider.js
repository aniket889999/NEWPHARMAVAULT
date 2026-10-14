const OcrProvider = require('./ocrProvider');

/**
 * Mock OCR Provider
 * Enables deterministic testing of OCR results, low-confidence fields,
 * errors, and timeouts without heavy worker overhead.
 */
class MockOcrProvider extends OcrProvider {
  constructor(initialResult = null) {
    super();
    this.mockResult = initialResult;
    this.simulateError = null;
    this.simulateDelayMs = 0;
    this.calls = [];
  }

  setMockResult(result) {
    this.mockResult = result;
    this.simulateError = null;
  }

  setSimulateError(err) {
    this.simulateError = err;
  }

  setSimulateDelay(delayMs) {
    this.simulateDelayMs = delayMs;
  }

  reset() {
    this.mockResult = null;
    this.simulateError = null;
    this.simulateDelayMs = 0;
    this.calls = [];
  }

  async recognize(imageBuffer, options = {}) {
    this.calls.push({ imageBuffer, options, timestamp: Date.now() });

    if (this.simulateDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelayMs));
    }

    if (this.simulateError) {
      const err = new Error(this.simulateError.message || 'Simulated OCR failure');
      err.statusCode = this.simulateError.statusCode || 422;
      throw err;
    }

    if (typeof this.mockResult === 'function') {
      return this.mockResult(imageBuffer, options);
    }

    if (Array.isArray(this.mockResult) && this.mockResult.length > 0) {
      return this.mockResult.shift();
    }

    if (this.mockResult) {
      return this.mockResult;
    }

    // Default minimal empty mock
    return {
      rawText: '',
      confidence: 0,
      lines: [],
      words: [],
      imageDimensions: { width: 1000, height: 1000 }
    };
  }
}

module.exports = MockOcrProvider;
