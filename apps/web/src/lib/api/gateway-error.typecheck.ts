import {
  extractGatewayErrorCode,
  extractGatewayErrorMessage,
  getGatewayErrorMessage,
  isGatewayErrorEnvelope,
} from './gateway-error';

const sampleError = {
  response: {
    data: {
      code: 'RateLimitExceeded',
      message: 'Too many requests.',
      correlationId: 'typecheck-correlation',
    },
  },
};

const code: string = extractGatewayErrorCode(sampleError);
const message: string = extractGatewayErrorMessage(sampleError);
const mappedMessage: string = getGatewayErrorMessage(sampleError, 'Fallback');
const isEnvelope: boolean = isGatewayErrorEnvelope(sampleError.response.data);

void code;
void message;
void mappedMessage;
void isEnvelope;
