import { google, sheets_v4 } from "googleapis";
import { config } from "~/config";
import { AppointmentInfo } from "~/definitions/appointmentInfo";
import { Appointment } from "~/definitions/appointment";
import { SheetService } from "~/service/sheetsService";
import { ProcessPacientResponse } from "~/definitions/processPacientResponse";

class AppointmentService {
  private sheetService: SheetService;

  constructor() {
    this.sheetService = new SheetService(config.sheetId);
  }

  private createMultiAppointmentMessage(
    appointments: AppointmentInfo[]
  ): string {
    const turnosListado = appointments
      .map(
        (appt, index) =>
          `(*${index + 1}*). 
🗓️ ${appt.appointmentHour} hs
👩‍⚕️ ${appt.doctorName}
🏥 ${appt.clinicName}`
      )
      .join("\n\n");
    const message = [
      `Hola ${appointments[0].patientName}, tiene los siguientes turnos para mañana:`,
      `${turnosListado}`,
      `❌ Si desea cancelar alguno, responda solo con el *número* correspondiente al turno. Muchas gracias!.`,
      `👉🏽Para reprogramaciones, comuníquese al +${appointments[0].reprogrammingPhoneNumber}.`,
      `👉🏽Por cualquier consulta, contacte a la clínica: +${appointments[0].clinicPhoneNumber}.`,
      "ESTA LINEA NO RESPONDE MENSAJES",
    ].join("\n\n");

    return message;
  }

  private createMessage(appointments: AppointmentInfo[]): string {
    if (appointments.length === 1) {
      const [appt] = appointments;
      const message = [
        `Hola ${appt.patientName}, este es un recordatorio de su turno mañana:`,
        `🗓️ ${appt.appointmentHour} hs`,
        `👩‍⚕️ ${appt.doctorName}`,
        `🏥 ${appt.clinicName}`,
        `❌ Si desea cancelar este turno, responda con la palabra "Cancelar".`,
        `👉🏽Para reprogramaciones, comuníquese al +${appt.reprogrammingPhoneNumber}.`,
        `👉🏽Por cualquier consulta, contacte a la clínica: +${appt.clinicPhoneNumber}.`,
        "ESTA LINEA NO RESPONDE MENSAJES",
      ].join("\n\n");
      return message;
    } else {
      return this.createMultiAppointmentMessage(appointments);
    }
  }

  public async fetchAppointments(): Promise<Appointment[]> {
    // Leer datos del Google Sheet
    const rows = (await this.sheetService.getRows("Turnos!A:K")) || [];

    if (rows.length <= 1) {
      return [];
    }

    // Filtrar turnos para el día de mañana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toLocaleDateString("es-Es");

    const appointmentInfo: AppointmentInfo[] = rows
      .slice(1)
      .map((row, index) => ({
        patientPhoneNumber: row[0],
        patientName: row[1],
        appointmentDate: row[3],
        appointmentHour: row[4],
        clinicName: row[5],
        doctorName: row[6],
        reprogrammingPhoneNumber: row[7],
        clinicPhoneNumber: row[8],
        rowIndex: index + 1, // Guardar el índice de la fila (ajustado para Google Sheets)
      }))
      .filter((appointment) => appointment.appointmentDate === tomorrowDate);

    // Agrupar por número de teléfono del paciente
    const groupedAppointments = appointmentInfo.reduce((acc, appointment) => {
      acc[appointment.patientPhoneNumber] =
        acc[appointment.patientPhoneNumber] || [];
      acc[appointment.patientPhoneNumber].push(appointment);
      return acc;
    }, {} as Record<string, AppointmentInfo[]>);

    // Generar mensajes dependiendo de la cantidad de turnos
    const appointments: Appointment[] = Object.entries(groupedAppointments).map(
      ([patientPhoneNumber, patientAppointments]) => {
        const message = this.createMessage(patientAppointments);
        const rows = patientAppointments.map((appt) => appt.rowIndex);

        return {
          patientPhoneNumber,
          remainderMessage: message,
          rows, // Guardar índices de filas asociadas
        };
      }
    );

    return appointments;
  }

