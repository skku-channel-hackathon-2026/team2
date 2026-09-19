import {
  FunctionCallError,
  FunctionCallErrorCode,
} from "@channel.io/app-sdk-server";

export function badRequest(message: string, type: string): FunctionCallError {
  return new FunctionCallError(message, FunctionCallErrorCode.BadRequest, {
    type,
  });
}

export function internal(message: string, type: string): FunctionCallError {
  return new FunctionCallError(message, FunctionCallErrorCode.Internal, {
    type,
  });
}
