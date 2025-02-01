import { CustomError } from "./CustomError";

export class SpreadsheetError extends CustomError {
  constructor() {
    super(
      "En unos minutos atendemos tu consulta. Muchas gracias",
      "endFlow",
      true
    );
  }
}
