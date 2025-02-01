import { google } from "googleapis";
import { sheets_v4 } from "googleapis";
import { config } from "~/config";
import { SpreadsheetError } from "~/errors";

export class SheetService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(spreadsheetId: string) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        private_key: config.privateKey,
        client_email: config.clientEmail,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth });
    this.spreadsheetId = spreadsheetId;
  }

  async getRows(range: string) {
    try {
      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range, // Hora, Cancha 1, Cancha 2
      });

      const rows = result.data.values;
      return rows;
    } catch (error) {
      console.error("Error al traer información del sheets", error);
      throw new SpreadsheetError();
    }
  }

  async updateSlots(range: string, values: (string | boolean)[]) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: "RAW",
        requestBody: {
          values: [values],
        },
      });
    } catch (error) {
      console.error("Error al actualizar información del sheets", error);
      throw new SpreadsheetError();
    }
  }

  async batchUpdateSlots(
    updates: {
      range: string;
      values: boolean[][];
    }[]
  ) {
    try {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          data: updates,
          valueInputOption: "RAW",
        },
      });
    } catch (error) {
      console.error("Error al actualizar información del sheets", error);
      throw new SpreadsheetError();
    }
  }

  async appendRows(range: string, values: string[]) {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: "RAW",
        requestBody: {
          values: [values],
        },
      });
    } catch (error) {
      console.error("Error agregar filas al sheets", error);
      throw new SpreadsheetError();
    }
  }
}
