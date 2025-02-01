export type MessageType = "endFlow" | "flowDynamic" | "fallBack";

export abstract class CustomError extends Error {
  public messageType: MessageType;
  public sendErrorMessage: boolean;

  constructor(
    message: string,
    messageType: MessageType,
    sendErrorMessage: boolean
  ) {
    super(message);
    this.name = this.constructor.name;
    this.messageType = messageType;
    this.sendErrorMessage = sendErrorMessage;
  }
}
