import { google, sheets_v4 } from 'googleapis';
import { config } from "~/config";

interface Appointment {
  clientName: string;
  clientPhoneNumber: string;
  appointmentDate: string;
  appointmentHour: string;
}

interface SheetData {
  companyName: string;
  companyPhoneNumber: string;
  appointments: Appointment[];
}

export async function readGoogleSheet(sheetId: string): Promise<SheetData> {
    const auth = new google.auth.GoogleAuth({
        credentials: {
          private_key: config.privateKey,
          client_email: config.clientEmail,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']  // Alcance para la API de Google Sheets.
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Read "Información General" sheet
    const infoResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Información General!B3:B6',
    });

    const infoValues = infoResponse.data.values || [];
    const companyName = infoValues[0]?.[0] || '';
    const countryCode = infoValues[2]?.[0] || '';
    const companyPhoneNumber = `${countryCode}${infoValues[3]?.[0] || ''}`;

    // Read "Turnos de Mañana" sheet
    const appointmentsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Turnos de Mañana!A:D',
    });

    const appointmentsValues = appointmentsResponse.data.values || [];
    const appointments: Appointment[] = appointmentsValues.slice(1).map((row) => ({
      clientName: row[0] || '',
      clientPhoneNumber: `${countryCode}${row[1] || ''}`,
      appointmentDate: row[2] || '',
      appointmentHour: row[3] || '',
  }));

  return {
    companyName,
    companyPhoneNumber,
    appointments,
  };
}