  public async markAsSent(appointmentsSent: Appointment[]) {
    // Generar actualizaciones para las filas correspondientes
    const updates = appointmentsSent.flatMap((appointment) =>
      appointment.rows.map((rowIndex) => ({
        range: `Turnos!J${rowIndex + 1}`,
        values: [[true]], // Marcar como enviado
      }))
    );

    // Aplicar los cambios en lote
    await this.sheetService.batchUpdateSlots(updates);

    return;
  }

  public async processPatientResponse(
    patientPhoneNumber: string,
    response: string
  ): Promise<ProcessPacientResponse> {
    // Leer datos del Google Sheet
    const rows = (await this.sheetService.getRows("Turnos!A:L")) || [];
    const appointments = rows.slice(1);

    // Obtener fecha de hoy y mañana
    const today = new Date().toLocaleDateString("es-Es");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toLocaleDateString("es-Es");

    // Filtrar turnos por número de teléfono y fecha (mañana)
    let patientAppointments = appointments
      .map((row, index) => ({ index, row })) // Mapear las filas con su índice
      .filter(
        ({ row }) =>
          row[0] === patientPhoneNumber &&
          (row[3] === today || row[3] === tomorrowDate)
      );

    // Verifica si hay al menos un turno para mañana
    const hasTomorrowAppointments = patientAppointments.some(
      ({ row }) => row[3] === tomorrowDate
    );

    // Si tiene turnos para mañana, elimina los de hoy
    if (hasTomorrowAppointments) {
      patientAppointments = patientAppointments.filter(
        ({ row }) => row[3] === tomorrowDate
      );
    }

    if (patientAppointments.length === 0) {
      return {
        patientResponse:
          "Usted no tiene turnos registrados.\n\n*ESTA LINEA NO RESPONDE MENSAJES*",
      };
    }

    const updateRow = async (index: number) => {
      const range = `Turnos!K${index + 2}:L${index + 2}`;
      await this.sheetService.updateSlots(range, [true, response]);
    };

    const getClinicResponse = (row: any[]) => {
      const clinicResponse = [
        `${row[6]} (profesional)`,
        `${row[2].toUpperCase()}, ${row[1].toUpperCase()} (paciente)`,
        "❌CANCELADO",
      ].join("\n");

      return clinicResponse;
    };

    // Si el paciente tiene un turno y la respuesta es "cancelar"
    if (
      patientAppointments.length === 1 &&
      response.toLowerCase() == "cancelar"
    ) {
      const firstAppointmentIndex = patientAppointments[0].index;
      const firstAppointmentRow = patientAppointments[0].row;
      const reprogrammingPhoneNumber = patientAppointments[0].row[7];

      const clinicResponse = getClinicResponse(firstAppointmentRow);
      await updateRow(firstAppointmentIndex);

      return {
        reprogrammingPhoneNumber,
        clinicResponse,
        patientResponse:
          "Su turno fue cancelado con éxito. Muchas gracias por avisar.",
      };
    }

    // Si la respuesta fue un número y el paciente tiene más de un número
    if (!isNaN(Number(response))) {
      const turnIndex = Number(response) - 1;
      if (turnIndex >= patientAppointments.length) {
        return {
          patientResponse:
            "No existe turno con ese número. Por favor vuelva a intentarlo o comuníquese con la clínica.",
        };
      }
      if (turnIndex >= 0) {
        const { index, row } = patientAppointments[turnIndex];
        await updateRow(index);
        const reprogrammingPhoneNumber = patientAppointments[0].row[7];
        const clinicResponse = getClinicResponse(row);

        return {
          reprogrammingPhoneNumber,
          clinicResponse,
          patientResponse:
            "Su turno fue cancelado con éxito. Muchas gracias por avisar.\n\nSi quiere cancelar otro turno, escriba el número correspondiente a ese.",
        };
      }
    }

    // Respuesta no válida
    const reprogrammingPhoneNumber = patientAppointments[0].row[7];
    const clinicPhoneNumber = patientAppointments[0].row[8];
    const patientResponse = [
      `👉🏽Si usted quiere reprogramar su turno favor de comunicarse al +${reprogrammingPhoneNumber}. Muchas gracias!`,
      `👉🏽Por cualquier otra consulta comuníquese con la clínica directamente: +${clinicPhoneNumber}.`,
      "ESTA LINEA NO RESPONDE MENSAJES",
    ].join("\n\n");
    return {
      patientResponse,
    };
  }
}

export const service = new AppointmentService();
